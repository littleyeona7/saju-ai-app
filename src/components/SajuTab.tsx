import type { MarriageInfo, Profile } from '../types';
import type { Chart } from '../lib/saju';
import {
  DAY_MASTER_NOTE,
  ELEMENTS,
  ELEMENT_ORDER,
  formatSolarBirth,
  genderLabel,
} from '../lib/saju';
import { SajuGrid } from './SajuGrid';
import { ElementSummary } from './ElementSummary';
import { DaewunStrip } from './DaewunStrip';
import { MarriageCard } from './MarriageCard';
import { ProfileShelf } from './ProfileShelf';
import { Card, Chip, Icon, SectionTitle } from './ui';
import { MAX_PROFILES } from '../constants';

const KIND_TONE: Record<string, 'gold' | 'danger' | 'ok' | 'neutral'> = {
  천간합: 'gold',
  지지육합: 'ok',
  지지삼합: 'ok',
  지지충: 'danger',
  지지형: 'danger',
};

export function SajuTab({
  profile,
  chart,
  profiles,
  activeId,
  onSelectProfile,
  onDeleteProfile,
  onAddProfile,
  onMarriageChange,
  onOpenChat,
  onOpenChoice,
}: {
  profile: Profile;
  chart: Chart;
  profiles: Profile[];
  activeId: string;
  onSelectProfile: (id: string) => void;
  onDeleteProfile: (id: string) => void;
  onAddProfile: () => void;
  onMarriageChange: (marriage: MarriageInfo) => void;
  onOpenChat: () => void;
  onOpenChoice: () => void;
}) {
  const displayName = profile.birth.name || '나';

  return (
    <div className="mx-auto w-full max-w-md space-y-3 px-4 py-4">
      {/* 정체성 */}
      <Card className="animate-fade-up bg-gradient-to-br from-white/[0.07] to-white/[0.02]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-[19px] font-bold tracking-tight text-slate-50">{displayName}</h1>
              <span className="shrink-0 text-[11px] text-slate-500">
                {genderLabel(profile.birth.gender)} · 만 {chart.age}세
              </span>
            </div>
            <p className="mt-0.5 truncate text-[11.5px] text-slate-400">{formatSolarBirth(profile.birth, chart)}</p>
          </div>
          <span className="shrink-0 rounded-full border border-gold/25 bg-gold/10 px-2 py-1 text-[10.5px] font-medium text-gold">
            {chart.dayStem} {ELEMENTS[chart.dayElement].ko}일간
          </span>
        </div>

        <p className="mt-2.5 rounded-lg border border-white/8 bg-black/20 px-2.5 py-2 text-[11.5px] leading-relaxed text-slate-400">
          <span className="font-medium text-slate-300">{DAY_MASTER_NOTE[chart.dayStem]}</span>
          <br />
          {chart.season} · {chart.strength.label} (간이 지표)
        </p>

        {!profile.birth.timeKnown ? (
          <p className="mt-2 text-[10.5px] leading-snug text-amber-200/70">
            태어난 시간을 몰라 시주를 비웠습니다. 시주에 따라 달라지는 결혼·자식·말년 운은 따로 짚어 드려요.
          </p>
        ) : null}
      </Card>

      {/* 사주 원국 */}
      <Card>
        <SectionTitle title="사주 원국" hint="시 · 일 · 월 · 년 순서 · 위가 천간, 아래가 지지" right={<Chip tone="gold">일간 = 나</Chip>} />
        <SajuGrid chart={chart} />
        <div className="mt-2.5 grid grid-cols-4 gap-1.5 text-center">
          {(['hour', 'day', 'month', 'year'] as const).map((key) => {
            const pillar = chart.pillars[key];
            return (
              <span key={key} className="truncate text-[9.5px] text-slate-600">
                {pillar ? pillar.nayin : '—'}
              </span>
            );
          })}
        </div>
      </Card>

      {/* 오행 */}
      <Card>
        <SectionTitle title="오행 분포" hint="목·화·토·금·수 개수와 부족한 기운" />
        <ElementSummary chart={chart} />
      </Card>

      {/* 조후와 합충 */}
      <Card>
        <SectionTitle title="조후 · 합충" hint="계절의 기운과 글자 사이의 관계" />
        <div className="space-y-2">
          <div className="rounded-lg border border-white/8 bg-black/20 px-2.5 py-2">
            <p className="text-[12px] font-medium text-slate-200">{chart.season}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{chart.seasonNote}</p>
          </div>
          <div>
            <p className="mb-1 text-[10.5px] font-medium text-slate-500">원국 합·충</p>
            {chart.interactions.length ? (
              <div className="flex flex-wrap gap-1">
                {chart.interactions.map((item, index) => (
                  <Chip key={`${item.pair}-${index}`} tone={KIND_TONE[item.kind] ?? 'neutral'}>
                    {item.pair}
                  </Chip>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-600">두드러지는 합·충이 없어 흐름이 단순한 편입니다.</p>
            )}
          </div>
          {chart.luckInteractions.length ? (
            <div>
              <p className="mb-1 text-[10.5px] font-medium text-slate-500">대운·세운에서 걸리는 관계</p>
              <div className="flex flex-wrap gap-1">
                {chart.luckInteractions.slice(0, 6).map((item, index) => (
                  <Chip key={`${item.pair}-${index}`} tone={KIND_TONE[item.kind] ?? 'neutral'}>
                    {item.scope} {item.pair}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      {/* 대운 */}
      <Card>
        <SectionTitle
          title="대운 · 세운"
          hint={`${chart.daewunStart.forward ? '순행' : '역행'} · 대운 시작 ${chart.daewunStart.solarDate}`}
          right={chart.currentDaewun ? <Chip tone="gold">{chart.currentDaewun.ganzhi} 대운</Chip> : undefined}
        />
        <DaewunStrip chart={chart} />
      </Card>

      {/* 결혼 */}
      <Card>
        <SectionTitle title="결혼 · 배우자" hint="AI가 가정과 인연을 함께 읽도록 연결해 두세요" />
        <MarriageCard profile={profile} profiles={profiles} onChange={onMarriageChange} />
      </Card>

      {/* 프로필 */}
      <Card>
        <SectionTitle title="저장된 프로필" hint="최대 10개까지 저장하고 바로 전환" />
        <ProfileShelf
          profiles={profiles}
          activeId={activeId}
          onSelect={onSelectProfile}
          onDelete={onDeleteProfile}
          onAdd={onAddProfile}
          max={MAX_PROFILES}
        />
      </Card>

      {/* CTA */}
      <div className="grid grid-cols-2 gap-2 pb-2">
        <button
          type="button"
          onClick={onOpenChat}
          className="flex flex-col items-start gap-1 rounded-2xl border border-white/10 bg-gradient-to-br from-violet-glow/25 to-white/[0.02] p-3 text-left active:scale-[0.985]"
        >
          <Icon name="chat" className="h-4 w-4 text-violet-300" />
          <span className="text-[13px] font-semibold text-slate-100">AI 상담</span>
          <span className="text-[10.5px] leading-snug text-slate-400">6단계 통변으로 풀어 보기</span>
        </button>
        <button
          type="button"
          onClick={onOpenChoice}
          className="flex flex-col items-start gap-1 rounded-2xl border border-white/10 bg-gradient-to-br from-gold/20 to-white/[0.02] p-3 text-left active:scale-[0.985]"
        >
          <Icon name="scales" className="h-4 w-4 text-gold" />
          <span className="text-[13px] font-semibold text-slate-100">A vs B 시뮬레이터</span>
          <span className="text-[10.5px] leading-snug text-slate-400">두 갈래 미래를 나란히</span>
        </button>
      </div>

      <p className="pb-2 text-center text-[10px] leading-relaxed text-slate-600">
        사주는 정해진 운명이 아니라 지금의 기운을 읽는 지도입니다.
        <br />
        오행 {ELEMENT_ORDER.map((el) => `${ELEMENTS[el].ko}${chart.elementCounts[el]}`).join(' ')}
      </p>
    </div>
  );
}
