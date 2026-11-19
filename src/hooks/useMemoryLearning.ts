import { useCallback, useRef, useState } from 'react';
import type { Profile, ProfileNote } from '../types';
import { extractProfileNotes, shouldExtractNotes } from '../lib/memory';

interface Options {
  apiKey: string;
  model: string;
  profile: Profile;
  /** 사주 요약 (이름·일간·현재 대운 등) — 뽑은 사실을 해석 가능하게 만드는 최소 맥락 */
  context: string;
  onLearn: (notes: ProfileNote[]) => void;
}

/**
 * AI 답변이 끝날 때마다 조용히 한 번 더 물어, 새로 배울 사실 0~2개를 뽑는다.
 * - 상담 응답을 기다리게 하지 않는다 (fire-and-forget).
 * - 실패·중복·막연한 내용은 아무 일 없이 버린다.
 * - 이미 배우는 중이면 그 대화는 건너뛴다 (요청이 몰리지 않게).
 */
export function useMemoryLearning({ apiKey, model, profile, context, onLearn }: Options) {
  const notesRef = useRef<ProfileNote[]>(profile.notes ?? []);
  notesRef.current = profile.notes ?? [];
  const contextRef = useRef(context);
  contextRef.current = context;
  const onLearnRef = useRef(onLearn);
  onLearnRef.current = onLearn;

  const busyRef = useRef(false);
  const [learning, setLearning] = useState(false);
  const [justLearned, setJustLearned] = useState<string[]>([]);

  const learn = useCallback(
    (exchange: { question: string; answer: string; topic?: string }) => {
      if (!apiKey.trim()) return;
      if (!shouldExtractNotes(exchange.question, exchange.answer)) return;
      if (busyRef.current) return;

      busyRef.current = true;
      setLearning(true);
      void (async () => {
        try {
          const learned = await extractProfileNotes({
            apiKey,
            model,
            existing: notesRef.current,
            context: contextRef.current,
            topic: exchange.topic,
            question: exchange.question,
            answer: exchange.answer,
          });
          if (learned.length) {
            onLearnRef.current(learned);
            setJustLearned(learned.map((note) => note.text));
          }
        } catch {
          /* 기억 추출 실패는 상담 흐름에 영향을 주지 않는다 */
        } finally {
          busyRef.current = false;
          setLearning(false);
        }
      })();
    },
    [apiKey, model],
  );

  const clearJustLearned = useCallback(() => setJustLearned([]), []);

  return { learn, learning, justLearned, clearJustLearned };
}
