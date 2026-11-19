import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../types';
import { GeminiError, streamGemini, type GeminiContent } from '../lib/gemini';
import { uid } from '../lib/utils';

export interface ChatError {
  message: string;
  hint?: string;
}

interface Options {
  apiKey: string;
  model: string;
  systemInstruction: string;
  onDone?: (text: string, messageId: string) => void;
}

export function useGeminiChat({ apiKey, model, systemInstruction, onDone }: Options) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const [modelUsed, setModelUsed] = useState(model);

  const messagesRef = useRef<ChatMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const optionsRef = useRef({ apiKey, model, systemInstruction, onDone });

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    optionsRef.current = { apiKey, model, systemInstruction, onDone };
  }, [apiKey, model, systemInstruction, onDone]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    messagesRef.current = [];
    setMessages([]);
    setError(null);
    setStreaming(false);
  }, []);

  const send = useCallback(async (text: string, systemOverride?: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const { apiKey: key, model: modelName, systemInstruction: system } = optionsRef.current;
    // 이번 질문 주제에 맞춰 다시 만든 시스템 프롬프트(고전 기준)를 우선 쓴다.
    const systemUsed = systemOverride ?? system;
    if (!key) {
      setError({
        message: 'Gemini API 키가 없습니다.',
        hint: '오른쪽 위 설정(⚙)에서 API 키를 넣으면 상담을 시작할 수 있어요.',
      });
      return;
    }

    setError(null);
    const history = messagesRef.current.filter((msg) => msg.text.trim());
    const userMessage: ChatMessage = { id: uid(), role: 'user', text: trimmed };
    const assistantId = uid();
    const nextMessages = [...history, userMessage, { id: assistantId, role: 'assistant' as const, text: '' }];
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    setStreaming(true);

    const contents: GeminiContent[] = [...history, userMessage].map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.text }],
    }));

    const controller = new AbortController();
    abortRef.current = controller;
    let acc = '';

    try {
      for await (const chunk of streamGemini({
        apiKey: key,
        model: modelName,
        systemInstruction: systemUsed,
        contents,
        signal: controller.signal,
        onModelUsed: setModelUsed,
      })) {
        acc += chunk;
        const snapshot = acc;
        setMessages((prev) => {
          const updated = prev.map((msg) => (msg.id === assistantId ? { ...msg, text: snapshot } : msg));
          messagesRef.current = updated;
          return updated;
        });
      }

      if (!acc.trim()) {
        setMessages((prev) => {
          const updated = prev.map((msg) =>
            msg.id === assistantId ? { ...msg, text: '', error: '답변이 비어 있습니다. 다시 시도해 주세요.' } : msg,
          );
          messagesRef.current = updated;
          return updated;
        });
      } else {
        optionsRef.current.onDone?.(acc, assistantId);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // 사용자가 멈춤 — 받은 데까지 남긴다.
      } else if (err instanceof GeminiError) {
        setError({ message: err.message, hint: err.hint });
        if (!acc) {
          setMessages((prev) => {
            const updated = prev.map((msg) =>
              msg.id === assistantId ? { ...msg, text: '', error: err.message } : msg,
            );
            messagesRef.current = updated;
            return updated;
          });
        }
      } else {
        setError({ message: '알 수 없는 오류가 발생했습니다.', hint: '잠시 뒤 다시 시도해 주세요.' });
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
      // 답변도 오류도 없는 빈 말풍선은 지운다.
      setMessages((prev) => {
        const updated = prev.filter((msg) => !(msg.id === assistantId && !msg.text.trim() && !msg.error));
        messagesRef.current = updated;
        return updated;
      });
    }
  }, []);

  return {
    messages,
    streaming,
    error,
    clearError: () => setError(null),
    send,
    stop,
    reset,
    modelUsed,
  };
}
