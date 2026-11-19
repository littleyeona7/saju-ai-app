/**
 * 만세력 엔진 검증 스크립트.
 * 실행: npm run verify
 *
 * 요구된 기준값
 *   양력 1985-07-19 19:35 (여) → 乙丑 癸未 己未 甲戌, 오행 목2 화0 토5 금0 수1
 */
import {
  BRANCHES,
  STEMS,
  buildChart,
  findInteractions,
  isLeapMonthValid,
  sipsinOf,
  type Chart,
} from '../src/lib/saju';
import type { BirthInput } from '../src/types';

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function eq(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  check(name, a === e, `기대 ${e} / 실제 ${a}`);
}

function birth(partial: Partial<BirthInput>): BirthInput {
  return {
    name: '테스트',
    calendar: 'solar',
    year: 1985,
    month: 7,
    day: 19,
    leapMonth: false,
    timeKnown: true,
    hour: 19,
    minute: 35,
    gender: 'female',
    ...partial,
  };
}

function pillars(chart: Chart): string[] {
  return [
    chart.pillars.year.stem + chart.pillars.year.branch,
    chart.pillars.month.stem + chart.pillars.month.branch,
    chart.pillars.day.stem + chart.pillars.day.branch,
    chart.pillars.hour ? chart.pillars.hour.stem + chart.pillars.hour.branch : '(모름)',
  ];
}

function jdn(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12);
  const y2 = y + 4800 - a;
  const m2 = m + 12 * a - 3;
  return (
    d +
    Math.floor((153 * m2 + 2) / 5) +
    365 * y2 +
    Math.floor(y2 / 4) -
    Math.floor(y2 / 100) +
    Math.floor(y2 / 400) -
    32045
  );
}

function dayIndex(chart: Chart): number {
  const stem = STEMS.indexOf(chart.pillars.day.stem);
  const branch = BRANCHES.indexOf(chart.pillars.day.branch);
  for (let i = 0; i < 60; i += 1) {
    if (i % 10 === stem && i % 12 === branch) return i;
  }
  return -1;
}

console.log('\n[1] 기준 사주 — 양력 1985-07-19 19:35 (여)');
const base = buildChart(birth({}));
eq('사주 원국 (년·월·일·시)', pillars(base), ['乙丑', '癸未', '己未', '甲戌']);
eq('년주 천간/지지', [base.pillars.year.stem, base.pillars.year.branch], ['乙', '丑']);
eq('월주 천간/지지', [base.pillars.month.stem, base.pillars.month.branch], ['癸', '未']);
eq('일주 천간/지지', [base.pillars.day.stem, base.pillars.day.branch], ['己', '未']);
eq('시주 천간/지지', [base.pillars.hour?.stem, base.pillars.hour?.branch], ['甲', '戌']);
eq('오행 분포 (목·화·토·금·수)', [
  base.elementCounts.wood,
  base.elementCounts.fire,
  base.elementCounts.earth,
  base.elementCounts.metal,
  base.elementCounts.water,
], [2, 0, 5, 0, 1]);
eq('없는 오행', base.missingElements.sort(), ['fire', 'metal']);
eq('일간', base.dayStem, '己');
eq('음력 변환', base.lunar.text, '1985년 6월 2일');
eq('십신 — 년간 乙', base.pillars.year.stemSipsin, '편관');
eq('십신 — 월간 癸', base.pillars.month.stemSipsin, '편재');
eq('십신 — 시간 甲', base.pillars.hour?.stemSipsin, '정관');
eq('십신 — 일간', base.pillars.day.stemSipsin, '일간');
check('지장간 — 未 = 己·丁·乙', JSON.stringify(base.pillars.day.hidden.map((h) => h.char)) === JSON.stringify(['己', '丁', '乙']));
eq('신강·신약 (토 과다 → 신강)', base.strength.label, '신강');
eq('대운 1주기', base.daewun[0].ganzhi, '甲申');
eq('대운 1주기 시작 연도', [base.daewun[0].startYear, base.daewun[0].endYear], [1991, 2000]);
eq('대운 순행 (음년 여성)', base.daewunStart.forward, true);
check('丑未 충이 원국에 존재', base.interactions.some((i) => i.kind === '지지충' && i.pair.includes('丑未')));
eq('올해(2026) 세운', base.seun.find((s) => s.year === 2026)?.ganzhi, '丙午');
eq('현재 대운 (2026)', base.currentDaewun?.ganzhi, '丁亥');

console.log('\n[2] 음력 입력으로 같은 사주가 나오는지 (음력 1985-06-02 19:35)');
const lunarInput = buildChart(birth({ calendar: 'lunar', month: 6, day: 2 }));
eq('음력 입력 → 사주 원국', pillars(lunarInput), pillars(base));
eq('음력 → 양력 변환', `${lunarInput.solar.year}-${lunarInput.solar.month}-${lunarInput.solar.day}`, '1985-7-19');

console.log('\n[3] 태어난 시간 모름');
const noTime = buildChart(birth({ timeKnown: false }));
eq('시주 없음', noTime.pillars.hour, null);
eq('년·월·일주 유지', [
  noTime.pillars.year.stem + noTime.pillars.year.branch,
  noTime.pillars.month.stem + noTime.pillars.month.branch,
  noTime.pillars.day.stem + noTime.pillars.day.branch,
], ['乙丑', '癸未', '己未']);
eq('오행 합계 (6글자)', Object.values(noTime.elementCounts).reduce((a, b) => a + b, 0), 6);

console.log('\n[4] 윤달 처리');
const leap = buildChart(birth({ calendar: 'lunar', year: 2020, month: 4, day: 1, leapMonth: true, timeKnown: false, gender: 'male' }));
eq('2020 윤4월 1일 → 양력', `${leap.solar.year}-${leap.solar.month}-${leap.solar.day}`, '2020-5-23');
check('2020년 윤4월 존재', isLeapMonthValid(2020, 4));
check('2020년 윤6월 없음', !isLeapMonthValid(2020, 6));

console.log('\n[5] 일주 순환 — 줄리안데이 기준 60갑자와 300일 대조');
const offset = ((dayIndex(base) - jdn(1985, 7, 19)) % 60 + 60) % 60;
let dayMismatch = 0;
let seed = 20260101;
const nextRandom = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
for (let i = 0; i < 300; i += 1) {
  const year = 1930 + Math.floor(nextRandom() * 90);
  const month = 1 + Math.floor(nextRandom() * 12);
  const day = 1 + Math.floor(nextRandom() * 28);
  const chart = buildChart(birth({ year, month, day, hour: 12, minute: 0 }));
  const expected = ((jdn(year, month, day) + offset) % 60 + 60) % 60;
  if (dayIndex(chart) !== expected) {
    dayMismatch += 1;
    if (dayMismatch <= 3) console.log(`    불일치: ${year}-${month}-${day} → ${chart.pillars.day.stem}${chart.pillars.day.branch}`);
  }
}
check('300일 일주 계산 일치', dayMismatch === 0, `${dayMismatch}건 불일치`);

console.log('\n[6] 절기 기준 년·월주 경계');
const beforeIpchun = buildChart(birth({ year: 1985, month: 1, day: 15, hour: 12, minute: 0 }));
eq('1985-01-15 (입춘 전) 년주', beforeIpchun.pillars.year.stem + beforeIpchun.pillars.year.branch, '甲子');
eq('1985-01-15 월주', beforeIpchun.pillars.month.stem + beforeIpchun.pillars.month.branch, '丁丑');
const midSummer = buildChart(birth({ year: 1985, month: 6, day: 19, hour: 12, minute: 0 }));
eq('1985-06-19 월주 (오월)', midSummer.pillars.month.stem + midSummer.pillars.month.branch, '壬午');

console.log('\n[7] 오호둔(월간) 규칙 — 임의 60일 검증');
let monthRuleError = 0;
const MONTH_START: Record<string, string> = {
  甲: '丙', 己: '丙', 乙: '戊', 庚: '戊', 丙: '庚', 辛: '庚', 丁: '壬', 壬: '壬', 戊: '甲', 癸: '甲',
};
for (let i = 0; i < 60; i += 1) {
  const year = 1960 + i * 2;
  const chart = buildChart(birth({ year, month: 3 + (i % 6), day: 15, hour: 12, minute: 0 }));
  const yearStem = chart.pillars.year.stem;
  const monthStem = chart.pillars.month.stem;
  const startStem = MONTH_START[yearStem];
  const offsetStem = (STEMS.indexOf(monthStem) - STEMS.indexOf(startStem) + 10) % 10;
  const expectedOffset = (BRANCHES.indexOf(chart.pillars.month.branch) - 2 + 12) % 12;
  if (offsetStem !== expectedOffset) monthRuleError += 1;
}
check('월간이 오호둔 규칙과 일치', monthRuleError === 0, `${monthRuleError}건 불일치`);

console.log('\n[8] 십신 계산');
eq('己일간 vs 甲', sipsinOf('己', '甲'), '정관');
eq('己일간 vs 乙', sipsinOf('己', '乙'), '편관');
eq('己일간 vs 己', sipsinOf('己', '己'), '비견');
eq('己일간 vs 癸', sipsinOf('己', '癸'), '편재');
eq('己일간 vs 壬', sipsinOf('己', '壬'), '정재');
eq('甲일간 vs 丙', sipsinOf('甲', '丙'), '식신');
eq('甲일간 vs 丁', sipsinOf('甲', '丁'), '상관');
eq('甲일간 vs 壬', sipsinOf('甲', '壬'), '편인');

console.log('\n[9] 합·충 계산');
const inter = findInteractions(['甲', '己'], ['子', '午', '辰']);
check('천간합 甲己', inter.some((i) => i.kind === '천간합' && i.pair === '甲己'));
check('지지충 子午', inter.some((i) => i.kind === '지지충' && i.pair.includes('子午')));

console.log(`\n결과: ${passed}개 통과, ${failed}개 실패\n`);
if (failed > 0) process.exit(1);
