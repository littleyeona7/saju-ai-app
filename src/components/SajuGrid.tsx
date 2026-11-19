import type { Chart, ElementKey, Pillar } from '../lib/saju';
import { ELEMENTS } from '../lib/saju';
import { cn } from '../lib/utils';

export function elementStyle(element: ElementKey) {
  const hex = ELEMENTS[element].hex;
  return {
    color: hex,
    borderColor: `${hex}55`,
    background: `linear-gradient(180deg, ${hex}24, ${hex}0d)`,
  } as const;
}

function StemCell({ pillar, highlight }: { pillar: Pillar | null; highlight?: boolean }) {
  if (!pillar) {
    return (
      <div className="flex h-[92px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/12 text-slate-600">
        <span className="text-[11px]">시간 모름</span>
      </div>
    );
  }
  return (
    <div
      className={cn(
        'relative flex h-[92px] flex-col items-center justify-center rounded-2xl border px-1',
        highlight && 'ring-2 ring-gold/70 ring-offset-2 ring-offset-ink-950',
      )}
      style={elementStyle(pillar.stemElement)}
    >
      {highlight ? (
        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-gold" />
      ) : null}
      <span className="text-[10px] font-medium opacity-80">{pillar.stemSipsin}</span>
      <span className="hanja text-[30px] font-semibold leading-none tracking-tight">{pillar.stem}</span>
      <span className="mt-0.5 text-[10px] opacity-60">{pillar.stemKo}</span>
    </div>
  );
}

function BranchCell({ pillar }: { pillar: Pillar | null }) {
  if (!pillar) {
    return (
      <div className="flex h-[104px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/12 text-slate-600">
        <span className="text-[11px]">—</span>
      </div>
    );
  }
  return (
    <div
      className="relative flex h-[104px] flex-col items-center justify-center rounded-2xl border px-1"
      style={elementStyle(pillar.branchElement)}
    >
      <span className="hanja text-[30px] font-semibold leading-none tracking-tight">{pillar.branch}</span>
      <span className="mt-0.5 text-[10px] opacity-60">{pillar.branchKo}</span>
      <span className="mt-1 text-[10px] font-medium opacity-80">{pillar.branchSipsin}</span>
      <span className="mt-0.5 max-w-full truncate text-[9px] leading-none opacity-45">
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
      <div className="mb-1.5 grid grid-cols-4 gap-1.5">
        {columns.map((column) => (
          <div key={column.key} className="text-center">
            <span
              className={cn(
                'text-[11px] font-semibold tracking-wide',
                column.isDay ? 'text-gold' : 'text-slate-500',
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

      <div className="my-1 flex items-center justify-center">
        <span className="text-[9px] tracking-[0.3em] text-slate-600">천 간 · 지 지</span>
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
