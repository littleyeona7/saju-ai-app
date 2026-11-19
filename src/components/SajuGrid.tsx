import type { Chart, ElementKey, Pillar } from '../lib/saju';
import { ELEMENTS } from '../lib/saju';
import { cn } from '../lib/utils';

export function elementStyle(element: ElementKey) {
  const hex = ELEMENTS[element].hex;
  return {
    color: hex,
    borderColor: `${hex}59`,
    background: `linear-gradient(180deg, ${hex}1c, ${hex}08)`,
  } as const;
}

function StemCell({ pillar, highlight }: { pillar: Pillar | null; highlight?: boolean }) {
  if (!pillar) {
    return (
      <div className="flex h-[104px] flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-surface-2 text-ink-faint">
        <span className="text-[11.5px]">시간 모름</span>
      </div>
    );
  }
  return (
    <div
      className={cn(
        'relative flex h-[104px] flex-col items-center justify-center rounded-2xl border px-1',
        highlight && 'ring-2 ring-gold-deep/60 ring-offset-2 ring-offset-surface',
      )}
      style={elementStyle(pillar.stemElement)}
    >
      {highlight ? (
        <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-gold-deep" />
      ) : null}
      <span className="text-[11.5px] font-semibold">{pillar.stemSipsin}</span>
      <span className="hanja mt-0.5 text-[34px] font-bold leading-none tracking-tight">{pillar.stem}</span>
      <span className="mt-1 text-[11.5px] font-medium text-ink-faint">{pillar.stemKo}</span>
    </div>
  );
}

function BranchCell({ pillar }: { pillar: Pillar | null }) {
  if (!pillar) {
    return (
      <div className="flex h-[118px] flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-surface-2 text-ink-faint">
        <span className="text-[11.5px]">—</span>
      </div>
    );
  }
  return (
    <div
      className="relative flex h-[118px] flex-col items-center justify-center rounded-2xl border px-1"
      style={elementStyle(pillar.branchElement)}
    >
      <span className="hanja text-[34px] font-bold leading-none tracking-tight">{pillar.branch}</span>
      <span className="mt-1 text-[11.5px] font-medium text-ink-faint">{pillar.branchKo}</span>
      <span className="mt-1 text-[11.5px] font-semibold">{pillar.branchSipsin}</span>
      <span className="mt-1 max-w-full truncate text-[11px] leading-none text-ink-faint">
        {pillar.hidden.map((h) => h.char).join('·')}
      </span>
    </div>
  );
}

export function SajuGrid({ chart }: { chart: Chart }) {
  const columns: { key: string; label: string; pillar: Pillar | null; isDay: boolean }[] = [
    { key: 'hour', label: '시주', pillar: chart.pillars.hour, isDay: false },
    { key: 'day', label: '일주', pillar: chart.pillars.day, isDay: true },
    { key: 'month', label: '월주', pillar: chart.pillars.month, isDay: false },
    { key: 'year', label: '년주', pillar: chart.pillars.year, isDay: false },
  ];

  return (
    <div className="select-none">
      <div className="mb-2 grid grid-cols-4 gap-1.5">
        {columns.map((column) => (
          <div key={column.key} className="text-center">
            <span
              className={cn(
                'text-[13px] font-bold tracking-wide',
                column.isDay ? 'text-gold-ink' : 'text-ink-faint',
              )}
            >
              {column.label}
            </span>
          </div>
        ))}
      </div>

      {/* 천간 (윗줄) */}
      <div className="grid grid-cols-4 gap-1.5">
        {columns.map((column) => (
          <StemCell key={`stem-${column.key}`} pillar={column.pillar} highlight={column.isDay} />
        ))}
      </div>

      <div className="my-2.5 flex items-center gap-2.5">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[10.5px] tracking-[0.25em] text-ink-faint">천 간 · 지 지</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      {/* 지지 (아랫줄) */}
      <div className="grid grid-cols-4 gap-1.5">
        {columns.map((column) => (
          <BranchCell key={`branch-${column.key}`} pillar={column.pillar} />
        ))}
      </div>
    </div>
  );
}
