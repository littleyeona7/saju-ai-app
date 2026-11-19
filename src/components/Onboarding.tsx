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
          <span className="absolute inset-0 rounded-full bg-gold/15 blur-xl" />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full border border-gold/30 bg-gradient-to-b from-white/10 to-white/[0.02] text-[30px] shadow-[0_0_40px_-12px_rgba(242,208,138,0.8)]">
            🔮
          </span>
        </div>
        <h1 className="mt-3 text-[22px] font-bold tracking-tight text-slate-50">사주 AI</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">
          생년월일시로 만세력을 세우고,
          <br />
          인생의 갈림길을 명리로 함께 봅니다.
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5 text-[10.5px] text-slate-500">
          <span className="rounded-full border border-white/10 px-2 py-0.5">만세력 자동 계산</span>
          <span className="rounded-full border border-white/10 px-2 py-0.5">6단계 통변</span>
          <span className="rounded-full border border-white/10 px-2 py-0.5">A vs B 운명 시뮬레이터</span>
        </div>
      </div>

      <Card className="mt-5 animate-fade-up border-white/10 bg-ink-900/70">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-slate-100">내 사주 입력</h2>
          {savedCount > 0 ? <span className="text-[11px] text-slate-500">저장된 프로필 {savedCount}/10</span> : null}
        </div>
        <BirthForm
          onSubmit={onSubmit}
          onCancel={onCancel}
          defaultSave={savedCount < 10}
          submitLabel="내 사주 보기"
        />
      </Card>

      <p className="mt-4 text-center text-[10.5px] leading-relaxed text-slate-600">
        입력한 정보는 이 기기(브라우저)에만 저장되며 서버로 보내지 않습니다.
        <br />
        AI 상담을 쓸 때만 설정한 Gemini API로 사주 정보가 전송됩니다.
      </p>
    </div>
  );
}
