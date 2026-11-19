import { useCallback, useMemo, useState } from 'react';
import type { Profile, ProfileNote, Settings } from '../types';
import { DAY_MASTER_NOTE, type Chart } from '../lib/saju';
import { buildChatSystemPrompt } from '../lib/prompts';
import { useGeminiChat } from '../hooks/useGeminiChat';
import { useMemoryLearning } from '../hooks/useMemoryLearning';
import { ChatList, Composer, ErrorNotice } from './ChatPanel';
import { MemoryList } from './MemoryPanel';
import { GhostButton, Icon, Sheet } from './ui';
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
  onAddNotes,
  onDeleteNote,
}: {
  profile: Profile;
  chart: Chart;
  partner: { name: string; chart: Chart; notes?: ProfileNote[] } | null;
  settings: Settings;
  onOpenSettings: () => void;
  onToggleAutoRead: (value: boolean) => void;
  onAddNotes: (notes: ProfileNote[]) => void;
  onDeleteNote: (noteId: string) => void;
}) {
  const [memoryOpen, setMemoryOpen] = useState(false);

  const systemInstruction = useMemo(
    () => buildChatSystemPrompt(profile, chart, partner),
    [profile, chart, partner],
  );

  // 기억 추출에는 사주 전체 대신 짧은 맥락만 넘긴다.
  const memoryContext = useMemo(() => {
    const year = chart.seun.find((s) => s.current)?.year;
    return [
      `${profile.birth.name || '이름 없음'} · ${profile.birth.gender === 'male' ? '남성' : '여성'} · 만 ${chart.age}세`,
      `일간 ${chart.dayStem}(${DAY_MASTER_NOTE[chart.dayStem]?.split('·')[0] ?? ''})`,
      chart.currentDaewun ? `현재 대운 ${chart.currentDaewun.ganzhi}` : '',
      year ? `${year}년 세운 ${chart.seun.find((s) => s.current)?.ganzhi}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }, [chart, profile.birth.gender, profile.birth.name]);

  const memory = useMemoryLearning({
    apiKey: settings.apiKey,
    model: settings.model,
    profile,
    context: memoryContext,
    onLearn: onAddNotes,
  });

  const chat = useGeminiChat({
    apiKey: settings.apiKey,
    model: settings.model,
    systemInstruction,
    onDone: (answer, _id, question) => {
      // 답변 표시가 끝난 뒤 조용히 배운다 (상담을 막지 않는다).
      memory.learn({ question, answer, topic: 'AI 상담' });
    },
  });

  const send = useCallback(
    (text: string) => {
      // 이번 질문 주제에 맞는 명리 기준까지 반영한 프롬프트로 보낸다.
      void chat.send(text, buildChatSystemPrompt(profile, chart, partner, text));
    },
    [chat, chart, partner, profile],
  );

  const displayName = profile.birth.name || '연우';
  const hasKey = Boolean(settings.apiKey.trim());
  const noteCount = profile.notes?.length ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line bg-surface/70 px-4 py-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-[16.5px] font-bold text-ink">
            AI 사주 상담
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-faint">
              {chat.modelUsed.replace('gemini-', '')}
            </span>
          </h2>
          <p className="truncate text-[12.5px] text-ink-faint">
            {displayName} · {chart.dayStem}일간 · {DAY_MASTER_NOTE[chart.dayStem]?.split('·')[0]}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMemoryOpen(true)}
            aria-label="AI가 기억한 내용 보기"
            className={cn(
              'flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-lg border px-2 py-2 text-[12px] font-semibold transition-colors',
              noteCount
                ? 'border-gold bg-gold/20 text-gold-ink'
                : 'border-line bg-surface text-ink-faint',
            )}
          >
            <span aria-hidden="true" className="text-[13px] leading-none">
              🧠
            </span>
            기억 {noteCount}건
            {memory.learning ? (
              <span className="h-1.5 w-1.5 animate-soft-pulse rounded-full bg-gold-deep" aria-label="배우는 중" />
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => {
              onToggleAutoRead(!settings.autoRead);
            }}
            aria-label="음성 읽기 전환"
            className={cn(
              'rounded-lg border p-2 transition-colors',
              settings.autoRead
                ? 'border-gold bg-gold/20 text-gold-ink'
                : 'border-line bg-surface text-ink-faint',
            )}
          >
            <Icon name={settings.autoRead ? 'volume' : 'mute'} className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (chat.messages.length && window.confirm('이 상담 내용을 지우고 새로 시작할까요?')) chat.reset();
            }}
            aria-label="상담 초기화"
            className="rounded-lg border border-line bg-surface p-2 text-ink-faint"
          >
            <Icon name="trash" className="h-[18px] w-[18px]" />
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
            <div className="rounded-2xl border border-gold/50 bg-gradient-to-br from-[#fdf6e7] to-surface p-4">
              <p className="text-[17px] font-bold text-ink">안녕하세요, {displayName} 님 🔮</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink-muted">
                사주 원국과 대운·세운을 이미 계산해 두었어요. 고민을 말씀해 주시면 6단계 통변으로 풀어 드릴게요.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5 text-[12.5px] font-medium text-ink-muted">
                <span className="rounded-full border border-line bg-surface px-2.5 py-0.5">{chart.dayStem}일간</span>
                <span className="rounded-full border border-line bg-surface px-2.5 py-0.5">{chart.strength.label}</span>
                {chart.currentDaewun ? (
                  <span className="rounded-full border border-line bg-surface px-2.5 py-0.5">
                    {chart.currentDaewun.ganzhi} 대운
                  </span>
                ) : null}
                <span className="rounded-full border border-line bg-surface px-2.5 py-0.5">
                  {chart.seun.find((s) => s.current)?.ganzhi} 세운
                </span>
              </div>
            </div>

            {noteCount ? (
              <button
                type="button"
                onClick={() => setMemoryOpen(true)}
                className="flex w-full items-start gap-2 rounded-2xl border border-line bg-surface p-3.5 text-left active:bg-surface-2"
              >
                <span aria-hidden="true" className="text-[15px] leading-none">
                  🧠
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold text-ink">
                    지난 상담에서 기억한 것 {noteCount}건
                  </span>
                  <span className="mt-1 block truncate text-[12.5px] text-ink-muted">
                    {profile.notes?.[profile.notes.length - 1]?.text}
                  </span>
                </span>
                <Icon name="chevron" className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
              </button>
            ) : null}

            {!hasKey ? (
              <div className="rounded-2xl border border-gold/60 bg-[#fdf6e7] p-4">
                <p className="flex items-center gap-1.5 text-[14.5px] font-bold text-gold-ink">
                  <Icon name="key" className="h-4 w-4" /> Gemini API 키가 필요해요
                </p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">
                  무료 키를 넣으면 바로 상담을 시작할 수 있어요. 키는 이 기기에만 저장됩니다.
                </p>
                <GhostButton onClick={onOpenSettings} className="mt-2.5 w-full border-gold/70 bg-surface py-2 text-[14px] text-gold-ink">
                  설정에서 키 넣기
                </GhostButton>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => send(suggestion)}
                    className="rounded-full border border-line bg-surface px-3 py-2 text-[13.5px] font-medium text-ink-soft active:bg-surface-2"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        }
      />

      {memory.justLearned.length ? (
        <div className="mx-3 mb-2 flex items-start gap-2 rounded-xl border border-gold/50 bg-gold/10 px-3 py-2">
          <span aria-hidden="true" className="mt-0.5 text-[13px] leading-none">
            🧠
          </span>
          <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-gold-ink">
            새로 기억했어요 — {memory.justLearned.join(' · ')}
          </p>
          <button
            type="button"
            aria-label="기억 알림 닫기"
            onClick={memory.clearJustLearned}
            className="shrink-0 rounded-md p-1 text-gold-ink"
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <ErrorNotice error={chat.error} onRetry={() => chat.clearError()} />
      <Composer
        onSend={send}
        streaming={chat.streaming}
        onStop={chat.stop}
        disabled={!hasKey}
        placeholder={hasKey ? '고민을 편하게 말해 보세요' : '설정에서 API 키를 먼저 넣어 주세요'}
      />

      <Sheet open={memoryOpen} onClose={() => setMemoryOpen(false)} title="AI가 기억한 것">
        <p className="mb-3 text-[13px] leading-relaxed text-ink-faint">
          {displayName} 님과의 상담에서 배운 사실이에요. 다음 상담과 A vs B 비교에 자동으로 반영됩니다.
          지운 기억은 다음 답변부터 쓰지 않아요. 이 기기에만 저장됩니다.
        </p>
        <MemoryList
          notes={profile.notes}
          onDelete={onDeleteNote}
          emptyHint="아직 배운 내용이 없어요. 상담에서 결혼·일·건강 같은 실제 이야기를 나누면 여기에 하나씩 쌓입니다."
        />
      </Sheet>
    </div>
  );
}
