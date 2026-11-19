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
        <div className="max-w-[84%] rounded-2xl rounded-br-md bg-gradient-to-br from-gold to-gold-deep px-4 py-3 text-[15.5px] font-medium leading-[1.65] text-on-gold shadow-[0_6px_18px_-14px_rgba(193,145,47,0.9)]">
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start">
      <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-line bg-surface px-4 py-3 shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
        {message.error ? (
          <p className="text-[14.5px] leading-relaxed text-rose-700">{message.error}</p>
        ) : (
          <>
            <Markdown text={message.text} />
            {streaming ? (
              <span className="ml-0.5 inline-block h-4 w-1.5 animate-soft-pulse rounded-sm bg-gold-deep align-middle" />
            ) : null}
          </>
        )}
      </div>
      {!message.error && message.text ? (
        <button
          type="button"
          onClick={onSpeak}
          className={cn(
            'mt-1 flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12.5px] font-medium transition-colors',
            speaking ? 'text-gold-ink' : 'text-ink-faint active:bg-surface-2',
          )}
        >
          <Icon name={speaking ? 'volume' : 'mute'} className="h-3.5 w-3.5" />
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
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
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
    <div className="border-t border-line bg-surface/95 px-3 pb-1 pt-2.5 backdrop-blur">
      {speech.listening ? (
        <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[12.5px] text-rose-700">
          <span className="h-1.5 w-1.5 animate-soft-pulse rounded-full bg-rose-500" />
          듣고 있어요… {speech.interim ? `“${speech.interim}”` : '말씀해 주세요'}
        </div>
      ) : null}
      {speech.error ? <p className="mb-2 text-[12.5px] text-rose-700">{speech.error}</p> : null}

      <div className="flex items-end gap-1.5">
        <button
          type="button"
          onClick={() => {
            speech.clearError();
            speech.toggle();
          }}
          aria-label="음성으로 말하기"
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors',
            speech.listening
              ? 'animate-ring border-rose-300 bg-rose-50 text-rose-600'
              : 'border-line bg-surface-2 text-ink-muted active:bg-surface-3',
          )}
        >
          <Icon name="mic" className="h-5 w-5" />
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
          className="no-scrollbar min-h-[46px] max-h-[144px] flex-1 resize-none overflow-y-auto rounded-xl border border-line bg-surface-2 px-3.5 py-[11px] text-[16px] leading-snug text-ink placeholder:text-ink-faint focus:border-gold-deep focus:bg-surface focus:outline-none"
        />

        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="멈추기"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-3 text-ink-soft"
          >
            <Icon name="stop" className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!value.trim() || disabled}
            aria-label="보내기"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-gold-deep text-on-gold shadow-[0_6px_18px_-12px_rgba(193,145,47,0.9)] disabled:opacity-40"
          >
            <Icon name="send" className="h-5 w-5" />
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
      <div className="space-y-3.5">
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
    <div className="mx-3 mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5">
      <p className="text-[14px] font-semibold text-rose-700">{error.message}</p>
      {error.hint ? <p className="mt-1 text-[12.5px] leading-snug text-rose-600">{error.hint}</p> : null}
      {onRetry ? (
        <button type="button" onClick={onRetry} className="mt-1.5 text-[12.5px] font-bold text-rose-700 underline">
          다시 시도
        </button>
      ) : null}
    </div>
  );
}
