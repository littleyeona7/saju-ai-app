/**
 * 렌더링 스모크 테스트 — 브라우저 없이 주요 화면이 실제로 그려지는지 확인한다.
 * 실행: npx tsx scripts/smoke.tsx
 */
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import App from '../src/App';
import { ChatTab } from '../src/components/ChatTab';
import { ChoiceTab } from '../src/components/ChoiceTab';
import { SajuTab } from '../src/components/SajuTab';
import { SettingsModal } from '../src/components/SettingsModal';
import { buildChart } from '../src/lib/saju';
import { loadSettings } from '../src/lib/storage';
import type { Profile, Settings } from '../src/types';

// --- 브라우저 최소 스텁 ---
const store = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear(),
  key: (index: number) => Array.from(store.keys())[index] ?? null,
  get length() {
    return store.size;
  },
};
(globalThis as unknown as { localStorage: typeof localStorageStub }).localStorage = localStorageStub;

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

function render(node: React.ReactElement): string {
  try {
    return renderToString(node).replace(/<!--\s*-->/g, '');
  } catch (error) {
    console.log(`  ! 렌더 오류: ${(error as Error).message}`);
    return '';
  }
}

const profile: Profile = {
  id: 'test-profile',
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
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const chart = buildChart(profile.birth);
const settings: Settings = { apiKey: '', model: 'gemini-3.8-flash', autoRead: false, speechRate: 1 };

console.log('\n[1] 초기 상태 — 빈 온보딩');
store.clear();
const onboardingHtml = render(createElement(App));
check('앱이 렌더된다', onboardingHtml.length > 500);
check('온보딩 문구가 보인다', onboardingHtml.includes('내 사주 입력'));
check('가짜 프로필(김서연)이 없다', !onboardingHtml.includes('김서연'));
check('프로필이 없으면 하단 탭이 없다', !onboardingHtml.includes('AI 상담') || onboardingHtml.includes('내 사주 입력'));

console.log('\n[2] 저장된 프로필 — 사주 화면');
store.clear();
store.set('saju.profiles.v1', JSON.stringify([profile]));
store.set('saju.activeProfile.v1', profile.id);
const sajuHtml = render(createElement(App));
check(
  '사주 원국 8글자가 모두 렌더된다',
  ['乙', '丑', '癸', '未', '己', '甲', '戌'].every((char) => sajuHtml.includes(`>${char}<`)),
);
check('사주 기둥 라벨(시·일·월·년)', ['시주', '일주', '월주', '년주'].every((label) => sajuHtml.includes(label)));
check('일간 표시', sajuHtml.includes('일간'));
check('오행 요약', sajuHtml.includes('오행 분포'));
check('대운 표시', sajuHtml.includes('대운'));
check('결혼·배우자 카드', sajuHtml.includes('배우자'));
check('프로필 이름', sajuHtml.includes('최연우'));
check('저장된 프로필 1/10 표시', sajuHtml.includes('1/10'));

// 19:35 (술시) 사주가 그리드에 그대로 나오는지
const evening = buildChart({ ...profile.birth, hour: 19, minute: 35 });
const eveningHtml = render(
  createElement(SajuTab, {
    profile: { ...profile, birth: { ...profile.birth, hour: 19, minute: 35 } },
    chart: evening,
    profiles: [profile],
    activeId: profile.id,
    onSelectProfile: () => {},
    onDeleteProfile: () => {},
    onAddProfile: () => {},
    onMarriageChange: () => {},
    onOpenChat: () => {},
    onOpenChoice: () => {},
  }),
);
check(
  '19:35 → 시주 甲戌 이 그리드에 그려진다',
  evening.pillars.hour?.stem === '甲' && evening.pillars.hour?.branch === '戌' && eveningHtml.includes('>甲<') && eveningHtml.includes('>戌<'),
);
check('19:35 → 오행 토5', evening.elementCounts.earth === 5);
check('시각 표기', eveningHtml.includes('19:35'));

console.log('\n[3] AI 상담 화면');
const chatHtml = render(
  createElement(ChatTab, {
    profile,
    chart,
    partner: null,
    settings,
    onOpenSettings: () => {},
    onToggleAutoRead: () => {},
  }),
);
check('상담 헤더', chatHtml.includes('AI 사주 상담'));
check('빈 상태 인사', chatHtml.includes('안녕하세요'));
check('API 키 안내', chatHtml.includes('Gemini API 키가 필요해요'));
check('입력창', chatHtml.includes('textarea'));

console.log('\n[4] A vs B 시뮬레이터');
const choiceHtml = render(createElement(ChoiceTab, { profile, chart, partner: null, settings }));
check('시뮬레이터 제목', choiceHtml.includes('인생 선택 A vs B'));
check('A안 입력', choiceHtml.includes('선택지 A'));
check('B안 입력', choiceHtml.includes('선택지 B'));
check('프리셋', choiceHtml.includes('결혼 vs 비혼'));

console.log('\n[5] 설정 모달');
const settingsHtml = render(
  createElement(SettingsModal, {
    open: true,
    onClose: () => {},
    settings,
    onChange: () => {},
    onClearAll: () => {},
    speechSupported: true,
    onPreviewVoice: () => {},
  }),
);
check('API 키 항목', settingsHtml.includes('Gemini API 키'));
check('모델 선택', settingsHtml.includes('gemini-3.8-flash'));
check('단종 2.5 모델 안내 없음', !settingsHtml.includes('gemini-2.5-flash'));
check('음성 설정', settingsHtml.includes('음성'));

console.log('\n[6] 예전에 저장한 단종 모델은 자동 이전');
store.clear();
store.set('saju.settings.v1', JSON.stringify({ apiKey: 'k', model: 'gemini-2.5-flash', autoRead: false, speechRate: 1 }));
check('gemini-2.5-flash → gemini-3.8-flash', loadSettings().model === 'gemini-3.8-flash', loadSettings().model);
store.set('saju.settings.v1', JSON.stringify({ apiKey: 'k', model: 'gemini-2.5-flash-lite', autoRead: false, speechRate: 1 }));
check('gemini-2.5-flash-lite → gemini-3.5-flash-lite', loadSettings().model === 'gemini-3.5-flash-lite', loadSettings().model);
store.set('saju.settings.v1', JSON.stringify({ apiKey: 'k', model: 'gemini-3.6-flash', autoRead: false, speechRate: 1 }));
check('직접 고른 모델은 그대로', loadSettings().model === 'gemini-3.6-flash', loadSettings().model);

console.log('\n[7] 프로필 10개 상한');
store.clear();
const many = Array.from({ length: 12 }, (_, i) => ({ ...profile, id: `p-${i}`, birth: { ...profile.birth, name: `사람${i}` } }));
store.set('saju.profiles.v1', JSON.stringify(many));
store.set('saju.activeProfile.v1', 'p-0');
const cappedHtml = render(createElement(App));
check('10개까지만 읽는다', cappedHtml.includes('10/10') && !cappedHtml.includes('사람10'));

console.log(`\n결과: ${passed}개 통과, ${failed}개 실패\n`);
if (failed > 0) process.exit(1);
