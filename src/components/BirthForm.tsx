import { useEffect, useMemo, useRef, useState } from 'react';
import type { BirthInput, CalendarType, Gender } from '../types';
import { Field, PrimaryButton, Segmented, Toggle, inputClass, selectClass } from './ui';
import { cn } from '../lib/utils';
import { isLeapMonthValid } from '../lib/saju';

const pad = (n: number) => String(n).padStart(2, '0');

function daysInSolarMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

interface Props {
  initial?: BirthInput | null;
  submitLabel?: string;
  showSaveOption?: boolean;
  defaultSave?: boolean;
  showGender?: boolean;
  nameLabel?: string;
  onSubmit: (birth: BirthInput, options: { save: boolean }) => void;
  onCancel?: () => void;
  /** 저장/취소 버튼을 숨기고 값만 모을 때 (배우자 직접 입력) */
  minimal?: boolean;
}

function defaults(initial?: BirthInput | null): BirthInput {
  return (
    initial ?? {
      name: '',
      calendar: 'solar',
      year: 1990,
      month: 1,
      day: 1,
      leapMonth: false,
      timeKnown: true,
      hour: 12,
      minute: 0,
      gender: 'female',
    }
  );
}

export function BirthForm({
  initial,
  submitLabel = '사주 보기',
  showSaveOption = true,
  defaultSave = true,
  showGender = true,
  nameLabel = '이름 (선택)',
  onSubmit,
  onCancel,
  minimal = false,
}: Props) {
  const base = defaults(initial);
  const [name, setName] = useState(base.name);
  const [calendar, setCalendar] = useState<CalendarType>(base.calendar);
  const [year, setYear] = useState(base.year);
  const [month, setMonth] = useState(base.month);
  const [day, setDay] = useState(base.day);
  const [leapMonth, setLeapMonth] = useState(base.leapMonth);
  const [gender, setGender] = useState<Gender>(base.gender);
  const [timeKnown, setTimeKnown] = useState(base.timeKnown);
  const [hour, setHour] = useState(base.hour);
  const [minute, setMinute] = useState(base.minute);
  const timeRef = useRef<HTMLInputElement | null>(null);
  const [save, setSave] = useState(defaultSave);
  const [error, setError] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = currentYear; y >= 1920; y -= 1) list.push(y);
    return list;
  }, [currentYear]);

  const leapAvailable = calendar === 'lunar' && isLeapMonthValid(year, month);

  useEffect(() => {
    if (!leapAvailable && leapMonth) setLeapMonth(false);
  }, [leapAvailable, leapMonth]);

  const maxDay = useMemo(() => {
    if (calendar === 'solar') return daysInSolarMonth(year, month);
    return 30;
  }, [calendar, year, month]);

  useEffect(() => {
    if (day > maxDay) setDay(maxDay);
  }, [day, maxDay]);

  const handleSubmit = () => {
    setError(null);
    if (calendar === 'solar' && day > daysInSolarMonth(year, month)) {
      setError('그 달에는 그 날짜가 없습니다.');
      return;
    }
    if (calendar === 'lunar' && leapMonth && !isLeapMonthValid(year, month)) {
      setError(`${year}년 ${month}월에는 윤달이 없습니다.`);
      return;
    }
    const birth: BirthInput = {
      name: name.trim(),
      calendar,
      year,
      month,
      day,
      leapMonth: calendar === 'lunar' ? leapMonth : false,
      timeKnown,
      hour: timeKnown ? hour : 12,
      minute: timeKnown ? minute : 0,
      gender,
    };
    onSubmit(birth, { save });
  };

  return (
    <div className="space-y-4">
      {!minimal ? (
        <Field label={nameLabel}>
          <input
            className={inputClass}
            value={name}
            onChange={(event) => setName(event.target.value.slice(0, 20))}
            placeholder="예: 연우"
            autoComplete="off"
          />
        </Field>
      ) : null}

      <div>
        <span className="mb-1.5 block text-[13px] font-semibold tracking-wide text-ink-muted">달력</span>
        <Segmented
          options={[
            { value: 'solar', label: '양력' },
            { value: 'lunar', label: '음력' },
          ]}
          value={calendar}
          onChange={(value) => {
            setCalendar(value);
            setError(null);
          }}
        />
      </div>

      <div>
        <span className="mb-1.5 block text-[13px] font-semibold tracking-wide text-ink-muted">태어난 날</span>
        <div className="grid grid-cols-[1.35fr_1fr_1fr] gap-1.5">
          <select className={selectClass} value={year} onChange={(event) => setYear(Number(event.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
          <select className={selectClass} value={month} onChange={(event) => setMonth(Number(event.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
          <select className={selectClass} value={day} onChange={(event) => setDay(Number(event.target.value))}>
            {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}일
              </option>
            ))}
          </select>
        </div>
        {calendar === 'lunar' ? (
          <label
            className={cn(
              'mt-2 flex items-center gap-1.5 text-[12.5px]',
              leapAvailable ? 'text-ink-muted' : 'text-ink-faint',
            )}
          >
            <input
              type="checkbox"
              checked={leapMonth}
              disabled={!leapAvailable}
              onChange={(event) => setLeapMonth(event.target.checked)}
              className="h-4 w-4 accent-[#c1912f]"
            />
            윤달 (이 해에는 {leapAvailable ? `${month}월 윤달이 있어요` : '해당 윤달이 없어요'})
          </label>
        ) : null}
      </div>

      {showGender ? (
        <div>
          <span className="mb-1.5 block text-[13px] font-semibold tracking-wide text-ink-muted">성별</span>
          <Segmented
            options={[
              { value: 'female', label: '여성' },
              { value: 'male', label: '남성' },
            ]}
            value={gender}
            onChange={(value) => setGender(value)}
          />
        </div>
      ) : null}

      <div className="rounded-xl border border-line bg-surface-2 p-3">
        <Toggle
          checked={timeKnown}
          onChange={setTimeKnown}
          label="태어난 시간을 알아요"
          description="모르면 시주(時柱)를 비우고 년·월·일주로만 해석합니다."
        />
        {timeKnown ? (
          <input
            ref={timeRef}
            type="time"
            defaultValue={`${pad(base.hour)}:${pad(base.minute)}`}
            onChange={(event) => {
              const matched = event.target.value.match(/^(\d{1,2}):(\d{2})/);
              if (matched) {
                setHour(Number(matched[1]));
                setMinute(Number(matched[2]));
              } else {
                setHour(12);
                setMinute(0);
              }
            }}
            className={cn(inputClass, 'mt-3 text-center text-[17px] tabular-nums')}
          />
        ) : null}
      </div>

      {showSaveOption ? (
        <label className="flex items-start gap-2.5 rounded-xl border border-line bg-surface p-3">
          <input
            type="checkbox"
            checked={save}
            onChange={(event) => setSave(event.target.checked)}
            className="mt-0.5 h-[18px] w-[18px] accent-[#c1912f]"
          />
          <span className="min-w-0">
            <span className="block text-[14.5px] font-semibold text-ink">이 프로필 저장하기</span>
            <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-faint">
              저장하면 다음에 바로 꺼내 쓸 수 있어요. (최대 10개, 이 기기에만 저장)
            </span>
          </span>
        </label>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13.5px] text-rose-700">{error}</p>
      ) : null}

      <PrimaryButton onClick={handleSubmit}>
        <span>{submitLabel}</span>
      </PrimaryButton>

      {onCancel ? (
        <button type="button" onClick={onCancel} className="w-full py-1.5 text-[14px] font-medium text-ink-faint">
          취소
        </button>
      ) : null}
    </div>
  );
}
