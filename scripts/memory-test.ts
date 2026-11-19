/**
 * 상담 피드백 자동 기억(Auto-learning Memory) 검증.
 * 실행: npm run test:memory
 *
 * - 기억 저장·병합·중복 제거·상한
 * - 프롬프트 주입(본인·배우자) 과 명리학 참고 기준(주제 맞춤)
 * - Gemini 추출 호출(모델 선택·실패 폴백·0~2개 제한) — 네트워크는 fetch 스텁
 */
import {
  CLASSICS_REFERENCE,
  buildChatSystemPrompt,
  buildClassicsReference,
  buildComparisonSystemPrompt,
} from '../src/lib/prompts';
import {
  MAX_NOTES,
  MAX_NOTES_PER_EXCHANGE,
  MAX_NOTE_LENGTH,
  NOTE_MODEL,
  buildMemoryBlock,
  extractProfileNotes,
  isDuplicateNote,
  makeNotes,
  mergeNotes,
  normalizeNoteText,
  noteSimilarity,
  parseNotesResponse,
  removeNote,
  sanitizeNotes,
  shouldExtractNotes,
} from '../src/lib/memory';
import { loadProfiles, saveProfiles } from '../src/lib/storage';
import { buildChart } from '../src/lib/saju';
import type { Profile, ProfileNote } from '../src/types';

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

const store = new Map<string, string>();
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear(),
  key: (index: number) => Array.from(store.keys())[index] ?? null,
  get length() {
    return store.size;
  },
};

function note(text: string, id = text.slice(0, 8), createdAt = '2026-11-01T00:00:00.000Z'): ProfileNote {
  return { id, text, createdAt };
}

const baseProfile: Profile = {
  id: 'p1',
  birth: {
    name: '최연우',
    calendar: 'solar',
    year: 1985,
    month: 7,
    day: 19,
    leapMonth: false,
    timeKnown: true,
    hour: 19,
    minute: 35,
    gender: 'female',
  },
  marriage: { status: 'married', date: { year: 2015, month: 5, day: 20 }, partnerProfileId: null, partnerManual: null },
  notes: [note('2015년 5월에 결혼했고 배우자와 함께 산다.', 'n1')],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const chart = buildChart(baseProfile.birth);

function textResponse(text: string, status = 200): Response {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }),
    { status, headers: { 'Content-Type': 'application/json' } },
  );
}

const originalFetch = globalThis.fetch;

async function main() {
  console.log('\n[1] 문장 정규화와 유사도');
  check('불릿·따옴표·중복 공백 제거', normalizeNoteText('- "  회계법인에   다닌다. " ') === '회계법인에 다닌다.');
  check('같은 문장은 유사도 1', noteSimilarity('2015년 결혼', '2015년 결혼') === 1);
  check(
    '조사만 다른 문장은 중복으로 본다',
    isDuplicateNote('2015년 5월에 결혼했고 배우자와 함께 산다', [note('2015년 5월에 결혼했고 배우자와 함께 산다.')]),
  );
  check(
    '조사만 달라도 같은 사실이면 중복',
    isDuplicateNote('2027년 이직을 준비 중이다', [note('2027년에 이직을 준비하고 있다')]),
  );
  check(
    '전혀 다른 사실은 중복이 아니다',
    !isDuplicateNote('고양이 두 마리를 키운다', [note('2015년 5월에 결혼했고 배우자와 함께 산다.')]),
  );
  check(
    '짧은 숫자 문장은 엉뚱하게 합치지 않는다',
    !isDuplicateNote('2015년 결혼', [note('2015년 이직')]),
  );

  console.log('\n[2] 새 기억 만들기 — 0~2개 · 짧은 문장·중복 제외');
  const created = makeNotes(baseProfile.notes ?? [], [
    '2015년 5월에 결혼했고 배우자와 함께 산다.', // 이미 아는 사실
    '고양이 두 마리를 키운다.',
    '회계법인에서 12년째 일하고 있다.',
    '오늘은 기분이 좋다.', // 막연한 감정
    '세 번째 사실은 버려져야 한다.',
  ]);
  check(`한 번에 최대 ${MAX_NOTES_PER_EXCHANGE}개`, created.length === 2, String(created.length));
  check('이미 아는 사실은 새로 만들지 않는다', !created.some((n) => n.text.includes('결혼')));
  check('새 사실은 그대로 저장', created[0]?.text === '고양이 두 마리를 키운다.', created[0]?.text);
  check('id·createdAt가 붙는다', Boolean(created[0]?.id) && created[0]?.createdAt.includes('T'));
  const trimmed = makeNotes([], ['짧음']);
  check('너무 짧은 문장은 버린다', trimmed.length === 0);
  const longNote = makeNotes([], ['가'.repeat(300)]);
  check(`기억 한 줄은 ${MAX_NOTE_LENGTH}자로 자른다`, longNote[0]?.text.length === MAX_NOTE_LENGTH);

  console.log('\n[3] 병합 · 삭제 · 상한');
  const merged = mergeNotes(baseProfile.notes, [note('고양이 두 마리를 키운다.', 'n2')]);
  check('기존 기억 뒤에 새 기억이 붙는다', merged.length === 2 && merged[1].id === 'n2');
  const mergedDup = mergeNotes(baseProfile.notes, [note('2015년 5월에 결혼했고 배우자와 함께 산다', 'n3')]);
  check('병합할 때도 중복은 버린다', mergedDup.length === 1);
  const many = Array.from({ length: 60 }, (_, i) => note(`오래된 기록 ${i}번`, `m-${i}`));
  const capped = mergeNotes(many, []);
  check(`기억은 최근 ${MAX_NOTES}개만 남긴다`, capped.length === MAX_NOTES);
  check('상한을 넘으면 가장 오래된 것이 밀려난다', capped[capped.length - 1].id === 'm-59' && !capped.some((n) => n.id === 'm-0'));
  check('한 기억만 지운다', removeNote(merged, 'n2').length === 1);

  console.log('\n[4] 저장된 값 다듬기 (예전 버전·깨진 값)');
  const sanitized = sanitizeNotes([
    { id: 'a', text: '  결혼은 2015년  ', createdAt: '2026-01-01T00:00:00.000Z' },
    { text: '회사는 마곡에 있다' }, // id·createdAt 없음
    { id: 'c' }, // 텍스트 없음
    '문자열',
    null,
  ]);
  check('유효한 기억만 남는다', sanitized.length === 2, String(sanitized.length));
  check('공백을 정리한다', sanitized[0].text === '결혼은 2015년', sanitized[0].text);
  check('id·createdAt가 없으면 채운다', Boolean(sanitized[1].id) && sanitized[1].createdAt.includes('T'));
  check('배열이 아니면 빈 배열', sanitizeNotes('깨짐').length === 0 && sanitizeNotes(undefined).length === 0);

  store.clear();
  const legacy: Profile = { ...baseProfile, notes: undefined };
  saveProfiles([legacy]);
  check('기억이 없던 프로필도 그대로 불러온다', loadProfiles()[0].notes?.length === 0);
  saveProfiles([{ ...baseProfile, notes: sanitized }]);
  check('기억이 저장·복원된다', (loadProfiles()[0].notes ?? []).length === 2);

  console.log('\n[5] 프롬프트 주입');
  const memoryBlock = buildMemoryBlock(baseProfile.notes, {
    name: '배우자',
    notes: [note('초등학교 교사로 일한다.', 'p-n1')],
  });
  check('본인 기억이 들어간다', memoryBlock.includes('2015년 5월에 결혼'));
  check('배우자 기억도 들어간다', memoryBlock.includes('초등학교 교사'));
  check('그대로 읽지 말라는 지시가 붙는다', memoryBlock.includes('나열하거나') && memoryBlock.includes('새 말을 따르'));
  check('기억이 없으면 빈 문자열 (프롬프트를 키우지 않음)', buildMemoryBlock([], null) === '' && buildMemoryBlock(undefined) === '');

  const chatPrompt = buildChatSystemPrompt(baseProfile, chart, null);
  check('AI 상담 프롬프트에 기억이 들어간다', chatPrompt.includes('2015년 5월에 결혼'));
  check('AI 상담 프롬프트에 고전 기준이 들어간다', chatPrompt.includes('격국·용신'));
  check('AI 상담 프롬프트에 원국 데이터도 그대로', chatPrompt.includes('乙丑 癸未 己未 甲戌'));

  const partnerChart = buildChart({ ...baseProfile.birth, name: '배우자', gender: 'male', year: 1983 });
  const withPartner = buildChatSystemPrompt(baseProfile, chart, {
    name: '배우자',
    chart: partnerChart,
    notes: [note('초등학교 교사로 일한다.', 'p-n1')],
  });
  check('상담 프롬프트에 배우자 기억도 들어간다', withPartner.includes('초등학교 교사'));

  const comparisonPrompt = buildComparisonSystemPrompt(baseProfile, chart, null);
  check('A vs B 프롬프트에도 기억이 들어간다', comparisonPrompt.includes('2015년 5월에 결혼'));
  check('A vs B 프롬프트에 비교 형식이 남아 있다', comparisonPrompt.includes('[[A]]') && comparisonPrompt.includes('[[C]]'));

  const noMemoryPrompt = buildChatSystemPrompt({ ...baseProfile, notes: [] }, chart, null);
  check('기억이 없으면 주입 구획이 없다', !noMemoryPrompt.includes('[이미 배운 사실'));

  console.log('\n[6] 명리학 참고 기준 (주제 맞춤)');
  check('기본 모듈: 격국·용신', CLASSICS_REFERENCE.includes('격국·용신 균형'));
  check('기본 모듈: 궁합·배우자궁', CLASSICS_REFERENCE.includes('궁합·배우자궁'));
  check('기본 모듈: 재물(식상생재·재다신약)', CLASSICS_REFERENCE.includes('식상생재') && CLASSICS_REFERENCE.includes('재다신약'));
  check('기본 모듈: 건강(오행 편중)', CLASSICS_REFERENCE.includes('오행 편중'));
  check('기본 모듈: 대운·세운', CLASSICS_REFERENCE.includes('대운은 10년의 배경'));
  check('모듈은 간결하다 (3,000자 이하)', CLASSICS_REFERENCE.length < 3000, String(CLASSICS_REFERENCE.length));

  const career = buildClassicsReference('이직해도 될까?');
  check('직업 질문에는 직업 기준이 붙는다', career.includes('[이 질문에 특히 맞는 기준]') && career.includes('직업운은 관성'));
  check('직업 질문에는 재물 기준이 붙지 않는다', !career.includes('재다신약이면'));
  const money = buildClassicsReference('돈은 언제 들어와?');
  check('재물 질문에는 재물 기준이 붙는다', money.includes('식상(돈이 들어오는 통로)'));
  const health = buildClassicsReference('요즘 건강이 안 좋아');
  check('건강 질문에는 건강 기준이 붙는다', health.includes('진단이나 치료를 대신하지 않는다'));
  check('주제를 모르면 기본 모듈만', buildClassicsReference('안녕하세요') === CLASSICS_REFERENCE);

  const topicPrompt = buildChatSystemPrompt(baseProfile, chart, null, '올해 이직해도 될까?');
  check('질문 주제가 시스템 프롬프트에 반영된다', topicPrompt.includes('직업운은 관성'));

  console.log('\n[7] 추출 호출 — 모델·요청 본문');
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  (globalThis as unknown as { fetch: typeof fetch }).fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), body: JSON.parse(String(init?.body ?? '{}')) });
    return textResponse('["고양이 두 마리를 키운다.", "회계법인에서 12년째 일하고 있다."]');
  }) as typeof fetch;

  const learned = await extractProfileNotes({
    apiKey: 'k',
    model: 'gemini-3.8-flash',
    existing: baseProfile.notes ?? [],
    context: '최연우 · 여성 · 만 41세 · 일간 己',
    topic: 'AI 상담',
    question: '요즘 회사 일이 힘든데 이직할까?',
    answer: '지금 대운과 세운을 보면 움직이는 힘이 있습니다. '.repeat(3),
  });
  check('추출된 기억 2개를 돌려준다', learned.length === 2, String(learned.length));
  check('가벼운 모델을 먼저 쓴다', calls[0].url.includes(`${NOTE_MODEL}:generateContent`), calls[0].url);
  const body = calls[0].body as {
    systemInstruction?: { parts?: { text?: string }[] };
    generationConfig?: { responseMimeType?: string; responseSchema?: { type?: string }; maxOutputTokens?: number; thinkingConfig?: unknown };
    contents?: { parts?: { text?: string }[] }[];
  };
  check('추출 지시문을 시스템으로 보낸다', String(body.systemInstruction?.parts?.[0]?.text).includes('기존 기억'));
  check('JSON 배열 응답을 요구한다', body.generationConfig?.responseMimeType === 'application/json');
  check('응답 스키마는 문자열 배열', body.generationConfig?.responseSchema?.type === 'ARRAY');
  check('사고 토큰을 아껴 빠르게', Boolean(body.generationConfig?.thinkingConfig));
  check('기존 기억과 사주 요약이 입력에 들어간다', String(body.contents?.[0]?.parts?.[0]?.text).includes('2015년 5월에 결혼'));
  check('API 키는 헤더로만', !JSON.stringify(body).includes('"k"'));

  console.log('\n[8] 추출 호출 — 코드블록·중복·상한');
  (globalThis as unknown as { fetch: typeof fetch }).fetch = (async () =>
    textResponse('```json\n["2015년 5월에 결혼했고 배우자와 함께 산다.", "고양이 두 마리를 키운다.", "셋째 사실", "넷째 사실"]\n```')) as typeof fetch;
  const parsed = await extractProfileNotes({
    apiKey: 'k',
    existing: baseProfile.notes ?? [],
    question: '우리 집 고양이 이야기 해 줄까?',
    answer: '고양이는 사주에서 식상에 해당합니다. '.repeat(4),
  });
  check('코드블록이 섞여도 파싱한다', parsed.some((n) => n.text.includes('고양이')));
  check('이미 아는 사실은 다시 저장하지 않는다', !parsed.some((n) => n.text.includes('결혼')));
  check('2개를 넘지 않는다', parsed.length <= MAX_NOTES_PER_EXCHANGE, String(parsed.length));

  console.log('\n[9] 추출 호출 — 실패는 조용히 넘어간다 (상담에 영향 없음)');
  const fallbackModels: string[] = [];
  (globalThis as unknown as { fetch: typeof fetch }).fetch = (async (input: RequestInfo | URL) => {
    const model = decodeURIComponent(String(input).match(/models\/([^:]+):/)?.[1] ?? '');
    fallbackModels.push(model);
    if (model === NOTE_MODEL) return new Response('{"error":{"message":"not found"}}', { status: 404 });
    return textResponse('["주말마다 등산을 다닌다."]');
  }) as typeof fetch;
  const afterFallback = await extractProfileNotes({
    apiKey: 'k',
    model: 'gemini-3.8-flash',
    existing: [],
    question: '주말에 뭘 하면 좋을까?',
    answer: '토가 많은 사주라 몸을 쓰는 활동이 잘 맞습니다. '.repeat(3),
  });
  check('가벼운 모델이 404면 다음 모델로 넘어간다', fallbackModels.length === 2, fallbackModels.join(','));
  check('대체 모델의 기억을 받는다', afterFallback[0]?.text === '주말마다 등산을 다닌다.', afterFallback[0]?.text);

  let brokenCalls = 0;
  (globalThis as unknown as { fetch: typeof fetch }).fetch = (async () => {
    brokenCalls += 1;
    throw new Error('network down');
  }) as typeof fetch;
  const broken = await extractProfileNotes({
    apiKey: 'k',
    existing: [],
    question: '올해 운세 어때?',
    answer: '올해는 재성이 들어오는 해입니다. '.repeat(4),
  });
  check('모든 모델이 실패하면 빈 배열 (예외 없음)', broken.length === 0);
  check('모델 체인을 모두 시도한다', brokenCalls >= 2, String(brokenCalls));

  console.log('\n[10] 추출하지 않아야 할 때는 호출조차 하지 않는다');
  let skipCalls = 0;
  (globalThis as unknown as { fetch: typeof fetch }).fetch = (async () => {
    skipCalls += 1;
    return textResponse('[]');
  }) as typeof fetch;
  const shortAnswer = await extractProfileNotes({ apiKey: 'k', existing: [], question: '안녕', answer: '안녕하세요' });
  check('짧은 잡담에는 호출하지 않는다', shortAnswer.length === 0 && skipCalls === 0, String(skipCalls));
  const noKey = await extractProfileNotes({ apiKey: '', existing: [], question: '질문', answer: '가'.repeat(100) });
  check('키가 없으면 호출하지 않는다', noKey.length === 0 && skipCalls === 0);
  check('shouldExtractNotes: 긴 답변만', shouldExtractNotes('이직할까?', '가'.repeat(80)) && !shouldExtractNotes('이직할까?', '네'));

  console.log('\n[11] 응답 파싱 견고성');
  check('평범한 배열', parseNotesResponse('["a","b"]').length === 2);
  check('설명이 섞여도 배열만 뽑는다', parseNotesResponse('결과입니다: ["a"] 입니다').length === 1);
  check('{"notes": [...]} 형태도 받는다', parseNotesResponse('{"notes":["a"]}').length === 1);
  check('배열이 아니면 빈 배열', parseNotesResponse('없습니다').length === 0 && parseNotesResponse('').length === 0);
  check('숫자·null은 버린다', parseNotesResponse('["a", 1, null]').length === 1);

  (globalThis as unknown as { fetch: typeof fetch }).fetch = originalFetch;
  console.log(`\n결과: ${passed}개 통과, ${failed}개 실패\n`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error('테스트 실행 실패:', error);
  process.exit(1);
});
