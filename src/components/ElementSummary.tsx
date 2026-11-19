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
      <div className="space-y-2">
        {ELEMENT_ORDER.map((key) => {
          const meta = ELEMENTS[key];
          const count = chart.elementCounts[key];
          const width = count === 0 ? 0 : Math.max(8, (count / max) * 100);
          return (
            <div key={key} className="flex items-center gap-2.5">
              <span className="flex w-16 shrink-0 items-center gap-1.5 text-[13.5px]">
                <span className="hanja text-[15px] font-bold" style={{ color: meta.hex }}>
                  {meta.hanja}
                </span>
                <span className="font-medium text-ink-muted">{meta.ko}</span>
              </span>
              <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                <span
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                  style={{
                    width: `${width}%`,
                    background: `linear-gradient(90deg, ${meta.hex}cc, ${meta.hex})`,
                    opacity: count === 0 ? 0 : 1,
                  }}
                />
              </span>
              <span
                className={cn(
                  'w-5 shrink-0 text-right text-[13.5px] font-bold tabular-nums',
                  count === 0 ? 'text-ink-faint' : 'text-ink',
                )}
              >
                {count}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Chip tone="gold">
          일간 {chart.dayStem} · {ELEMENTS[chart.dayElement].ko}
        </Chip>
        <Chip>{chart.strength.label}</Chip>
        {chart.missingElements.length ? (
          <Chip tone="danger">없는 오행 · {chart.missingElements.map((el) => ELEMENTS[el].ko).join(' ')}</Chip>
        ) : (
          <Chip tone="ok">오행 모두 있음</Chip>
        )}
        <Chip>총 {total}글자</Chip>
      </div>
    </div>
  );
}
