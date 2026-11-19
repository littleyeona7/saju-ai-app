import { useEffect, useRef } from 'react';
import { ELEMENTS, type Chart, type LuckPillar } from '../lib/saju';
import { cn } from '../lib/utils';

function LuckCard({ item }: { item: LuckPillar }) {
  const active = item.current;
  return (
    <div
      className={cn(
        'flex w-[76px] shrink-0 flex-col items-center rounded-xl border px-1.5 py-2 transition-colors',
        active ? 'border-gold/60 bg-gold/12' : 'border-white/8 bg-white/[0.03]',
      )}
    >
      <span className={cn('text-[9px] font-medium', active ? 'text-gold' : 'text-slate-500')}>
        {item.startAge}~{item.endAge}세
      </span>
      <span className="mt-1 flex items-baseline gap-0.5">
        <span className="hanja text-[19px] font-semibold leading-none" style={{ color: ELEMENTS[item.stemElement].hex }}>
          {item.stem}
        </span>
        <span className="hanja text-[19px] font-semibold leading-none" style={{ color: ELEMENTS[item.branchElement].hex }}>
          {item.branch}
        </span>
      </span>
      <span className="mt-1 text-[9px] text-slate-400">
        {item.stemSipsin}/{item.branchSipsin}
      </span>
      <span className="mt-0.5 text-[9px] tabular-nums text-slate-600">
        {String(item.startYear).slice(2)}~{String(item.endYear).slice(2)}
      </span>
      {active ? <span className="mt-1 rounded-full bg-gold px-1.5 text-[8px] font-bold text-ink-950">현재</span> : null}
    </div>
  );
}

export function DaewunStrip({ chart }: { chart: Chart }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const currentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const node = currentRef.current;
    if (!container || !node) return;
    const target = node.offsetLeft - container.clientWidth / 2 + node.clientWidth / 2;
    container.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, []);

  return (
    <div>
      <div ref={containerRef} className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {chart.daewun.map((item) => (
          <div key={`${item.ganzhi}-${item.startYear}`} ref={item.current ? currentRef : undefined}>
            <LuckCard item={item} />
          </div>
        ))}
      </div>

      <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <span className="shrink-0 text-[10px] font-medium text-slate-500">세운</span>
        {chart.seun.map((item) => (
          <span
            key={item.year}
            className={cn(
              'shrink-0 rounded-lg border px-2 py-1 text-[10px] tabular-nums',
              item.current
                ? 'border-gold/60 bg-gold/12 text-gold'
                : 'border-white/8 bg-white/[0.03] text-slate-400',
            )}
          >
            <span className="mr-1 text-slate-500">{item.year}</span>
            <span className="hanja font-semibold" style={{ color: item.current ? undefined : ELEMENTS[item.stemElement].hex }}>
              {item.ganzhi}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
