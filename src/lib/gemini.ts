/**
 * Gemini API 스트리밍 클라이언트 (브라우저에서 직접 호출).
 * - generateContentStream(alt=sse) 로 토큰을 받아 그대로 흘려보낸다.
 * - 모델을 찾지 못하면(404) 대체 모델로 자동 재시도한다.
 */
import { MODEL_FALLBACKS } from '../constants';

export interface GeminiContent {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface StreamOptions {
  apiKey: string;
  model: string;
  systemInstruction?: string;
  contents: GeminiContent[];
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
  onModelUsed?: (model: string) => void;
}

export class GeminiError extends Error {
  status: number;
  hint: string;

  constructor(message: string, status = 0, hint = '') {
    super(message);
    this.name = 'GeminiError';
    this.status = status;
    this.hint = hint;
  }
}

function endpoint(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
}

function bodyFor(options: StreamOptions) {
  const body: Record<string, unknown> = {
    contents: options.contents,
    generationConfig: {
      temperature: options.temperature ?? 0.95,
      maxOutputTokens: options.maxOutputTokens ?? 2400,
      topP: 0.95,
    },
  };
  if (options.systemInstruction) {
    body.systemInstruction = { parts: [{ text: options.systemInstruction }] };
  }
  // gemini-2.5-flash 는 사고 토큰을 0으로 두어 첫 문장이 빨리 나오게 한다.
  if (options.model === 'gemini-2.5-flash') {
    (body.generationConfig as Record<string, unknown>).thinkingConfig = { thinkingBudget: 0 };
  }
  return JSON.stringify(body);
}

async function toError(res: Response): Promise<GeminiError> {
  let message = '';
  let status = '';
  try {
    const json = (await res.json()) as { error?: { message?: string; status?: string; code?: number } };
    message = json.error?.message ?? '';
    status = json.error?.status ?? '';
  } catch {
    /* 본문이 JSON이 아닌 경우 */
  }

  if (res.status === 400 && /API key not valid|API_KEY_INVALID|invalid api key/i.test(`${message} ${status}`)) {
    return new GeminiError('API 키가 올바르지 않습니다.', 400, '설정에서 Gemini API 키를 다시 확인해 주세요.');
  }
  if (res.status === 400) {
    return new GeminiError(message || '요청 형식이 올바르지 않습니다.', 400, '키와 모델 이름을 확인해 주세요.');
  }
  if (res.status === 403) {
    return new GeminiError(
      message || '이 API 키로는 요청이 거부되었습니다.',
      403,
      '키의 사용 권한이나 지원 지역을 확인해 주세요.',
    );
  }
  if (res.status === 404) {
    return new GeminiError(message || '모델을 찾을 수 없습니다.', 404, '설정에서 다른 모델을 선택해 주세요.');
  }
  if (res.status === 429) {
    return new GeminiError(
      message || '요청 한도를 초과했습니다.',
      429,
      '무료 사용량을 다 썼을 수 있어요. 잠시 뒤 다시 시도하거나 다른 키를 넣어 주세요.',
    );
  }
  if (res.status >= 500) {
    return new GeminiError(message || 'Gemini 서버가 응답하지 않습니다.', res.status, '잠시 뒤 다시 시도해 주세요.');
  }
  return new GeminiError(message || `요청이 실패했습니다 (${res.status}).`, res.status);
}

async function* streamOnce(options: StreamOptions): AsyncGenerator<string, void, unknown> {
  let res: Response;
  try {
    res = await fetch(endpoint(options.model), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': options.apiKey,
      },
      body: bodyFor(options),
      signal: options.signal,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new GeminiError(
      '네트워크에 연결하지 못했습니다.',
      0,
      '인터넷 연결을 확인한 뒤 다시 시도해 주세요.',
    );
  }

  if (!res.ok) throw await toError(res);
  if (!res.body) throw new GeminiError('응답 스트림을 열 수 없습니다.', 0);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finishReason = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      newlineIndex = buffer.indexOf('\n');

      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;

      let json: {
        candidates?: {
          content?: { parts?: { text?: string }[] };
          finishReason?: string;
        }[];
        promptFeedback?: { blockReason?: string };
      };
      try {
        json = JSON.parse(payload);
      } catch {
        continue;
      }

      if (json.promptFeedback?.blockReason) {
        throw new GeminiError(
          '요청이 안전 정책으로 차단되었습니다.',
          400,
          '표현을 조금 바꿔 다시 질문해 주세요.',
        );
      }

      const candidate = json.candidates?.[0];
      for (const part of candidate?.content?.parts ?? []) {
        if (typeof part.text === 'string' && part.text) yield part.text;
      }
      if (candidate?.finishReason) finishReason = candidate.finishReason;
    }
  }

  if (finishReason === 'SAFETY') {
    throw new GeminiError('답변이 안전 정책으로 중단되었습니다.', 400, '질문을 부드럽게 바꿔 다시 시도해 주세요.');
  }
  if (finishReason === 'MAX_TOKENS') {
    yield '\n\n_(답변이 길어 여기서 끊겼습니다. "이어서"라고 말해 주세요.)_';
  }
}

/** 모델 404 시 대체 모델로 넘어가며 스트리밍한다. */
export async function* streamGemini(options: StreamOptions): AsyncGenerator<string, void, unknown> {
  const candidates = [options.model, ...MODEL_FALLBACKS.filter((m) => m !== options.model)];
  let lastError: unknown = null;

  for (const model of candidates) {
    try {
      const iterator = streamOnce({ ...options, model });
      const first = await iterator.next();
      options.onModelUsed?.(model);
      if (first.done) return;
      yield first.value;
      while (true) {
        const next = await iterator.next();
        if (next.done) return;
        yield next.value;
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') throw error;
      lastError = error;
      const isModelMissing = error instanceof GeminiError && error.status === 404;
      if (!isModelMissing) throw error;
      // 다음 대체 모델 시도
    }
  }

  throw lastError ?? new GeminiError('사용할 수 있는 모델이 없습니다.', 404);
}

/** 설정 화면의 연결 테스트: 키 유효성 + 모델 존재 여부를 확인한다. */
export async function testConnection(apiKey: string, model: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`,
    { headers: { 'x-goog-api-key': apiKey } },
  );
  if (!res.ok) throw await toError(res);
  const json = (await res.json()) as { displayName?: string; name?: string };
  return json.displayName || json.name || model;
}
