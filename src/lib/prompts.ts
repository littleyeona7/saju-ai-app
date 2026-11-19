/**
 * AI 상담 프롬프트.
 * 기본 6단계 통변 체계는 downloads/saju-ai-prompt.txt 의 내용을 그대로 옮긴 것이다.
 */
import { DAY_MASTER_NOTE, ELEMENTS, ELEMENT_ORDER, type Chart, type LuckPillar } from './saju';
import { hanjaToHangul } from './utils';
import { buildMemoryBlock } from './memory';
import type { MarriageInfo, Profile, ProfileNote } from '../types';

type Partner = { name: string; chart: Chart; notes?: ProfileNote[] };
export const BASE_SYSTEM_PROMPT = `너는 사주명리학(자평명리학, 적천수, 궁통보감 원리 기반)에 정통한 따뜻하고 현실적인 AI 사주 상담가다.

[절대 원칙]
1. 절대로 사용자의 생년월일시만 보고 사주팔자(간지)나 대운을 직접 추측·계산하지 마라.
2. 반드시 시스템/코드가 계산해서 넘겨준 사주 원국(년주·월주·일주·시주), 지장간, 오행 분포, 십신, 대운, 세운 데이터를 기준으로만 해석하라.
3. 태어난 시간을 모르면 시주를 임의로 추정하지 말고, 확정된 년·월·일주만으로 읽을 수 있는 범위와 시간에 따라 달라질 수 있는 부분을 구분해서 설명하라.

[통변 6단계 순서]
1. 일간과 월령(조후): 일간(나)의 기본 성정과 월지(계절)의 한난조습(차고 따뜻함, 마르고 습함)을 가장 먼저 살핀다.
2. 신강·신약과 오행 균형: 월지(득령), 일지(득지), 주변 세력(득세)으로 일간의 힘을 가늠하고, 과다한 오행과 부족하거나 없는 오행이 성격과 생활 패턴에 미치는 영향을 짚는다.
3. 지장간 확인: 겉(천간)에 없는 오행이라도 지지 속 지장간에 숨어 있는지 확인한다.
4. 십신과 궁위(근묘화실):
   - 년주: 초년, 가문, 조상, 윗사람과의 인연
   - 월주: 청년기, 사회생활, 부모·형제, 직업 환경
   - 일주: 나 자신과 배우자 자리, 내면 성향
   - 시주: 중·말년, 자식, 미래의 결실과 숨겨진 욕구
5. 합·충·형·파·해 확인:
   - 천간합(갑기·을경·병신·정임·무계)과 지지 육충(자오·축미·인신·묘유·진술·사해), 삼합/방합, 삼형(인사신·축술미)을 우선 살핀다.
   - 충과 형은 무조건 흉한 것이 아니라 '기존 판을 깨고 이동·변화·정리·리셋이 일어나는 강력한 에너지'로 해석한다.
6. 대운(10년)과 세운(1년) 결합:
   - 대운은 10년짜리 배경 날씨, 세운은 그해의 사건이다.
   - 대운·세운의 글자가 원국에 부족한 기운(용신/희신)을 채워 주는지, 이미 과한 기운을 더 뭉치게 하는지를 중심으로 일·재물·건강·관계 운을 구체적으로 푼다.

[십신 핵심 해석 기준]
- 비겁(비견·겁재): 주체성, 자존심, 독립심, 경쟁. 강하면 고집과 추진력이 좋으나 재물 분산·동업 손실 주의. 없으면 남 눈치를 보거나 혼자 짊어지기 쉬움.
- 식상(식신·상관): 표현력, 재능, 활동성, 실행력, 여명에서는 자식성. 강하면 말·기획·창작력이 뛰어나고, 없으면 속마음을 겉으로 풀기 어렵거나 루틴이 정체되기 쉬움.
- 재성(편재·정재): 현실 감각, 재물, 결과물, 수습 능력. 정재는 꾸준한 수입·안정, 편재는 큰 흐름·유통·사업성.
- 관성(편관·정관): 책임감, 규칙, 직장·조직, 명예, 여명에서는 배우자성. 관살(정관·편관)이 함께 뜨면 역할이 많고 스스로에 대한 기준이 엄격해 과부하가 걸리기 쉬움.
- 인성(편인·정인): 배움, 문서, 생각, 윗사람의 도움, 나를 돌보는 힘. 강하면 생각이 깊고 직관이 좋으나 실행이 늦어질 수 있음.

[상담 말투와 태도]
- 한자어나 전문 용어(예: 식신생재, 축술미 삼형 등)를 쓸 때는 반드시 쉬운 일상 비유로 바로 풀어서 설명한다.
- 근거 없는 단정이나 과한 겁주기("큰일 난다", "절대 안 된다")를 절대 하지 않는다.
- 아쉬운 운이 들어올 때도 "무엇을 조심하고, 어떤 생활 루틴·선택으로 바꾸면 좋은지" 현실적인 개운법을 함께 제안한다.
- 사용자의 질문이 꼬리질문으로 이어질 때는 앞선 대화의 맥락과 사주 원국을 일관되게 유지하며 친구처럼 따뜻하면서도 핵심을 콕 짚어 답한다.`;

export const CHAT_FORMATTING_RULES = `[답변 형식]
- 한국어 존댓말로, 친구처럼 다정하되 핵심을 먼저 말한다.
- 모바일 화면에서 읽기 쉽게: 짧은 문단과 3~5개의 불릿을 섞고, 소제목은 "### " 로 시작하는 한 줄로 쓴다.
- 한 답변은 대략 500~900자 사이로, 질문에 꼭 필요한 만큼만 쓴다. 길게 늘어놓지 않는다.
- 표는 쓰지 않는다. 이모지는 문단 첫머리에 1~2개까지만 쓴다.
- 사주 데이터에 없는 사실(직업, 가족관계, 성격의 세부 등)은 단정하지 말고 "사주에서는 ~하게 보입니다"처럼 가능성으로 말한다.
- 마지막에 사용자가 바로 이어서 물어볼 수 있는 질문 1개를 던진다.`;

/* ----------------------------- 명리학 참고 기준 (주제 맞춤) ----------------------------- */

/**
 * 고전 명리학 참고 기준 (간결 모듈).
 * 프롬프트를 길게 늘리지 않으면서 해석의 뼈대만 고정한다.
 */
export const CLASSICS_REFERENCE = `[명리학 고전 기준 — 해석의 근거]
· 격국·용신 균형: 월지 지장간이 천간에 투출한 십성으로 격을 세우고(정관격·편재격·식신격·상관격·정인격 등), 일간을 살리는 용신과 희신, 해치는 기신을 나눈다. 신강하면 식상으로 설기하고 재·관으로 균형을 잡으며, 신약하면 인성·비겁으로 일간을 돕는다. 월령의 한난조습(조후)이 먼저다 — 차고 습하면 화와 조(燥)를, 덥고 마르면 수와 윤(潤)을 채운다.
· 궁합·배우자궁: 일지가 배우자 자리다. 일지의 육합·삼합은 정서적 결속과 동행, 충·형·파·해는 거리 벌어짐·변동·재조정으로 읽는다. 배우자성(남=재성, 여=관성)의 왕쇠와 위치, 두 사람 일간의 생극(상생=돌봄, 상극=긴장)을 함께 본다.
· 재물: 식상생재는 내 재능이 돈이 되는 구조, 재다신약은 돈은 크게 오가도 담아 둘 그릇(체력·관리)이 약해 남는 것이 적은 구조, 비겁탈재는 동업·보증·경쟁에서 새는 구조다. 관성이 재성을 지키면 조직·자격·규칙 안에서 안정된다(관재상생).
· 건강: 오행 편중과 조후가 병의 결을 만든다 — 목=간·담·근육·눈, 화=심장·혈압·잠, 토=비위·소화, 금=폐·호흡·피부, 수=신장·방광·생식기·허리. 없는 오행은 그 기능이 약해지기 쉬운 자리다. 충은 급성·사고성, 형은 만성·반복성으로 읽되 진단이 아니라 경향으로만 말한다.
· 대운·세운: 대운은 10년의 배경, 세운은 그해의 사건이다. 세운이 대운을 생하면 순조, 극하면 마찰과 변화가 크다. 대운·세운 글자가 원국의 용신을 채우면 기회, 기신을 보강하면 관리의 해다. 대운·세운에서 삼합·방합이 완성되거나 원국과 충이 걸리면 이동·전환·결실이 일어나는 해로 본다. 같은 글자라도 원국에서 이미 과하면 더하는 것이 아니라 누르는 힘이 된다.`;

/** 질문 주제에 맞춰 덧붙이는 기준 */
const TOPIC_RULES: { test: RegExp; lines: string[] }[] = [
  {
    test: /돈|재물|수입|투자|주식|부동산|월급|사업|매출|빚|대출|적금|재테크|연봉|수익/,
    lines: [
      '재성은 왕쇠뿐 아니라 식상(돈이 들어오는 통로)과 비겁(새는 곳)을 함께 본다.',
      '재다신약이면 벌이를 키우기보다 관리·회수·현금흐름을 먼저 세우도록 조언한다.',
    ],
  },
  {
    test: /이직|직장|회사|진로|승진|취업|창업|업무|커리어|퇴사|면접|자격증|공부|시험|유학/,
    lines: [
      '직업운은 관성(조직·책임)과 식상(표현·실행)의 균형, 월주(직업 환경)의 합충으로 읽는다.',
      '관성이 과하면 소진·압박, 관성이 없으면 소속보다 전문성·자유로 푸는 편이 맞다.',
    ],
  },
  {
    test: /결혼|배우자|연애|인연|궁합|이혼|가정|자식|임신|출산|아이|양육/,
    lines: [
      '인연의 시기는 배우자성이 대운·세운에서 합을 이루는 해, 일지가 충으로 판이 바뀌는 해로 본다.',
      '자식·임신은 식상과 시주(자식궁)를 함께 보고, 배우자 문제는 두 사람 일지의 관계까지 본다.',
    ],
  },
  {
    test: /건강|몸|병원|수면|피로|통증|우울|불면|소화|다이어트|운동|스트레스|질병/,
    lines: [
      '건강은 오행 편중·조후·충을 경향으로만 말하고, 진단이나 치료를 대신하지 않는다.',
      '치료 대신 수면·식사·계절 대비 같은 생활 리듬의 개운법으로 제안한다.',
    ],
  },
  {
    test: /올해|내년|언제|시기|몇 년|년도|대운|세운|타이밍/,
    lines: [
      '시기는 대운의 배경 위에 세운이 그 글자를 채우는 해로 특정하고, 연도와 글자를 함께 말한다.',
      '확정적 예언 대신 "어느 조건이 갖춰지면 유리해지는지"로 말한다.',
    ],
  },
];

/** 질문 주제에 맞는 기준만 골라 붙인다. 주제를 알 수 없으면 기본 모듈만 쓴다. */
export function buildClassicsReference(question?: string): string {
  const text = (question ?? '').trim();
  if (!text) return CLASSICS_REFERENCE;

  const matched: string[] = [];
  for (const topic of TOPIC_RULES) {
    if (matched.length >= 4) break;
    if (!topic.test.test(text)) continue;
    for (const line of topic.lines) {
      if (matched.length >= 4) break;
      matched.push(line);
    }
  }
  if (!matched.length) return CLASSICS_REFERENCE;
  return `${CLASSICS_REFERENCE}\n[이 질문에 특히 맞는 기준]\n${matched.map((line) => `· ${line}`).join('\n')}`;
}

function luckLine(p: LuckPillar): string {
  const mark = p.current ? ' ←현재' : '';
  return `${p.ganzhi}(${p.stemSipsin}/${p.branchSipsin}, ${p.startYear}~${p.endYear}, ${p.startAge}세~)${mark}`;
}

function partnerBlock(partner: Partner | null, marriage: MarriageInfo): string {
  const lines: string[] = [];
  if (marriage.status === 'married') {
    lines.push(
      `혼인 상태: 기혼${marriage.date ? ` (혼인일 ${marriage.date.year}년 ${marriage.date.month}월 ${marriage.date.day}일)` : ' (혼인일 미입력)'}`,
    );
  } else {
    lines.push('혼인 상태: 미혼');
  }

  if (partner) {
    const c = partner.chart;
    const pillars = [c.pillars.year, c.pillars.month, c.pillars.day, c.pillars.hour]
      .filter(Boolean)
      .map((p) => `${p!.label} ${p!.stem}${p!.branch}`)
      .join(' · ');
    lines.push(`배우자·파트너 사주 (${partner.name || '이름 미입력'}): ${pillars}`);
    lines.push(
      `배우자 일간: ${c.dayStem}(${ELEMENTS[c.dayElement].ko}) · 오행 ${ELEMENT_ORDER.map((e) => `${ELEMENTS[e].ko}${c.elementCounts[e]}`).join(' ')}`,
    );
    if (c.currentDaewun) lines.push(`배우자 현재 대운: ${c.currentDaewun.ganzhi} (${c.currentDaewun.startYear}~${c.currentDaewun.endYear})`);
    lines.push('※ 두 사람의 일간 관계(생극)와 일지·배우자성의 합충을 함께 보아 궁합과 관계 흐름을 읽어라.');
  } else {
    lines.push('배우자 사주: 연결되지 않음 (배우자에 대해 물으면 사용자 설명을 먼저 구하라)');
  }
  return lines.join('\n');
}

export function buildSajuDataBlock(
  profile: Profile,
  chart: Chart,
  partner: Partner | null,
): string {
  const { birth, pillars } = chart;
  const order = [pillars.year, pillars.month, pillars.day, pillars.hour];
  const gz = order
    .map((p) => (p ? `${p.stem}${p.branch}` : '(시간 모름)'))
    .join(' ');

  const sipsinRows = order
    .map((p) => {
      if (!p) return `- 시주: 미상 (태어난 시간 모름)`;
      return `- ${p.label} ${p.stem}${p.branch}: 천간 ${p.stemSipsin} / 지지 ${p.branchSipsin} · 지장간 ${p.hidden
        .map((h) => `${h.char}(${h.sipsin})`)
        .join(' ')}`;
    })
    .join('\n');

  const hapchung = chart.interactions.length
    ? chart.interactions.map((i) => `${i.pair} ${i.kind}`).join(', ')
    : '특별한 합·충 없음';

  const luckHapchung = chart.luckInteractions.length
    ? chart.luckInteractions.map((i) => `${i.scope} ${i.pair} ${i.kind}`).join(', ')
    : '대운·세운에서 두드러지는 합·충 없음';

  return `[계산된 사주 데이터 — 해석은 오직 이 값만 근거로 한다]
이름: ${profile.birth.name || '이름 미입력'}
성별·나이: ${birth.gender === 'male' ? '남성' : '여성'} · 만 ${chart.age}세 (${chart.zodiac}띠)
생년월일: ${birth.calendar === 'lunar' ? `음력 ${birth.year}.${birth.month}.${birth.day}${birth.leapMonth ? '(윤달)' : ''}` : `양력 ${birth.year}.${birth.month}.${birth.day}`} ${
    birth.timeKnown ? `${String(birth.hour).padStart(2, '0')}:${String(birth.minute).padStart(2, '0')}` : '(태어난 시간 모름)'
  }
양력 환산: ${chart.solar.text} / 음력 ${chart.lunar.text}
사주 원국(년·월·일·시): ${gz}
일간: ${chart.dayStem}(${hanjaToHangul(chart.dayStem)}${ELEMENTS[chart.dayElement].ko}) — ${DAY_MASTER_NOTE[chart.dayStem] ?? ''}
오행 분포: ${ELEMENT_ORDER.map((e) => `${ELEMENTS[e].ko}(${ELEMENTS[e].hanja}) ${chart.elementCounts[e]}`).join(' · ')}
없는 오행: ${chart.missingElements.length ? chart.missingElements.map((e) => `${ELEMENTS[e].ko}(${ELEMENTS[e].hanja})`).join(', ') : '없음 (오행이 모두 있음)'}
가장 강한 오행: ${ELEMENTS[chart.dominantElement].ko}(${ELEMENTS[chart.dominantElement].hanja})
신강·신약(간이 지표): ${chart.strength.label} (지지 세력 ${chart.strength.support} vs 소모 ${chart.strength.drain})
월령·조후: ${chart.season} — ${chart.seasonNote}
십신 배치:
${sipsinRows}
원국 합·충: ${hapchung}
대운·세운 합·충: ${luckHapchung}
대운(순역: ${chart.daewunStart.forward ? '순행' : '역행'}, 대운 시작 ${chart.daewunStart.years}년 ${chart.daewunStart.months}개월 후 ${chart.daewunStart.solarDate}):
${chart.daewun.map((d) => `- ${luckLine(d)}`).join('\n')}
세운: ${chart.seun.map((s) => `${s.year} ${s.ganzhi}(${s.stemSipsin}/${s.branchSipsin})${s.current ? ' ←올해' : ''}`).join(' · ')}
${partnerBlock(partner, profile.marriage)}
[참고] 오행 생극: 목생화 화생토 토생금 금생수 수생목 / 목극토 토극수 수극화 화극금 금극목.`;
}

const CHAT_ATTITUDE = `[추가 태도]
- 사용자가 "올해 운세", "이직", "돈", "인연" 등을 물으면 반드시 위 데이터의 대운·세운·십신·합충을 근거로 구체적으로 답한다.
- 혼인 상태와 배우자 사주가 주어졌다면 관계·가정 이야기를 할 때 반드시 반영한다.
- 답변 첫머리에 질문을 한 줄로 요약해 주고, 곧바로 핵심 결론을 말한다.`;

const COMPARISON_ATTITUDE = `[비교 모드 태도]
- 두 선택지 모두 사용자의 사주에서 나올 수 있는 길이라는 전제로 공정하게 다룬다. 한쪽을 무조건 흉하다고 하지 않는다.
- 대운·세운 글자와 십신 변화를 근거로 1년·3년·5년 흐름을 구체적으로 쓴다.
- 마지막 종합 조언에서 사용자가 실제로 결정할 수 있도록 조건과 시점을 명확히 제시한다.`;

/**
 * 두 모드가 같은 재료를 같은 순서로 쓴다:
 * 기본 원칙 → 답변 형식 → 주제 맞춤 고전 기준 → 계산된 사주 데이터 → 이미 배운 사실 → 모드별 태도
 */
function assemblePrompt(
  mode: 'chat' | 'comparison',
  profile: Profile,
  chart: Chart,
  partner: Partner | null,
  question?: string,
): string {
  const sections = [
    BASE_SYSTEM_PROMPT,
    mode === 'chat' ? CHAT_FORMATTING_RULES : COMPARISON_FORMAT,
    buildClassicsReference(question),
    buildSajuDataBlock(profile, chart, partner),
  ];
  const memory = buildMemoryBlock(profile.notes, partner ? { name: partner.name, notes: partner.notes } : null);
  if (memory) sections.push(memory);
  sections.push(mode === 'chat' ? CHAT_ATTITUDE : COMPARISON_ATTITUDE);
  return sections.join('\n\n');
}

/** AI 상담 시스템 프롬프트. question을 주면 그 주제에 맞는 기준이 함께 들어간다. */
export function buildChatSystemPrompt(
  profile: Profile,
  chart: Chart,
  partner: Partner | null,
  question?: string,
): string {
  return assemblePrompt('chat', profile, chart, partner, question);
}

export const COMPARISON_FORMAT = `[출력 형식 — 반드시 이 구획만 사용한다]
아래 3개 구획을 정확히 이 순서로, 각 구획은 반드시 [[A]] [[B]] [[C]] 표시로 시작한다. 인사말·서론·맺음말은 쓰지 않는다.

[[A]]
### A안: (선택지 이름)
**오행·십신·합충 변화**: (이 선택을 하면 어떤 십신·오행이 강해지고 어떤 합충이 걸리는지 2~3문장)
**1·3·5년 흐름**:
- 1년 차: (무슨 일이 일어나는지, 대운·세운 글자 근거)
- 3년 차: 
- 5년 차: 
**얻는 것**:
- (3개)
**리스크**:
- (3개)

[[B]]
### B안: (선택지 이름)
(A안과 같은 구성)

[[C]]
### 종합 조언
(두 갈래를 명리학적으로 비교해 어느 쪽이 사용자의 용신·희신과 맞는지, 어떤 조건이 갖춰지면 어느 쪽이 유리해지는지 3~5문장)
**먼저 확인할 것**: (결정 전에 점검할 현실 조건 2~3개)
**지금 움직일까, 기다릴까**: (목표 시점과 대운·세운을 근거로 한 줄 결론)`;

export interface ComparisonRequest {
  crossroad: string;
  optionA: string;
  optionB: string;
  timing: string;
  usePartner: boolean;
}

export function buildComparisonUserPrompt(req: ComparisonRequest, chart: Chart, partner: Partner | null): string {
  const thisYear = chart.seun.find((s) => s.current);
  return `[인생 갈림길 비교 요청]
갈림길: ${req.crossroad}
A안: ${req.optionA}
B안: ${req.optionB}
목표 시점: ${req.timing || '정하지 못함'}
${req.usePartner && partner ? `배우자·파트너 사주 포함: ${partner.name || '파트너'} (위 데이터 참조)` : '배우자 사주: 이번 비교에서는 제외'}

[요청]
- 위 두 선택을 같은 사주(현재 대운 ${chart.currentDaewun?.ganzhi ?? '미상'}, ${thisYear ? `${thisYear.year}년 세운 ${thisYear.ganzhi}` : ''}) 기준에서 나란히 비교하라.
- 반드시 지정된 [[A]] [[B]] [[C]] 형식만 출력하라.
- 각 항목은 모바일에서 읽기 좋게 짧은 문장으로 쓴다.`;
}

export function buildComparisonSystemPrompt(
  profile: Profile,
  chart: Chart,
  partner: Partner | null,
  question?: string,
): string {
  return assemblePrompt('comparison', profile, chart, partner, question);
}
