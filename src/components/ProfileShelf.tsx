import type { Profile } from '../types';
import { calcSolarSummary } from '../lib/profileUtils';
import { cn } from '../lib/utils';
import { Icon } from './ui';

export function ProfileShelf({
  profiles,
  activeId,
  onSelect,
  onDelete,
  onAdd,
  max,
}: {
  profiles: Profile[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  max: number;
}) {
  return (
    <div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {profiles.map((profile) => {
          const active = profile.id === activeId;
          return (
            <div
              key={profile.id}
              className={cn(
                'relative w-[158px] shrink-0 rounded-xl border p-3 transition-colors',
                active ? 'border-gold bg-gold/15' : 'border-line bg-surface-2',
              )}
            >
              <button type="button" onClick={() => onSelect(profile.id)} className="block w-full text-left">
                <div className="flex items-center gap-1.5 pr-5">
                  <span className={cn('truncate text-[15px] font-bold', active ? 'text-gold-ink' : 'text-ink')}>
                    {profile.birth.name || '이름 없음'}
                  </span>
                  <span className="shrink-0 text-[12px] font-medium text-ink-faint">
                    {profile.birth.gender === 'male' ? '남' : '여'}
                  </span>
                </div>
                <div className="mt-1 text-[12.5px] leading-snug text-ink-muted">{calcSolarSummary(profile.birth)}</div>
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {active ? (
                    <span className="rounded-full bg-gold-deep px-2 py-0.5 text-[10.5px] font-bold text-white">사용 중</span>
                  ) : null}
                  <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10.5px] font-medium text-ink-muted">
                    {profile.birth.calendar === 'lunar' ? '음력' : '양력'}
                  </span>
                  {profile.marriage.status === 'married' ? (
                    <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10.5px] font-medium text-ink-muted">
                      기혼
                    </span>
                  ) : null}
                </div>
              </button>
              <button
                type="button"
                aria-label="프로필 삭제"
                onClick={() => {
                  if (window.confirm(`'${profile.birth.name || '이름 없음'}' 프로필을 삭제할까요?`)) onDelete(profile.id);
                }}
                className="absolute right-1.5 top-1.5 rounded-md p-1.5 text-ink-faint transition-colors active:bg-surface-3 active:text-rose-700"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>
          );
        })}

        {profiles.length < max ? (
          <button
            type="button"
            onClick={onAdd}
            className="flex w-[112px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong bg-surface py-3 text-ink-faint transition-colors active:bg-surface-2"
          >
            <Icon name="plus" className="h-5 w-5" />
            <span className="text-[12.5px] font-medium">프로필 추가</span>
          </button>
        ) : (
          <div className="flex w-[112px] shrink-0 flex-col items-center justify-center rounded-xl border border-line bg-surface-2 py-3 text-center text-[12px] leading-snug text-ink-faint">
            최대 {max}개
            <br />
            저장됨
          </div>
        )}
      </div>
      <p className="mt-2 text-[12px] text-ink-faint">
        저장된 프로필 {profiles.length}/{max} · 이 기기에만 저장됩니다.
      </p>
    </div>
  );
}
