/**
 * Gemini API 스트리밍 클라이언트 (브라우저에서 직접 호출).
 * - generateContentStream(alt=sse) 로 토큰을 받아 그대로 흘려보낸다.
 * - 모델을 찾지 못하면(404 · no longer available) 대체 모델로 자동 재시도하고,
 *   모델이 붐비면(503 · high demand · overloaded) 다른 모델로 바로 넘어간다.
 * - 정적 목록이 모두 실패하면 ListModels로 지금 쓸 수 있는 모델을 찾아 한 번 더 시도한다.
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

/**
 * Gemini 3.x 부터는 정수 thinkingBudget 대신 thinkingLevel(LOW/MEDIUM/HIGH)을 쓴다.
 * 채팅 답변은 첫 문장이 빨리 나오는 편이 좋아 Flash 계열은 'low', Pro 계열은 'medium'.
 * Gemini 3 이전 모델(직접 입력한 경우)은 null → thinkingConfig를 보내지 않는다.
 */
function thinkingLevelFor(model: string): 'low' | 'medium' | 'high' | null {
  if (!/^gemini-[3-9]/.test(model)) return null;
  if (/-pro/.test(model)) return 'medium';
  return 'low';
}

function bodyFor(options: StreamOptions, withThinking: boolean) {
  const level = thinkingLevelFor(options.model);
  const generationConfig: Record<string, unknown> = {
    // 3.x는 사고 토큰이 출력 한도에 함께 계산되므로 여유를 둔다.
    maxOutputTokens: options.maxOutputTokens ?? 8192,
  };

  if (level) {
    if (withThinking) generationConfig.thinkingConfig = { thinkingLevel: level };
  } else {
    // Gemini 3 이전 모델: 기존 샘플링 설정 유지 (3.x에서는 서버가 무시한다)
    generationConfig.temperature = options.temperature ?? 0.95;
    generationConfig.topP = 0.95;
  }

  const body: Record<string, unknown> = {
    contents: options.contents,
    generationConfig,
  };
  if (options.systemInstruction) {
    body.systemInstruction = { parts: [{ text: options.systemInstruction }] };
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
  if (res.status === 503 || res.status === 529) {
    return new GeminiError(
      message || 'Gemini가 지금 붐벼서 답하지 못하고 있어요.',
      res.status,
      '다른 모델로도 시도했지만 모두 붐볐어요. 잠시 뒤 다시 말씀해 주세요.',
    );
  }
  if (res.status >= 500) {
    return new GeminiError(
      message || 'Gemini 서버가 응답하지 않습니다.',
      res.status,
      '다른 모델로도 시도했지만 실패했어요. 잠시 뒤 다시 시도해 주세요.',
    );
  }
  return new GeminiError(message || `요청이 실패했습니다 (${res.status}).`, res.status);
}

/** 이 모델로는 계속할 수 없어 다른 모델로 넘어가야 하는 오류인지. */
function isModelUnavailable(error: unknown): boolean {
  if (!(error instanceof GeminiError)) return false;
  if (error.status === 404) return true;
  if (error.status !== 400 && error.status !== 403) return false;
  return /no longer available|not found|does not exist|not supported|unsupported model|deprecated|decommission/i.test(
    error.message,
  );
}

/**
 * 모델은 있지만 지금 붐벼서 답하지 못하는 경우(503 · high demand · overloaded).
 * 기다리게 하는 대신 다른 모델로 바로 넘어가면 대부분 뚫린다.
 */
function isOverloaded(error: unknown): boolean {
  if (!(error instanceof GeminiError)) return false;
  if (error.status === 503 || error.status === 529) return true;
  if (error.status === 500 || error.status === 502 || error.status === 504) return true;
  return /high demand|overload|over capacity|capacity|try again later|temporarily unavailable|service unavailable/i.test(
    error.message,
  );
}

/** 다른 모델로 다시 시도할 만한 오류인지 (단종 + 일시적 과부하). */
function isRetryableElsewhere(error: unknown): boolean {
  return isModelUnavailable(error) || isOverloaded(error);
}

/** thinkingLevel을 받지 않는 모델(400)이면 thinkingConfig 없이 다시 시도한다. */
function isThinkingRejected(error: unknown): boolean {
  return error instanceof GeminiError && error.status === 400 && /thinking/i.test(error.message);
}

async function* streamOnce(options: StreamOptions, withThinking: boolean): AsyncGenerator<string, void, unknown> {
  let res: Response;
  try {
    res = await fetch(endpoint(options.model), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': options.apiKey,
      },
      body: bodyFor(options, withThinking),
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

/** 한 모델로 스트리밍하되, thinkingConfig가 거부되면 빼고 한 번 더 시도한다. */
async function* streamModel(options: StreamOptions): AsyncGenerator<string, void, unknown> {
  const withThinking = thinkingLevelFor(options.model) !== null;
  if (!withThinking) {
    yield* streamOnce(options, false);
    return;
  }
  try {
    yield* streamOnce(options, true);
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    if (!isThinkingRejected(error)) throw error;
    yield* streamOnce(options, false);
  }
}

/**
 * ListModels로 지금 이 키로 쓸 수 있는 텍스트 모델 중 가장 최신 것을 찾는다.
 * (새 모델이 나오거나 기존 모델이 단종돼도 앱을 고치지 않고 버티기 위한 마지막 수단)
 */
export async function discoverModel(apiKey: string): Promise<string | null> {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
    headers: { 'x-goog-api-key': apiKey },
  });
  if (!res.ok) return null;

  const json = (await res.json()) as {
    models?: { name?: string; supportedGenerationMethods?: string[] }[];
  };

  const names = (json.models ?? [])
    .filter((model) => model.supportedGenerationMethods?.includes('generateContent'))
    .map((model) => (model.name ?? '').replace(/^models\//, ''))
    .filter((name) => /^gemini-\d/.test(name))
    // 이미지·음성·임베딩 계열은 텍스트 상담에 쓰지 않는다.
    .filter((name) => !/(image|tts|live|audio|embedding|transcribe|omni|nano)/.test(name));

  if (!names.length) return null;

  // 이 앱은 빠른 채팅이 우선이므로 Flash 계열을 가장 앞세우고, 그 안에서 최신 버전을 고른다.
  const score = (name: string) => {
    const match = name.match(/^gemini-(\d+)(?:\.(\d+))?/);
    const major = match ? Number(match[1]) : 0;
    const minor = match && match[2] ? Number(match[2]) : 0;
    const flash = /-flash/.test(name) ? 1 : 0;
    const preview = /preview|exp/.test(name) ? -1 : 0;
    return flash * 1e9 + major * 1e6 + minor * 1e4 + preview * 1e3;
  };

  return [...names].sort((a, b) => score(b) - score(a))[0] ?? null;
}

/**
 * 고른 모델로 스트리밍하되, 단종(404)이나 일시적 과부하(503 · high demand)면
 * 대체 모델로 자동으로 넘어간다. 답이 이미 흘러나온 뒤의 실패는 다시 시작하지 않는다.
 */
export async function* streamGemini(options: StreamOptions): AsyncGenerator<string, void, unknown> {
  const candidates = [options.model, ...MODEL_FALLBACKS.filter((model) => model !== options.model)];
  let lastError: unknown = null;
  let discoveryTried = false;

  for (let index = 0; index < candidates.length; index += 1) {
    const model = candidates[index];
    let emitted = false;
    try {
      const iterator = streamModel({ ...options, model });
      const first = await iterator.next();
      options.onModelUsed?.(model);
      if (first.done) return;
      emitted = true;
      yield first.value;
      while (true) {
        const next = await iterator.next();
        if (next.done) return;
        yield next.value;
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') throw error;
      lastError = error;
      // 이미 글자가 나온 뒤라면 다른 모델로 처음부터 다시 쓰지 않는다 (같은 문장이 겹친다).
      if (emitted || !isRetryableElsewhere(error)) throw error;

      // 단종된 모델이면, 정적 목록을 다 쓴 뒤 지금 쓸 수 있는 모델을 한 번 찾아서 시도한다.
      if (isModelUnavailable(error) && index === candidates.length - 1 && !discoveryTried) {
        discoveryTried = true;
        const discovered = await discoverModel(options.apiKey).catch(() => null);
        if (discovered && !candidates.includes(discovered)) candidates.push(discovered);
      }
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
