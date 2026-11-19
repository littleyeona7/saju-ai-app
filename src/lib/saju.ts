/**
 * 만세력(사주) 계산 엔진.
 *
 * - 절기/음양력 변환은 lunar-javascript(6tail)의 검증된 만세력 계산을 사용한다.
 * - 오행·십신·지장간·합충·신강약·대운·세운은 이 파일에서 계산해 화면과 AI 프롬프트에 함께 쓴다.
 * - AI에게는 절대 스스로 간지를 추측하지 말고 이 계산 결과만 쓰라고 지시한다.
 */
import LunarJS from 'lunar-javascript';
import type { BirthInput, CalendarType, Gender } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Solar, Lunar } = LunarJS as any;

export type ElementKey = 'wood' | 'fire' | 'earth' | 'metal' | 'water';

export interface ElementMeta {
  key: ElementKey;
  ko: string;
  hanja: string;
  hex: string;
}

export const ELEMENTS: Record<ElementKey, ElementMeta> = {
  wood: { key: 'wood', ko: '목', hanja: '木', hex: '#34d399' },
  fire: { key: 'fire', ko: '화', hanja: '火', hex: '#fb7185' },
  earth: { key: 'earth', ko: '토', hanja: '土', hex: '#fbbf24' },
  metal: { key: 'metal', ko: '금', hanja: '金', hex: '#cbd5e1' },
  water: { key: 'water', ko: '수', hanja: '水', hex: '#60a5fa' },
};

export const ELEMENT_ORDER: ElementKey[] = ['wood', 'fire', 'earth', 'metal', 'water'];

export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

export const STEM_KO: Record<string, string> = {
  甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무', 己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계',
};

export const BRANCH_KO: Record<string, string> = {
  子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사',
  午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해',
};

export const STEM_ELEMENT: Record<string, ElementKey> = {
  甲: 'wood', 乙: 'wood', 丙: 'fire', 丁: 'fire', 戊: 'earth',
  己: 'earth', 庚: 'metal', 辛: 'metal', 壬: 'water', 癸: 'water',
};

export const BRANCH_ELEMENT: Record<string, ElementKey> = {
  子: 'water', 丑: 'earth', 寅: 'wood', 卯: 'wood', 辰: 'earth', 巳: 'fire',
  午: 'fire', 未: 'earth', 申: 'metal', 酉: 'metal', 戌: 'earth', 亥: 'water',
};

const YANG_STEMS = new Set(['甲', '丙', '戊', '庚', '壬']);

/** 지장간(정기 → 중기 → 여기 순) */
export const HIDDEN_STEMS: Record<string, string[]> = {
  子: ['癸'],
  丑: ['己', '癸', '辛'],
  寅: ['甲', '丙', '戊'],
  卯: ['乙'],
  辰: ['戊', '乙', '癸'],
  巳: ['丙', '庚', '戊'],
  午: ['丁', '己'],
  未: ['己', '丁', '乙'],
  申: ['庚', '壬', '戊'],
  酉: ['辛'],
  戌: ['戊', '辛', '丁'],
  亥: ['壬', '甲'],
};

const ZODIAC: Record<string, string> = {
  子: '쥐', 丑: '소', 寅: '호랑이', 卯: '토끼', 辰: '용', 巳: '뱀',
  午: '말', 未: '양', 申: '원숭이', 酉: '닭', 戌: '개', 亥: '돼지',
};

const GENERATES: Record<ElementKey, ElementKey> = {
  wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood',
};
const CONTROLS: Record<ElementKey, ElementKey> = {
  wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood',
};

export type Sipsin =
  | '비견' | '겁재' | '식신' | '상관' | '편재' | '정재' | '편관' | '정관' | '편인' | '정인';

export const SIPSIN_GROUP: Record<Sipsin, '비겁' | '식상' | '재성' | '관성' | '인성'> = {
  비견: '비겁', 겁재: '비겁', 식신: '식상', 상관: '식상', 편재: '재성',
  정재: '재성', 편관: '관성', 정관: '관성', 편인: '인성', 정인: '인성',
};

/** 일간(dayStem)을 기준으로 다른 천간(otherStem)의 십신을 구한다. */
export function sipsinOf(dayStem: string, otherStem: string): Sipsin {
  const de = STEM_ELEMENT[dayStem];
  const oe = STEM_ELEMENT[otherStem];
  const samePolarity = YANG_STEMS.has(dayStem) === YANG_STEMS.has(otherStem);

  if (de === oe) return samePolarity ? '비견' : '겁재';
  if (GENERATES[de] === oe) return samePolarity ? '식신' : '상관';
  if (CONTROLS[de] === oe) return samePolarity ? '편재' : '정재';
  if (CONTROLS[oe] === de) return samePolarity ? '편관' : '정관';
  return samePolarity ? '편인' : '정인';
}

export interface HiddenStem {
  char: string;
  element: ElementKey;
  sipsin: Sipsin;
}

export interface Pillar {
  /** 시주 / 일주 / 월주 / 년주 */
  label: '시주' | '일주' | '월주' | '년주';
  short: '시' | '일' | '월' | '년';
  stem: string;
  branch: string;
  stemKo: string;
  branchKo: string;
  stemElement: ElementKey;
  branchElement: ElementKey;
  stemSipsin: Sipsin | '일간';
  branchSipsin: Sipsin;
  hidden: HiddenStem[];
  nayin: string;
  /** 태어난 시간을 모를 때 true (시주 자리 비움) */
  empty?: boolean;
}

export interface LuckPillar {
  ganzhi: string;
  stem: string;
  branch: string;
  stemSipsin: Sipsin;
  branchSipsin: Sipsin;
  stemElement: ElementKey;
  branchElement: ElementKey;
  startAge: number;
  endAge: number;
  startYear: number;
  endYear: number;
  current: boolean;
  /** 세운(연도)일 때 채워짐 */
  year?: number;
}

export interface Interaction {
  kind: '천간합' | '지지충' | '지지육합' | '지지삼합' | '지지형';
  pair: string;
  note: string;
  /** 원국 내부인지, 대운·세운과의 관계인지 */
  scope: '원국' | '대운' | '세운';
}

export interface StrengthResult {
  label: '신강' | '중화' | '신약';
  support: number;
  drain: number;
  ratio: number;
}

export interface Chart {
  birth: BirthInput;
  solar: { year: number; month: number; day: number; hour: number; minute: number; text: string };
  lunar: { year: number; month: number; day: number; isLeap: boolean; text: string };
  pillars: { hour: Pillar | null; day: Pillar; month: Pillar; year: Pillar };
  columnOrder: ('hour' | 'day' | 'month' | 'year')[];
  dayStem: string;
  dayElement: ElementKey;
  elementCounts: Record<ElementKey, number>;
  missingElements: ElementKey[];
  dominantElement: ElementKey;
  strength: StrengthResult;
  season: string;
  seasonNote: string;
  interactions: Interaction[];
  luckInteractions: Interaction[];
  daewun: LuckPillar[];
  currentDaewun: LuckPillar | null;
  daewunStart: { years: number; months: number; days: number; solarDate: string; forward: boolean };
  seun: LuckPillar[];
  age: number;
  zodiac: string;
}

export class SajuError extends Error {}

export function isLeapMonthValid(year: number, month: number): boolean {
  try {
    const leap = Lunar.fromYmd(year, -month, 1);
    // 윤달이 없는 해에는 예외가 나거나 음수가 아닌 달로 되돌아온다.
    return leap.getMonth() === -month;
  } catch {
    return false;
  }
}

function solarFromBirth(birth: BirthInput): { y: number; m: number; d: number } {
  if (birth.calendar === 'solar') return { y: birth.year, m: birth.month, d: birth.day };
  try {
    const lunar = Lunar.fromYmd(
      birth.year,
      birth.leapMonth ? -birth.month : birth.month,
      birth.day,
    );
    const solar = lunar.getSolar();
    return { y: solar.getYear(), m: solar.getMonth(), d: solar.getDay() };
  } catch {
    throw new SajuError('음력 날짜가 올바르지 않습니다. 윤달 여부와 날짜를 확인해 주세요.');
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function seasonOf(branch: string): { season: string; note: string } {
  switch (branch) {
    case '寅':
    case '卯':
      return { season: '봄 · 목(木)', note: '봄의 생기, 아직 차고 서늘한 기운이 남아 있는 계절' };
    case '巳':
    case '午':
      return { season: '여름 · 화(火)', note: '한열이 강한 계절, 뜨겁고 건조한 기운' };
    case '申':
    case '酉':
      return { season: '가을 · 금(金)', note: '서늘하고 결실을 맺는 계절, 건조한 기운' };
    case '亥':
    case '子':
      return { season: '겨울 · 수(水)', note: '차고 습한 계절, 모든 것을 감추고 저장하는 기운' };
    case '辰':
      return { season: '봄의 끝 · 습토(濕土)', note: '물기를 머금은 봄 흙, 변화무쌍한 기운' };
    case '未':
      return { season: '여름의 끝 · 조토(燥土)', note: '볕에 말라붙은 여름 흙, 뜨거움 속의 습기' };
    case '戌':
      return { season: '가을의 끝 · 조토(燥土)', note: '메마르고 단단한 가을 흙, 정리와 수확의 기운' };
    default:
      return { season: '겨울의 끝 · 동토(凍土)', note: '얼어붙은 겨울 흙, 한기 속에 숨은 생명력' };
  }
}

function makePillar(
  dayStem: string,
  label: Pillar['label'],
  short: Pillar['short'],
  ganzhi: string,
  nayin: string,
  isDayStem = false,
): Pillar {
  const stem = ganzhi.slice(0, 1);
  const branch = ganzhi.slice(1, 2);
  const hidden = (HIDDEN_STEMS[branch] ?? []).map((char) => ({
    char,
    element: STEM_ELEMENT[char],
    sipsin: sipsinOf(dayStem, char),
  }));

  return {
    label,
    short,
    stem,
    branch,
    stemKo: STEM_KO[stem] ?? stem,
    branchKo: BRANCH_KO[branch] ?? branch,
    stemElement: STEM_ELEMENT[stem],
    branchElement: BRANCH_ELEMENT[branch],
    stemSipsin: isDayStem ? '일간' : sipsinOf(dayStem, stem),
    branchSipsin: hidden[0]?.sipsin ?? sipsinOf(dayStem, stem),
    hidden,
    nayin,
  };
}

const STEM_HAP: Record<string, { pair: string; element: ElementKey }> = {
  甲己: { pair: '甲己', element: 'earth' },
  乙庚: { pair: '乙庚', element: 'metal' },
  丙辛: { pair: '丙辛', element: 'water' },
  丁壬: { pair: '丁壬', element: 'wood' },
  戊癸: { pair: '戊癸', element: 'fire' },
};

const BRANCH_CHUNG: Record<string, string> = {
  子午: '子午 충', 丑未: '丑未 충', 寅申: '寅申 충',
  卯酉: '卯酉 충', 辰戌: '辰戌 충', 巳亥: '巳亥 충',
};

const BRANCH_YUKHAP: Record<string, string> = {
  子丑: '子丑 육합', 寅亥: '寅亥 육합', 卯戌: '卯戌 육합',
  辰酉: '辰酉 육합', 巳申: '巳申 육합', 午未: '午未 육합',
};

const BRANCH_SAMHAP: { chars: string[]; label: string; element: ElementKey }[] = [
  { chars: ['申', '子', '辰'], label: '申子辰 삼합(수)', element: 'water' },
  { chars: ['亥', '卯', '未'], label: '亥卯未 삼합(목)', element: 'wood' },
  { chars: ['寅', '午', '戌'], label: '寅午戌 삼합(화)', element: 'fire' },
  { chars: ['巳', '酉', '丑'], label: '巳酉丑 삼합(금)', element: 'metal' },
];

const BRANCH_HYEONG: string[][] = [
  ['寅', '巳', '申'],
  ['丑', '戌', '未'],
  ['子', '卯'],
];

function keyPair(a: string, b: string): string {
  return a + b;
}

function pairLookup<T>(map: Record<string, T>, a: string, b: string): T | undefined {
  return map[keyPair(a, b)] ?? map[keyPair(b, a)];
}

/** 원국(또는 원국 + 외부 글자)의 합·충·형을 계산한다. */
export function findInteractions(
  stems: string[],
  branches: string[],
  scope: Interaction['scope'] = '원국',
): Interaction[] {
  const out: Interaction[] = [];

  for (let i = 0; i < stems.length; i += 1) {
    for (let j = i + 1; j < stems.length; j += 1) {
      const hap = pairLookup(STEM_HAP, stems[i], stems[j]);
      if (hap) {
        out.push({
          kind: '천간합',
          pair: hap.pair,
          note: `${hap.pair} 천간합 → ${ELEMENTS[hap.element].ko}(${ELEMENTS[hap.element].hanja}) 기운으로 묶임`,
          scope,
        });
      }
    }
  }

  for (let i = 0; i < branches.length; i += 1) {
    for (let j = i + 1; j < branches.length; j += 1) {
      const chung = pairLookup(BRANCH_CHUNG, branches[i], branches[j]);
      if (chung) out.push({ kind: '지지충', pair: chung, note: `${chung} — 자리와 판이 흔들리는 변화`, scope });
      const yukhap = pairLookup(BRANCH_YUKHAP, branches[i], branches[j]);
      if (yukhap) out.push({ kind: '지지육합', pair: yukhap, note: `${yukhap} — 서로 묶여 안정되는 힘`, scope });
    }
  }

  const unique = new Set(branches);
  for (const group of BRANCH_SAMHAP) {
    if (group.chars.every((c) => unique.has(c))) {
      out.push({
        kind: '지지삼합',
        pair: group.label,
        note: `${group.label} — ${ELEMENTS[group.element].ko}(${ELEMENTS[group.element].hanja}) 기운이 크게 형성`,
        scope,
      });
    }
  }

  for (const group of BRANCH_HYEONG) {
    const present = group.filter((c) => unique.has(c));
    if (group.length === 2 && present.length === 2) {
      out.push({ kind: '지지형', pair: `${present.join('')} 형`, note: '서로 예민하게 부딪히며 긴장을 만드는 형', scope });
    } else if (group.length === 3 && present.length === 3) {
      out.push({ kind: '지지형', pair: `${group.join('')} 삼형`, note: '세 글자가 얽혀 크게 흔들리는 삼형', scope });
    }
  }

  return out;
}

function strengthOf(pillars: Pillar[], dayStem: string): StrengthResult {
  const dayElement = STEM_ELEMENT[dayStem];
  let support = 0;
  let drain = 0;

  const add = (element: ElementKey, weight: number) => {
    if (element === dayElement) support += weight;
    else if (GENERATES[element] === dayElement) support += weight; // 인성
    else drain += weight;
  };

  for (const pillar of pillars) {
    const stemWeight = pillar.label === '월주' ? 1.1 : pillar.label === '일주' ? 0 : 0.8;
    if (stemWeight > 0) add(pillar.stemElement, stemWeight);
    const branchWeight =
      pillar.label === '월주' ? 1.6 : pillar.label === '일주' ? 1.3 : 1;
    add(pillar.branchElement, branchWeight);
  }

  const total = support + drain || 1;
  const ratio = support / total;
  const label: StrengthResult['label'] = ratio >= 0.58 ? '신강' : ratio <= 0.42 ? '신약' : '중화';
  return {
    label,
    support: Math.round(support * 10) / 10,
    drain: Math.round(drain * 10) / 10,
    ratio: Math.round(ratio * 100) / 100,
  };
}

function ganzhiOfYear(year: number): string {
  return `${STEMS[(year - 4) % 10]}${BRANCHES[(year - 4) % 12]}`;
}

function luckPillar(
  ganzhi: string,
  dayStem: string,
  startAge: number,
  endAge: number,
  startYear: number,
  endYear: number,
  current: boolean,
): LuckPillar {
  const stem = ganzhi.slice(0, 1);
  const branch = ganzhi.slice(1, 2);
  const hidden = HIDDEN_STEMS[branch] ?? [];
  return {
    ganzhi,
    stem,
    branch,
    stemSipsin: sipsinOf(dayStem, stem),
    branchSipsin: hidden.length ? sipsinOf(dayStem, hidden[0]) : sipsinOf(dayStem, stem),
    stemElement: STEM_ELEMENT[stem],
    branchElement: BRANCH_ELEMENT[branch],
    startAge,
    endAge,
    startYear,
    endYear,
    current,
  };
}

export interface ChartOptions {
  /** 기준 연도 (테스트·미리보기용, 기본값: 올해) */
  nowYear?: number;
}

export function buildChart(birth: BirthInput, options: ChartOptions = {}): Chart {
  const nowYear = options.nowYear ?? new Date().getFullYear();
  const solarBirth = solarFromBirth(birth);
  const hour = birth.timeKnown ? birth.hour : 12;
  const minute = birth.timeKnown ? birth.minute : 0;

  const solar = Solar.fromYmdHms(solarBirth.y, solarBirth.m, solarBirth.d, hour, minute, 0);
  const lunar = solar.getLunar();
  const ec = lunar.getEightChar();

  const yearGz = ec.getYear();
  const monthGz = ec.getMonth();
  const dayGz = ec.getDay();
  const timeGz = ec.getTime();

  const dayStem = dayGz.slice(0, 1);

  const yearPillar = makePillar(dayStem, '년주', '년', yearGz, ec.getYearNaYin());
  const monthPillar = makePillar(dayStem, '월주', '월', monthGz, ec.getMonthNaYin());
  const dayPillar = makePillar(dayStem, '일주', '일', dayGz, ec.getDayNaYin(), true);
  const hourPillar = birth.timeKnown
    ? makePillar(dayStem, '시주', '시', timeGz, ec.getTimeNaYin())
    : null;

  const activePillars = [yearPillar, monthPillar, dayPillar, ...(hourPillar ? [hourPillar] : [])];

  const elementCounts: Record<ElementKey, number> = {
    wood: 0, fire: 0, earth: 0, metal: 0, water: 0,
  };
  for (const pillar of activePillars) {
    elementCounts[pillar.stemElement] += 1;
    elementCounts[pillar.branchElement] += 1;
  }

  const missingElements = ELEMENT_ORDER.filter((el) => elementCounts[el] === 0);
  const dominantElement = ELEMENT_ORDER.reduce(
    (acc, el) => (elementCounts[el] > elementCounts[acc] ? el : acc),
    'wood' as ElementKey,
  );

  // 대운
  const yun = ec.getYun(birth.gender === 'male' ? 1 : 0);
  const rawDaYun = yun.getDaYun();
  const daewun: LuckPillar[] = [];
  for (let i = 1; i < rawDaYun.length && daewun.length < 9; i += 1) {
    const d = rawDaYun[i];
    const gz = d.getGanZhi();
    if (!gz) continue;
    const startYear = d.getStartYear();
    const endYear = d.getEndYear();
    daewun.push(
      luckPillar(
        gz,
        dayStem,
        d.getStartAge(),
        d.getEndAge(),
        startYear,
        endYear,
        nowYear >= startYear && nowYear <= endYear,
      ),
    );
  }
  const currentDaewun = daewun.find((d) => d.current) ?? null;

  // 세운: 올해 -1년 ~ +3년
  const seun: LuckPillar[] = [];
  for (let y = nowYear - 1; y <= nowYear + 3; y += 1) {
    const gz = ganzhiOfYear(y);
    const age = y - solarBirth.y + 1;
    const pillar = luckPillar(gz, dayStem, age, age, y, y, y === nowYear);
    pillar.year = y;
    seun.push(pillar);
  }

  const season = seasonOf(monthPillar.branch);

  const natalInteractions = findInteractions(
    activePillars.map((p) => p.stem),
    activePillars.map((p) => p.branch),
    '원국',
  );

  const luckInteractions: Interaction[] = [];
  if (currentDaewun) {
    luckInteractions.push(
      ...findInteractions(
        [dayStem, currentDaewun.stem, ...activePillars.map((p) => p.stem)],
        [currentDaewun.branch, ...activePillars.map((p) => p.branch)],
        '대운',
      ).filter((it) => it.note.length > 0 && (it.pair.includes(currentDaewun.stem) || it.pair.includes(currentDaewun.branch))),
    );
  }
  const thisYear = seun.find((s) => s.year === nowYear);
  if (thisYear) {
    luckInteractions.push(
      ...findInteractions(
        [dayStem, thisYear.stem, ...activePillars.map((p) => p.stem)],
        [thisYear.branch, ...activePillars.map((p) => p.branch)],
        '세운',
      ).filter((it) => it.pair.includes(thisYear.stem) || it.pair.includes(thisYear.branch)),
    );
  }

  const birthDate = new Date(solarBirth.y, solarBirth.m - 1, solarBirth.d);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const beforeBirthday =
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
  if (beforeBirthday) age -= 1;
  if (age < 0) age = 0;

  const lunarText = `${lunar.getYear()}년 ${lunar.getMonth() < 0 ? '윤' : ''}${Math.abs(
    lunar.getMonth(),
  )}월 ${lunar.getDay()}일`;

  return {
    birth,
    solar: {
      year: solarBirth.y,
      month: solarBirth.m,
      day: solarBirth.d,
      hour,
      minute,
      text: `${solarBirth.y}.${pad(solarBirth.m)}.${pad(solarBirth.d)} ${pad(hour)}:${pad(minute)}`,
    },
    lunar: {
      year: lunar.getYear(),
      month: Math.abs(lunar.getMonth()),
      day: lunar.getDay(),
      isLeap: lunar.getMonth() < 0,
      text: lunarText,
    },
    pillars: { hour: hourPillar, day: dayPillar, month: monthPillar, year: yearPillar },
    columnOrder: ['hour', 'day', 'month', 'year'],
    dayStem,
    dayElement: STEM_ELEMENT[dayStem],
    elementCounts,
    missingElements,
    dominantElement,
    strength: strengthOf(activePillars, dayStem),
    season: season.season,
    seasonNote: season.note,
    interactions: natalInteractions,
    luckInteractions,
    daewun,
    currentDaewun,
    daewunStart: {
      years: yun.getStartYear(),
      months: yun.getStartMonth(),
      days: yun.getStartDay(),
      solarDate: yun.getStartSolar().toYmd(),
      forward: yun.isForward(),
    },
    seun,
    age,
    zodiac: ZODIAC[yearPillar.branch] ?? '',
  };
}

/** 일간 10종의 짧은 성정 설명 (화면 라벨용) */
export const DAY_MASTER_NOTE: Record<string, string> = {
  甲: '곧게 뻗는 큰 나무 · 소신과 리더십',
  乙: '유연하게 뻗는 풀과 넝쿨 · 적응력과 생존력',
  丙: '환하게 비추는 태양 · 열정과 표현력',
  丁: '어둠을 밝히는 촛불 · 섬세한 통찰과 온기',
  戊: '든든한 산 · 포용력과 신뢰',
  己: '곡식을 기르는 밭흙 · 실속과 배려',
  庚: '단단한 바위와 쇠 · 결단과 추진력',
  辛: '다듬어진 보석 · 정교함과 완성도',
  壬: '큰 강과 바다 · 넓은 흐름과 포부',
  癸: '조용히 내리는 이슬비 · 감수성과 스며드는 힘',
};

export function formatSolarBirth(birth: BirthInput, chart?: Chart): string {
  const type = birth.calendar === 'lunar' ? `음력${birth.leapMonth ? ' 윤달' : ''}` : '양력';
  const time = birth.timeKnown
    ? `${pad(birth.hour)}:${pad(birth.minute)}`
    : '태어난 시간 모름';
  const base = `${type} ${birth.year}.${pad(birth.month)}.${pad(birth.day)}`;
  if (birth.calendar === 'lunar' && chart) {
    return `${base} (양력 ${chart.solar.year}.${pad(chart.solar.month)}.${pad(chart.solar.day)}) · ${time}`;
  }
  return `${base} · ${time}`;
}

export function calendarLabel(calendar: CalendarType): string {
  return calendar === 'lunar' ? '음력' : '양력';
}

export function genderLabel(gender: Gender): string {
  return gender === 'male' ? '남성' : '여성';
}
