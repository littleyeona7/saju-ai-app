import { ELEMENTS, ELEMENT_ORDER, type Chart } from '../lib/saju';
import { cn } from '../lib/utils';
import { Chip } from './ui';

export function ElementSummary({ chart }: { chart: Chart }) {
  const total = Math.max(
    1,
    Object.values(chart.elementCounts).reduce((sum, value) => sum + value, 0),
  );
  const max = Math.max(...Object.values(chart.elementCounts), 1);

  return (
    <div>
      <div className="space-y-1.5">
        {ELEMENT_ORDER.map((key) => {
          const meta = ELEMENTS[key];
          const count = chart.elementCounts[key];
          const width = count === 0 ? 0 : Math.max(8, (count / max) * 100);
          return (
            <div key={key} className="flex items-center gap-2.5">
              <span className="flex w-14 shrink-0 items-center gap-1 text-[11px]">
                <span className="hanja font-semibold" style={{ color: meta.hex }}>
                  {meta.hanja}
                </span>
                <span className="text-slate-500">{meta.ko}</span>
              </span>
              <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/6">
                <span
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                  style={{
                    width: `${width}%`,
                    background: `linear-gradient(90deg, ${meta.hex}bb, ${meta.hex})`,
                    opacity: count === 0 ? 0 : 1,
                  }}
                />
              </span>
              <span
                className={cn(
                  'w-5 shrink-0 text-right text-[11px] font-semibold tabular-nums',
                  count === 0 ? 'text-slate-600' : 'text-slate-300',
                )}
              >
                {count}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Chip tone="gold">일간 {chart.dayStem} · {ELEMENTS[chart.dayElement].ko}</Chip>
        <Chip>{chart.strength.label}</Chip>
        {chart.missingElements.length ? (
          <Chip tone="danger">
            없는 오행 · {chart.missingElements.map((el) => ELEMENTS[el].ko).join(' ')}
          </Chip>
        ) : (
          <Chip tone="ok">오행 모두 있음</Chip>
        )}
        <Chip>총 {total}글자</Chip>
      </div>
    </div>
  );
}
