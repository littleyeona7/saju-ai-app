import { useMemo } from 'react';
import type { Profile, Settings } from '../types';
import { DAY_MASTER_NOTE, type Chart } from '../lib/saju';
import { buildChatSystemPrompt } from '../lib/prompts';
import { useGeminiChat } from '../hooks/useGeminiChat';
import { ChatList, Composer, ErrorNotice } from './ChatPanel';
import { GhostButton, Icon } from './ui';
import { cn } from '../lib/utils';

const SUGGESTIONS = [
  '올해 운세 어때?',
  '이직해도 될까?',
  '돈은 언제 들어와?',
  '인연은 언제쯤 올까?',
  '내 사주에서 제일 조심할 점은?',
];

export function ChatTab({
  profile,
  chart,
  partner,
  settings,
  onOpenSettings,
  onToggleAutoRead,
}: {
  profile: Profile;
  chart: Chart;
  partner: { name: string; chart: Chart } | null;
  settings: Settings;
  onOpenSettings: () => void;
  onToggleAutoRead: (value: boolean) => void;
}) {
  const systemInstruction = useMemo(
    () => buildChatSystemPrompt(profile, chart, partner),
    [profile, chart, partner],
  );

  const chat = useGeminiChat({
    apiKey: settings.apiKey,
    model: settings.model,
    systemInstruction,
  });

  const displayName = profile.birth.name || '연우';
  const hasKey = Boolean(settings.apiKey.trim());

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-white/8 px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-100">
            AI 사주 상담
            <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[9px] font-normal text-slate-400">
              {chat.modelUsed.replace('gemini-', '')}
            </span>
          </h2>
          <p className="truncate text-[10.5px] text-slate-500">
            {displayName} · {chart.dayStem}일간 · {DAY_MASTER_NOTE[chart.dayStem]?.split('·')[0]}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => {
              onToggleAutoRead(!settings.autoRead);
            }}
            aria-label="음성 읽기 전환"
            className={cn(
              'rounded-lg border p-1.5 transition-colors',
              settings.autoRead
                ? 'border-gold/40 bg-gold/15 text-gold'
                : 'border-white/10 bg-white/5 text-slate-400',
            )}
          >
            <Icon name={settings.autoRead ? 'volume' : 'mute'} className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (chat.messages.length && window.confirm('이 상담 내용을 지우고 새로 시작할까요?')) chat.reset();
            }}
            aria-label="상담 초기화"
            className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-400"
          >
            <Icon name="trash" className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ChatList
        messages={chat.messages}
        streaming={chat.streaming}
        autoRead={settings.autoRead}
        speechRate={settings.speechRate}
        emptyState={
          <div className="animate-fade-up space-y-3 pb-2">
            <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
              <p className="text-[15px] font-semibold text-slate-50">안녕하세요, {displayName} 님 🔮</p>
              <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
                사주 원국과 대운·세운을 이미 계산해 두었어요. 고민을 말씀해 주시면 6단계 통변으로 풀어 드릴게요.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1 text-[10.5px] text-slate-500">
                <span className="rounded-full border border-white/10 px-2 py-0.5">{chart.dayStem}일간</span>
                <span className="rounded-full border border-white/10 px-2 py-0.5">{chart.strength.label}</span>
                {chart.currentDaewun ? (
                  <span className="rounded-full border border-white/10 px-2 py-0.5">{chart.currentDaewun.ganzhi} 대운</span>
                ) : null}
                <span className="rounded-full border border-white/10 px-2 py-0.5">{chart.seun.find((s) => s.current)?.ganzhi} 세운</span>
              </div>
            </div>

            {!hasKey ? (
              <div className="rounded-2xl border border-gold/25 bg-gold/[0.08] p-3.5">
                <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-gold">
                  <Icon name="key" className="h-3.5 w-3.5" /> Gemini API 키가 필요해요
                </p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-slate-300">
                  무료 키를 넣으면 바로 상담을 시작할 수 있어요. 키는 이 기기에만 저장됩니다.
                </p>
                <GhostButton onClick={onOpenSettings} className="mt-2 w-full justify-center border-gold/30 bg-gold/10 py-1.5 text-[12px] text-gold">
                  설정에서 키 넣기
                </GhostButton>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => chat.send(suggestion)}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11.5px] text-slate-300 active:bg-white/10"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        }
      />

      <ErrorNotice error={chat.error} onRetry={() => chat.clearError()} />
      <Composer
        onSend={chat.send}
        streaming={chat.streaming}
        onStop={chat.stop}
        disabled={!hasKey}
        placeholder={hasKey ? '고민을 편하게 말해 보세요' : '설정에서 API 키를 먼저 넣어 주세요'}
      />
    </div>
  );
}
