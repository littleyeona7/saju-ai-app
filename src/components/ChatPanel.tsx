import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../types';
import type { ChatError } from '../hooks/useGeminiChat';
import { useSpeechInput, useSpeechOutput } from '../hooks/useSpeech';
import { cn, toSpeechText } from '../lib/utils';
import { Icon } from './ui';
import { Markdown } from './Markdown';

export function ChatBubble({
  message,
  streaming,
  onSpeak,
  speaking,
}: {
  message: ChatMessage;
  streaming?: boolean;
  onSpeak?: () => void;
  speaking?: boolean;
}) {
  const isUser = message.role === 'user';
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[84%] rounded-2xl rounded-br-md bg-gradient-to-br from-gold/90 to-gold-deep/85 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-950 shadow-sm">
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start">
      <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-white/8 bg-white/[0.05] px-3.5 py-2.5">
        {message.error ? (
          <p className="text-[12.5px] leading-relaxed text-rose-300">{message.error}</p>
        ) : (
          <>
            <Markdown text={message.text} />
            {streaming ? <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-soft-pulse bg-gold align-middle" /> : null}
          </>
        )}
      </div>
      {!message.error && message.text ? (
        <button
          type="button"
          onClick={onSpeak}
          className={cn(
            'mt-1 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] transition-colors',
            speaking ? 'text-gold' : 'text-slate-500 active:bg-white/5',
          )}
        >
          <Icon name={speaking ? 'volume' : 'mute'} className="h-3 w-3" />
          {speaking ? '읽는 중' : '읽어 주기'}
        </button>
      ) : null}
    </div>
  );
}

export function Composer({
  onSend,
  streaming,
  onStop,
  placeholder = '사주에게 물어보세요',
  disabled,
}: {
  onSend: (text: string) => void;
  streaming: boolean;
  onStop: () => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const speech = useSpeechInput((text) => {
    setValue((prev) => (prev ? `${prev} ${text}` : text));
    requestAnimationFrame(() => textareaRef.current?.focus());
  });

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [value, resize]);

  const submit = () => {
    const text = value.trim();
    if (!text || streaming || disabled) return;
    onSend(text);
    setValue('');
    requestAnimationFrame(() => {
      resize();
      textareaRef.current?.focus();
    });
  };

  return (
    <div className="border-t border-white/8 bg-ink-950/85 px-3 pb-1 pt-2 backdrop-blur">
      {speech.listening ? (
        <div className="mb-1.5 flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-200">
          <span className="h-1.5 w-1.5 animate-soft-pulse rounded-full bg-rose-400" />
          듣고 있어요… {speech.interim ? `“${speech.interim}”` : '말씀해 주세요'}
        </div>
      ) : null}
      {speech.error ? <p className="mb-1.5 text-[11px] text-rose-300">{speech.error}</p> : null}

      <div className="flex items-end gap-1.5">
        <button
          type="button"
          onClick={() => {
            speech.clearError();
            speech.toggle();
          }}
          aria-label="음성으로 말하기"
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors',
            speech.listening
              ? 'animate-ring border-rose-400/50 bg-rose-500/20 text-rose-300'
              : 'border-white/10 bg-white/5 text-slate-300 active:bg-white/10',
          )}
        >
          <Icon name="mic" className="h-[18px] w-[18px]" />
        </button>

        <textarea
          ref={textareaRef}
          value={value}
          rows={1}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          className="min-h-[40px] max-h-[132px] flex-1 resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-[10px] text-[14px] leading-snug text-slate-100 placeholder:text-slate-600 focus:border-gold/50 focus:outline-none"
        />

        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="멈추기"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-slate-200"
          >
            <Icon name="stop" className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!value.trim() || disabled}
            aria-label="보내기"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-gold-deep text-ink-950 disabled:opacity-35"
          >
            <Icon name="send" className="h-[18px] w-[18px]" />
          </button>
        )}
      </div>
    </div>
  );
}

export function ChatList({
  messages,
  streaming,
  autoRead,
  speechRate,
  emptyState,
  footer,
}: {
  messages: ChatMessage[];
  streaming: boolean;
  autoRead: boolean;
  speechRate: number;
  emptyState?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const speech = useSpeechOutput(speechRate);
  const lastSpokenRef = useRef<string | null>(null);
  const last = messages[messages.length - 1];

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    if (nearBottom || streaming) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, streaming]);

  useEffect(() => {
    if (!autoRead || streaming) return;
    if (!last || last.role !== 'assistant' || !last.text.trim() || last.error) return;
    if (lastSpokenRef.current === last.id) return;
    lastSpokenRef.current = last.id;
    speech.speak(toSpeechText(last.text), last.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRead, streaming, last?.id]);

  return (
    <div ref={scrollRef} className="no-scrollbar flex-1 overflow-y-auto overscroll-contain px-3 py-3">
      {messages.length === 0 ? emptyState : null}
      <div className="space-y-3">
        {messages.map((message) => (
          <ChatBubble
            key={message.id}
            message={message}
            streaming={streaming && message.id === last?.id && message.role === 'assistant'}
            speaking={speech.speakingId === message.id}
            onSpeak={() => {
              if (speech.speakingId === message.id) speech.stop();
              else speech.speak(toSpeechText(message.text), message.id);
            }}
          />
        ))}
      </div>
      {footer}
    </div>
  );
}

export function ErrorNotice({ error, onRetry }: { error: ChatError | null; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div className="mx-3 mb-2 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2.5">
      <p className="text-[12px] font-medium text-rose-200">{error.message}</p>
      {error.hint ? <p className="mt-0.5 text-[11px] leading-snug text-rose-300/80">{error.hint}</p> : null}
      {onRetry ? (
        <button type="button" onClick={onRetry} className="mt-1.5 text-[11px] font-semibold text-rose-100 underline">
          다시 시도
        </button>
      ) : null}
    </div>
  );
}
