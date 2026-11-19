import type { BirthInput } from '../types';
import { BirthForm } from './BirthForm';
import { Card } from './ui';

export function Onboarding({
  onSubmit,
  onCancel,
  savedCount,
}: {
  onSubmit: (birth: BirthInput, options: { save: boolean }) => void;
  onCancel?: () => void;
  savedCount: number;
}) {
  return (
    <div className="mx-auto w-full max-w-md px-4 pb-8 pt-6">
      <div className="animate-fade-up text-center">
        <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-gold/30 blur-xl" />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full border border-gold bg-gradient-to-b from-[#fdf3df] to-surface text-[32px] shadow-[0_10px_30px_-14px_rgba(193,145,47,0.7)]">
            🔮
          </span>
        </div>
        <h1 className="mt-3 text-[25px] font-bold tracking-tight text-ink">사주 AI</h1>
        <p className="mt-2 text-[14.5px] leading-relaxed text-ink-muted">
          생년월일시로 만세력을 세우고,
          <br />
          인생의 갈림길을 명리로 함께 봅니다.
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5 text-[12px] font-medium text-ink-faint">
          <span className="rounded-full border border-line bg-surface px-2.5 py-1">만세력 자동 계산</span>
          <span className="rounded-full border border-line bg-surface px-2.5 py-1">6단계 통변</span>
          <span className="rounded-full border border-line bg-surface px-2.5 py-1">A vs B 운명 시뮬레이터</span>
        </div>
      </div>

      <Card className="mt-5 animate-fade-up border-line-strong">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-ink">내 사주 입력</h2>
          {savedCount > 0 ? <span className="text-[12.5px] text-ink-faint">저장된 프로필 {savedCount}/10</span> : null}
        </div>
        <BirthForm
          onSubmit={onSubmit}
          onCancel={onCancel}
          defaultSave={savedCount < 10}
          submitLabel="내 사주 보기"
        />
      </Card>

      <p className="mt-4 text-center text-[11.5px] leading-relaxed text-ink-faint">
        입력한 정보는 이 기기(브라우저)에만 저장되며 서버로 보내지 않습니다.
        <br />
        AI 상담을 쓸 때만 설정한 Gemini API로 사주 정보가 전송됩니다.
      </p>
    </div>
  );
}
