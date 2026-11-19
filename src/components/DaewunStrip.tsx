import { useEffect, useRef } from 'react';
import { ELEMENTS, type Chart, type LuckPillar } from '../lib/saju';
import { cn } from '../lib/utils';

function LuckCard({ item }: { item: LuckPillar }) {
  const active = item.current;
  return (
    <div
      className={cn(
        'flex w-[92px] shrink-0 flex-col items-center rounded-xl border px-2 py-2.5 transition-colors',
        active ? 'border-gold bg-gold/20 shadow-[0_2px_10px_-6px_rgba(193,145,47,0.8)]' : 'border-line bg-surface-2',
      )}
    >
      <span className={cn('text-[11.5px] font-semibold', active ? 'text-gold-ink' : 'text-ink-faint')}>
        {item.startAge}~{item.endAge}세
      </span>
      <span className="mt-1.5 flex items-baseline gap-1">
        <span className="hanja text-[22px] font-bold leading-none" style={{ color: ELEMENTS[item.stemElement].hex }}>
          {item.stem}
        </span>
        <span className="hanja text-[22px] font-bold leading-none" style={{ color: ELEMENTS[item.branchElement].hex }}>
          {item.branch}
        </span>
      </span>
      <span className="mt-1.5 text-[11.5px] font-medium text-ink-muted">
        {item.stemSipsin}/{item.branchSipsin}
      </span>
      <span className="mt-0.5 text-[11px] tabular-nums text-ink-faint">
        {String(item.startYear).slice(2)}~{String(item.endYear).slice(2)}
      </span>
      {active ? (
        <span className="mt-1.5 rounded-full bg-gold-deep px-2 py-0.5 text-[10px] font-bold text-white">현재</span>
      ) : null}
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
        <span className="shrink-0 text-[12.5px] font-semibold text-ink-faint">세운</span>
        {chart.seun.map((item) => (
          <span
            key={item.year}
            className={cn(
              'shrink-0 rounded-lg border px-2.5 py-1 text-[12.5px] tabular-nums',
              item.current ? 'border-gold bg-gold/20 text-gold-ink' : 'border-line bg-surface-2 text-ink-muted',
            )}
          >
            <span className="mr-1 text-ink-faint">{item.year}</span>
            <span
              className="hanja font-bold"
              style={{ color: item.current ? undefined : ELEMENTS[item.stemElement].hex }}
            >
              {item.ganzhi}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
