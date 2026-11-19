import { useState } from 'react';
import type { Settings } from '../types';
import { DEFAULT_MODEL, MODEL_OPTIONS } from '../constants';
import { testConnection } from '../lib/gemini';
import { GhostButton, Sheet, Toggle, inputClass, selectClass } from './ui';
import { cn } from '../lib/utils';

export function SettingsModal({
  open,
  onClose,
  settings,
  onChange,
  onClearAll,
  speechSupported,
  onPreviewVoice,
}: {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onChange: (next: Settings) => void;
  onClearAll: () => void;
  speechSupported: boolean;
  onPreviewVoice: () => void;
}) {
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const isCustomModel = !MODEL_OPTIONS.some((option) => option.value === settings.model);

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      if (!settings.apiKey.trim()) {
        setTestResult({ ok: false, message: 'API 키를 먼저 넣어 주세요.' });
        return;
      }
      const name = await testConnection(settings.apiKey.trim(), settings.model);
      setTestResult({ ok: true, message: `연결 성공 · ${name}` });
    } catch (error) {
      const message = error instanceof Error ? error.message : '연결에 실패했습니다.';
      setTestResult({ ok: false, message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="설정">
      <div className="space-y-6">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-slate-200">Gemini API 키</h3>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-500">이 기기에만 저장</span>
          </div>
          <div className="relative">
            <input
              className={cn(inputClass, 'pr-16 font-mono text-[13px]')}
              type={showKey ? 'text' : 'password'}
              value={settings.apiKey}
              onChange={(event) => onChange({ ...settings, apiKey: event.target.value })}
              placeholder="AIza..."
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setShowKey((value) => !value)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[11px] text-slate-400 active:bg-white/10"
            >
              {showKey ? '숨기기' : '보기'}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-gold underline decoration-gold/40 underline-offset-2"
            >
              Google AI Studio
            </a>
            에서 무료로 키를 만들 수 있어요. 키는 브라우저(localStorage)에만 저장되고 서버로 보내지 않습니다.
          </p>

          <div className="mt-3">
            <span className="mb-1 block text-[11px] font-medium tracking-wide text-slate-400">모델</span>
            <select
              className={selectClass}
              value={isCustomModel ? '__custom__' : settings.model}
              onChange={(event) => {
                const value = event.target.value;
                if (value === '__custom__') return;
                onChange({ ...settings, model: value });
              }}
            >
              {MODEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
              <option value="__custom__">직접 입력…</option>
            </select>
            {isCustomModel ? (
              <input
                className={cn(inputClass, 'mt-1.5 font-mono text-[13px]')}
                value={settings.model}
                onChange={(event) => onChange({ ...settings, model: event.target.value.trim() })}
                placeholder={`예: ${DEFAULT_MODEL}`}
                spellCheck={false}
              />
            ) : null}
            <p className="mt-1 text-[10.5px] text-slate-600">
              기본값은 {DEFAULT_MODEL}입니다. 모델을 찾지 못하면 자동으로 대체 모델을 시도합니다.
            </p>
          </div>

          <div className="mt-2.5 flex items-center gap-2">
            <GhostButton onClick={runTest} className="py-1.5 text-[12px]">
              {testing ? '확인 중…' : '연결 테스트'}
            </GhostButton>
            {testResult ? (
              <span className={cn('text-[11px]', testResult.ok ? 'text-emerald-300' : 'text-rose-300')}>
                {testResult.ok ? '✓ ' : '✕ '}
                {testResult.message}
              </span>
            ) : null}
          </div>
        </section>

        <section className="border-t border-white/8 pt-4">
          <h3 className="mb-2 text-[13px] font-semibold text-slate-200">음성</h3>
          <Toggle
            checked={settings.autoRead}
            onChange={(value) => onChange({ ...settings, autoRead: value })}
            label="AI 답변을 자동으로 읽어 주기"
            description={speechSupported ? '한국어 음성으로 답변을 읽습니다.' : '이 브라우저에서는 음성 읽기를 지원하지 않아요.'}
          />
          <div className="mt-3 flex items-center gap-3">
            <span className="w-14 shrink-0 text-[11px] text-slate-400">속도</span>
            <input
              type="range"
              min={0.7}
              max={1.5}
              step={0.1}
              value={settings.speechRate}
              onChange={(event) => onChange({ ...settings, speechRate: Number(event.target.value) })}
              className="flex-1 accent-[#f2d08a]"
            />
            <span className="w-8 text-right text-[11px] tabular-nums text-slate-400">{settings.speechRate.toFixed(1)}x</span>
          </div>
          <GhostButton onClick={onPreviewVoice} className="mt-2 py-1.5 text-[12px]">
            목소리 미리 듣기
          </GhostButton>
        </section>

        <section className="border-t border-white/8 pt-4">
          <h3 className="mb-2 text-[13px] font-semibold text-slate-200">데이터</h3>
          <p className="text-[11px] leading-relaxed text-slate-500">
            사주 프로필과 채팅 기록은 이 브라우저에만 저장됩니다. 앱을 지우면 함께 사라집니다.
          </p>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('저장된 프로필을 모두 지울까요? 이 작업은 되돌릴 수 없습니다.')) onClearAll();
            }}
            className="mt-2 w-full rounded-xl border border-rose-400/25 bg-rose-500/10 py-2 text-[12.5px] font-medium text-rose-200"
          >
            저장된 프로필 모두 지우기
          </button>
        </section>

        <p className="pb-2 text-center text-[10.5px] leading-relaxed text-slate-600">
          사주 AI · 만세력 엔진 lunar-javascript
          <br />
          입력한 사주 정보는 상담 시에만 Gemini API로 전송됩니다.
        </p>
      </div>
    </Sheet>
  );
}
