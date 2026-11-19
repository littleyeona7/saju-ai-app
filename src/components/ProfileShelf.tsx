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
                'relative w-[146px] shrink-0 rounded-xl border p-2.5 transition-colors',
                active ? 'border-gold/55 bg-gold/10' : 'border-white/8 bg-white/[0.03]',
              )}
            >
              <button type="button" onClick={() => onSelect(profile.id)} className="block w-full text-left">
                <div className="flex items-center gap-1.5">
                  <span className={cn('truncate text-[13px] font-semibold', active ? 'text-gold' : 'text-slate-200')}>
                    {profile.birth.name || '이름 없음'}
                  </span>
                  <span className="shrink-0 text-[10px] text-slate-500">{profile.birth.gender === 'male' ? '남' : '여'}</span>
                </div>
                <div className="mt-1 text-[10.5px] leading-snug text-slate-500">{calcSolarSummary(profile.birth)}</div>
                <div className="mt-1.5 flex items-center gap-1">
                  {active ? <span className="rounded-full bg-gold px-1.5 text-[9px] font-bold text-ink-950">사용 중</span> : null}
                  <span className="rounded-full border border-white/10 px-1.5 text-[9px] text-slate-400">
                    {profile.birth.calendar === 'lunar' ? '음력' : '양력'}
                  </span>
                  {profile.marriage.status === 'married' ? (
                    <span className="rounded-full border border-white/10 px-1.5 text-[9px] text-slate-400">기혼</span>
                  ) : null}
                </div>
              </button>
              <button
                type="button"
                aria-label="프로필 삭제"
                onClick={() => {
                  if (window.confirm(`'${profile.birth.name || '이름 없음'}' 프로필을 삭제할까요?`)) onDelete(profile.id);
                }}
                className="absolute right-1.5 top-1.5 rounded-md p-1 text-slate-600 transition-colors active:bg-white/10 active:text-rose-300"
              >
                <Icon name="close" className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}

        {profiles.length < max ? (
          <button
            type="button"
            onClick={onAdd}
            className="flex w-[104px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/15 py-2 text-slate-500 transition-colors active:bg-white/5"
          >
            <Icon name="plus" className="h-4 w-4" />
            <span className="text-[11px]">프로필 추가</span>
          </button>
        ) : (
          <div className="flex w-[104px] shrink-0 flex-col items-center justify-center rounded-xl border border-white/8 py-2 text-center text-[10px] leading-snug text-slate-600">
            최대 {max}개
            <br />
            저장됨
          </div>
        )}
      </div>
      <p className="mt-1.5 text-[10.5px] text-slate-600">
        저장된 프로필 {profiles.length}/{max} · 이 기기에만 저장됩니다.
      </p>
    </div>
  );
}
