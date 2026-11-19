import type { ProfileNote } from '../types';
import { newestFirst } from '../lib/memory';
import { cn } from '../lib/utils';
import { Icon } from './ui';

export function formatNoteDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

/**
 * AI가 상담에서 배운 기억 목록.
 * AI 상담의 🧠 기억 서랍과 내 사주의 기억 카드가 같은 모양을 쓴다.
 */
export function MemoryList({
  notes,
  onDelete,
  emptyHint,
  className,
}: {
  notes: ProfileNote[] | undefined;
  onDelete: (id: string) => void;
  emptyHint: string;
  className?: string;
}) {
  const items = newestFirst(notes);

  if (!items.length) {
    return (
      <p className={cn('rounded-xl border border-dashed border-line-strong bg-surface-2 px-3.5 py-3.5 text-[13.5px] leading-relaxed text-ink-faint', className)}>
        {emptyHint}
      </p>
    );
  }

  return (
    <ul className={cn('space-y-2', className)}>
      {items.map((note) => (
        <li
          key={note.id}
          className="flex items-start gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5"
        >
          <span aria-hidden="true" className="mt-0.5 text-[13.5px] leading-none">
            🧠
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] leading-relaxed text-ink-soft">{note.text}</p>
            <p className="mt-1 text-[11.5px] text-ink-faint">{formatNoteDate(note.createdAt)}</p>
          </div>
          <button
            type="button"
            aria-label="기억 삭제"
            onClick={() => {
              if (window.confirm('이 기억을 지울까요? 다음 상담부터 반영되지 않아요.')) onDelete(note.id);
            }}
            className="shrink-0 rounded-md p-1.5 text-ink-faint transition-colors active:bg-surface-3 active:text-rose-700"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}
