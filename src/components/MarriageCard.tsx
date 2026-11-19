import { useMemo, useState } from 'react';
import type { BirthInput, MarriageInfo, Profile } from '../types';
import { buildChart } from '../lib/saju';
import { partnerBirthOf } from '../lib/profileUtils';
import { BirthForm } from './BirthForm';
import { Chip, GhostButton, Segmented, Sheet, selectClass } from './ui';
import { cn } from '../lib/utils';

const pad = (n: number) => String(n).padStart(2, '0');

export function MarriageCard({
  profile,
  profiles,
  onChange,
}: {
  profile: Profile;
  profiles: Profile[];
  onChange: (marriage: MarriageInfo) => void;
}) {
  const [manualOpen, setManualOpen] = useState(false);
  const marriage = profile.marriage;
  const currentYear = new Date().getFullYear();
  const others = profiles.filter((item) => item.id !== profile.id);
  const partner = useMemo(() => partnerBirthOf(profile, profiles), [profile, profiles]);
  const partnerChart = useMemo(() => {
    if (!partner) return null;
    try {
      return buildChart(partner.birth);
    } catch {
      return null;
    }
  }, [partner]);

  const patch = (next: Partial<MarriageInfo>) => onChange({ ...marriage, ...next });

  const date = marriage.date ?? { year: currentYear - 5, month: 1, day: 1 };
  const maxDay = new Date(date.year, date.month, 0).getDate();

  return (
    <div className="space-y-3">
      <Segmented
        options={[
          { value: 'single', label: '미혼' },
          { value: 'married', label: '기혼' },
        ]}
        value={marriage.status}
        onChange={(value) =>
          patch({
            status: value,
            date: value === 'married' ? marriage.date ?? { year: currentYear - 5, month: 1, day: 1 } : null,
          })
        }
      />

      {marriage.status === 'married' ? (
        <div>
          <span className="mb-1.5 block text-[13px] font-semibold tracking-wide text-ink-muted">혼인일 (연·월·일)</span>
          <div className="grid grid-cols-3 gap-1.5">
            <select
              className={selectClass}
              value={date.year}
              onChange={(event) => patch({ date: { ...date, year: Number(event.target.value) } })}
            >
              {Array.from({ length: 70 }, (_, i) => currentYear + 1 - i).map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
            <select
              className={selectClass}
              value={date.month}
              onChange={(event) => patch({ date: { ...date, month: Number(event.target.value) } })}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}월
                </option>
              ))}
            </select>
            <select
              className={selectClass}
              value={Math.min(date.day, maxDay)}
              onChange={(event) => patch({ date: { ...date, day: Number(event.target.value) } })}
            >
              {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}일
                </option>
              ))}
            </select>
          </div>
          <p className="mt-1.5 text-[12px] text-ink-faint">혼인일은 배우자 인연의 시기를 함께 읽는 데 쓰입니다.</p>
        </div>
      ) : null}

      <div className="rounded-xl border border-line bg-surface-2 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] font-semibold tracking-wide text-ink-muted">배우자 사주 연결</span>
          {partner ? <Chip tone="ok">연결됨</Chip> : <Chip>선택</Chip>}
        </div>

        {others.length > 0 ? (
          <select
            className={cn(selectClass, 'mb-2 text-[15px]')}
            value={marriage.partnerProfileId ?? ''}
            onChange={(event) => {
              const value = event.target.value;
              patch({ partnerProfileId: value || null, partnerManual: null });
            }}
          >
            <option value="">저장된 프로필에서 고르기</option>
            {others.map((item) => (
              <option key={item.id} value={item.id}>
                {item.birth.name || '이름 없음'} ({item.birth.year}.{pad(item.birth.month)}.
                {pad(item.birth.day)} {item.birth.gender === 'male' ? '남' : '여'})
              </option>
            ))}
          </select>
        ) : (
          <p className="mb-2 text-[12.5px] leading-snug text-ink-faint">
            저장된 다른 프로필이 있으면 여기서 바로 고를 수 있어요.
          </p>
        )}

        <div className="flex gap-1.5">
          <GhostButton className="flex-1 py-2 text-[13px]" onClick={() => setManualOpen(true)}>
            {marriage.partnerManual ? '배우자 정보 수정' : '직접 입력'}
          </GhostButton>
          {marriage.partnerProfileId || marriage.partnerManual ? (
            <GhostButton
              className="py-2 text-[13px] text-rose-700"
              onClick={() => patch({ partnerProfileId: null, partnerManual: null })}
            >
              연결 해제
            </GhostButton>
          ) : null}
        </div>

        {partner && partnerChart ? (
          <div className="mt-3 rounded-lg border border-line bg-surface p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[14px] font-bold text-ink">{partner.name || '배우자'}</span>
              <span className="text-[12.5px] text-ink-faint">
                {partner.birth.calendar === 'lunar' ? '음력' : '양력'} {partner.birth.year}.{pad(partner.birth.month)}.
                {pad(partner.birth.day)}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[13px] text-ink-muted">
              {[partnerChart.pillars.year, partnerChart.pillars.month, partnerChart.pillars.day, partnerChart.pillars.hour]
                .filter(Boolean)
                .map((pillar, index) => (
                  <span key={index} className="hanja rounded border border-line bg-surface-2 px-1.5 py-0.5">
                    {pillar!.stem}
                    {pillar!.branch}
                  </span>
                ))}
              <span className="ml-auto text-[12px] text-ink-faint">
                일간 {partnerChart.dayStem} · {partnerChart.strength.label}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      <Sheet open={manualOpen} onClose={() => setManualOpen(false)} title="배우자 사주 직접 입력">
        <BirthForm
          initial={marriage.partnerManual?.birth ?? null}
          submitLabel="배우자 사주 연결"
          showSaveOption={false}
          nameLabel="배우자 이름 (선택)"
          onSubmit={(birth: BirthInput) => {
            patch({ partnerManual: { name: birth.name, birth }, partnerProfileId: null });
            setManualOpen(false);
          }}
          onCancel={() => setManualOpen(false)}
        />
      </Sheet>
    </div>
  );
}
