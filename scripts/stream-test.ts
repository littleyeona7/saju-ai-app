/**
 * Gemini 스트리밍/파싱 계층 검증 (네트워크 없이 fetch 스텁 사용).
 * 실행: npx tsx --tsconfig tsconfig.app.json scripts/stream-test.ts
 */
import { GeminiError, streamGemini } from '../src/lib/gemini';
import { parseComparison } from '../src/components/ChoiceTab';

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

type Chunk = { text?: string; finishReason?: string };

function sseResponse(chunks: Chunk[], splitInMiddle = false): Response {
  const encoder = new TextEncoder();
  const payloads = chunks.map(
    (chunk) =>
      `data: ${JSON.stringify({
        candidates: [
          {
            content: { parts: chunk.text ? [{ text: chunk.text }] : [] },
            finishReason: chunk.finishReason,
          },
        ],
      })}\r\n\r\n`,
  );

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const payload of payloads) {
        if (splitInMiddle && payload.length > 20) {
          const cut = Math.floor(payload.length / 2);
          controller.enqueue(encoder.encode(payload.slice(0, cut)));
          controller.enqueue(encoder.encode(payload.slice(cut)));
        } else {
          controller.enqueue(encoder.encode(payload));
        }
      }
      controller.close();
    },
  });

  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function collect(options: Parameters<typeof streamGemini>[0]): Promise<string> {
  let text = '';
  for await (const chunk of streamGemini(options)) text += chunk;
  return text;
}

async function main() {
  const originalFetch = globalThis.fetch;
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;

  console.log('\n[1] 정상 스트리밍 (청크가 중간에서 잘려도 복원)');
  globalThis.setFetch((async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedInit = init;
    return sseResponse([{ text: '안녕하세요. ' }, { text: '연우 님의 ' }, { text: '사주입니다.' }, { finishReason: 'STOP' }], true);
  }) as typeof fetch);

  const text = await collect({
    apiKey: 'test-key',
    model: 'gemini-3.8-flash',
    systemInstruction: '시스템 지시',
    contents: [{ role: 'user', parts: [{ text: '안녕' }] }],
  });
  check('스트림 텍스트 결합', text === '안녕하세요. 연우 님의 사주입니다.', text);
  check('엔드포인트에 모델·sse 포함', capturedUrl.includes('gemini-3.8-flash:streamGenerateContent') && capturedUrl.includes('alt=sse'));
  check('API 키를 헤더로 전송', JSON.stringify(capturedInit?.headers).includes('test-key'));
  const body = JSON.parse(String(capturedInit?.body));
  check('systemInstruction 포함', body.systemInstruction?.parts?.[0]?.text === '시스템 지시');
  check('contents role 매핑', body.contents?.[0]?.role === 'user');
  check('thinkingLevel low (flash)', body.generationConfig?.thinkingConfig?.thinkingLevel === 'low');
  check('출력 한도 8192 (사고 토큰 여유)', body.generationConfig?.maxOutputTokens === 8192);
  check('3.x에는 temperature 미전송', body.generationConfig?.temperature === undefined);

  console.log('\n[2] API 키 오류 메시지');
  globalThis.setFetch((async () =>
    jsonResponse(400, { error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } })) as typeof fetch);
  let keyError: unknown = null;
  try {
    await collect({ apiKey: 'bad', model: 'gemini-3.8-flash', contents: [{ role: 'user', parts: [{ text: 'x' }] }] });
  } catch (error) {
    keyError = error;
  }
  check('GeminiError 로 변환', keyError instanceof GeminiError);
  check('한국어 안내 문구', keyError instanceof GeminiError && keyError.message.includes('API 키가 올바르지 않습니다'));
  check('힌트 제공', keyError instanceof GeminiError && keyError.hint.length > 0);

  console.log('\n[3] 모델 404 → 대체 모델 자동 재시도');
  const models: string[] = [];
  globalThis.setFetch((async (input: RequestInfo | URL) => {
    const url = String(input);
    const match = url.match(/models\/([^:]+):/);
    const model = match ? decodeURIComponent(match[1]) : '';
    models.push(model);
    if (model === 'gemini-3.8-flash') {
      return jsonResponse(404, { error: { code: 404, message: 'model not found' } });
    }
    return sseResponse([{ text: '대체 모델 응답' }, { finishReason: 'STOP' }]);
  }) as typeof fetch);

  let usedModel = '';
  let fallbackText = '';
  for await (const chunk of streamGemini({
    apiKey: 'k',
    model: 'gemini-3.8-flash',
    contents: [{ role: 'user', parts: [{ text: 'x' }] }],
    onModelUsed: (model) => {
      usedModel = model;
    },
  })) {
    fallbackText += chunk;
  }
  check('404 후 다음 모델로 재시도', models.length === 2 && models[1] === 'gemini-3.6-flash', models.join(','));
  check('대체 모델의 답변 수신', fallbackText === '대체 모델 응답');
  check('사용한 모델 보고', usedModel === 'gemini-3.6-flash', usedModel);

  console.log('\n[3-1] 400 "no longer available" 도 대체 모델로 넘어간다');
  const retiredModels: string[] = [];
  globalThis.setFetch((async (input: RequestInfo | URL) => {
    const url = String(input);
    const match = url.match(/models\/([^:]+):/);
    const model = match ? decodeURIComponent(match[1]) : '';
    retiredModels.push(model);
    if (model === 'gemini-3.8-flash') {
      return jsonResponse(400, {
        error: {
          code: 400,
          message: 'This model models/gemini-3.8-flash is no longer available. Please update your code to use models/gemini-3.6-flash.',
          status: 'INVALID_ARGUMENT',
        },
      });
    }
    return sseResponse([{ text: '단종 안내 후 대체 응답' }, { finishReason: 'STOP' }]);
  }) as typeof fetch);

  let retiredText = '';
  for await (const chunk of streamGemini({
    apiKey: 'k',
    model: 'gemini-3.8-flash',
    contents: [{ role: 'user', parts: [{ text: 'x' }] }],
  })) {
    retiredText += chunk;
  }
  check('단종(400) 후 대체 모델 재시도', retiredModels.length === 2 && retiredModels[1] === 'gemini-3.6-flash', retiredModels.join(','));
  check('대체 모델 답변 수신', retiredText === '단종 안내 후 대체 응답', retiredText);

  console.log('\n[3-2] thinkingLevel 거부(400) 시 thinkingConfig 없이 재시도');
  const thinkingBodies: Record<string, unknown>[] = [];
  globalThis.setFetch((async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as { generationConfig?: Record<string, unknown> };
    thinkingBodies.push(body.generationConfig ?? {});
    if (body.generationConfig?.thinkingConfig) {
      return jsonResponse(400, { error: { code: 400, message: 'thinking_level is not supported for this model', status: 'INVALID_ARGUMENT' } });
    }
    return sseResponse([{ text: 'thinking 없이 응답' }, { finishReason: 'STOP' }]);
  }) as typeof fetch);

  let noThinkingText = '';
  for await (const chunk of streamGemini({
    apiKey: 'k',
    model: 'gemini-3.8-flash',
    contents: [{ role: 'user', parts: [{ text: 'x' }] }],
  })) {
    noThinkingText += chunk;
  }
  check('thinkingConfig 포함 → 거부 → 제외 재시도', thinkingBodies.length === 2 && Boolean(thinkingBodies[0].thinkingConfig) && !thinkingBodies[1].thinkingConfig);
  check('thinking 제외 후 답변 수신', noThinkingText === 'thinking 없이 응답', noThinkingText);

  console.log('\n[3-3] 정적 목록이 모두 실패하면 ListModels로 찾은 모델 사용');
  const listed: string[] = [];
  globalThis.setFetch((async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/models?')) {
      return jsonResponse(200, {
        models: [
          { name: 'models/gemini-3.9-flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-4-carbon', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-3.8-flash-tts', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-3.8-flash', supportedGenerationMethods: [] },
        ],
      });
    }
    const match = url.match(/models\/([^:]+):/);
    const model = match ? decodeURIComponent(match[1]) : '';
    listed.push(model);
    if (['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'].includes(model)) {
      return jsonResponse(404, { error: { code: 404, message: 'model not found' } });
    }
    return sseResponse([{ text: `발견한 모델(${model}) 응답` }, { finishReason: 'STOP' }]);
  }) as typeof fetch);

  let discoveredText = '';
  for await (const chunk of streamGemini({
    apiKey: 'k',
    model: 'gemini-3.8-flash',
    contents: [{ role: 'user', parts: [{ text: 'x' }] }],
  })) {
    discoveredText += chunk;
  }
  check('정적 3개 실패 후 ListModels 호출', listed.length === 4, listed.join(','));
  check('TTS·비지원 모델은 건너뛰고 최신 Flash 선택', discoveredText === '발견한 모델(gemini-3.9-flash) 응답', discoveredText);

  console.log('\n[4] 429 한도 초과');
  globalThis.setFetch((async () =>
    jsonResponse(429, { error: { code: 429, message: 'Resource has been exhausted', status: 'RESOURCE_EXHAUSTED' } })) as typeof fetch);
  let rateError: unknown = null;
  try {
    await collect({ apiKey: 'k', model: 'gemini-3.8-flash', contents: [{ role: 'user', parts: [{ text: 'x' }] }] });
  } catch (error) {
    rateError = error;
  }
  check('429 → 사용량 초과 안내', rateError instanceof GeminiError && rateError.status === 429);
  check('429 힌트', rateError instanceof GeminiError && /무료 사용량|잠시 뒤/.test(rateError.hint));

  console.log('\n[5] A/B 비교 응답 구획 파싱');
  const full = `[[A]]
### A안: 이직
**오행·십신·합충 변화**: 식상이 강해진다.
**1·3·5년 흐름**:
- 1년 차: 적응기
- 3년 차: 성장
- 5년 차: 안정
**얻는 것**:
- 성장
**리스크**:
- 불안정

[[B]]
### B안: 유지
**오행·십신·합충 변화**: 관성이 유지된다.
**얻는 것**:
- 안정
**리스크**:
- 정체

[[C]]
### 종합 조언
움직이되 준비하고 움직이라.
**지금 움직일까, 기다릴까**: 내년 봄이 좋다.`;
  const parsed = parseComparison(full, true);
  check('A 구획 분리', parsed.a.startsWith('**오행') && parsed.a.includes('불안정') && !parsed.a.includes('B안'));
  check('B 구획 분리', parsed.b.includes('관성이 유지') && !parsed.b.includes('종합 조언'));
  check('C 구획 분리', parsed.c.includes('내년 봄') && parsed.c.includes('움직이되') && !parsed.c.includes('[[C]]'));
  check('마커 인식', parsed.hasMarkers);

  const partial = '[[A]]\n### A안: 이직\n**오행·십신';
  const partialParsed = parseComparison(partial, false);
  check('스트리밍 중 부분 응답 처리', partialParsed.a.includes('오행') && partialParsed.b === '' && partialParsed.c === '');

  const plain = parseComparison('마커 없이 답한 경우', true);
  check('마커 없으면 전체를 A로', plain.hasMarkers === false && plain.a === '마커 없이 답한 경우');

  globalThis.setFetch(originalFetch);
  console.log(`\n결과: ${passed}개 통과, ${failed}개 실패\n`);
  if (failed > 0) process.exit(1);
}

// fetch 스텁 교체 헬퍼
(globalThis as unknown as { setFetch: (fn: typeof fetch) => void }).setFetch = (fn) => {
  globalThis.fetch = fn;
};

main().catch((error) => {
  console.error('테스트 실행 실패:', error);
  process.exit(1);
});
