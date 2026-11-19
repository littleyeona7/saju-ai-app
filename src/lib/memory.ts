/**
 * 상담 피드백 자동 기억 (Auto-learning Memory).
 *
 * AI 답변이 끝나면 조용히 한 번 더 Gemini를 불러, 방금 나눈 대화에서
 * "앞으로 상담에 계속 쓸 수 있는 사실 0~2개"만 뽑아 프로필에 쌓는다.
 * 쌓인 기억은 다음 상담(과 A vs B 비교)의 시스템 프롬프트에 자동으로 들어간다.
 *
 * 원칙
 * - 저장은 기기(localStorage)에만. 서버로 따로 보내지 않는다.
 * - 중복은 문장이 조금 달라도 걸러 낸다 (정규화 + 문자 2-gram 유사도).
 * - 뽑기가 실패해도 상담은 아무 영향이 없다 (예외를 밖으로 던지지 않는다).
 */
import type { ProfileNote } from '../types';
import { MODEL_FALLBACKS } from '../constants';
import { uid } from './utils';

/** 기억 추출에 쓰는 가벼운 모델. 실패하면 대체 모델 → 사용자가 고른 모델 순으로 넘어간다. */
export const NOTE_MODEL = 'gemini-3.5-flash-lite';

/** 프로필 하나에 보관하는 기억 상한 */
export const MAX_NOTES = 40;
/** 기억 한 줄의 최대 길이 */
export const MAX_NOTE_LENGTH = 120;
/** 한 번의 대화에서 새로 뽑는 최대 개수 */
export const MAX_NOTES_PER_EXCHANGE = 2;

const MIN_NOTE_LENGTH = 6;
/** 이 길이 이상인 문장끼리만 비슷한 표현으로 본다 (짧은 숫자 문장이 서로 합쳐지지 않게) */
const FUZZY_MIN_KEY_LENGTH = 12;
const SIMILARITY_THRESHOLD = 0.58;
const MIN_EXTRACT_ANSWER = 60;

/* ----------------------------- 정규화 · 중복 ----------------------------- */

/** 앞뒤 불릿·따옴표를 떼고 공백을 하나로 접는다. */
export function normalizeNoteText(text: string): string {
  return text
    .replace(/^[\s\-•*·"'"'`〉》]+/u, '')
    .replace(/[\s"'"'`〈《]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 비교용 키: 글자·숫자만 남긴 소문자 문자열 */
export function noteKey(text: string): string {
  return normalizeNoteText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function bigrams(key: string): Set<string> {
  const grams = new Set<string>();
  if (key.length < 2) {
    if (key) grams.add(key);
    return grams;
  }
  for (let i = 0; i < key.length - 1; i += 1) grams.add(key.slice(i, i + 2));
  return grams;
}

/** 두 문장이 같은 사실을 말하는지 (0~1, Dice 계수) */
export function noteSimilarity(a: string, b: string): number {
  const ka = noteKey(a);
  const kb = noteKey(b);
  if (!ka || !kb) return 0;
  if (ka === kb) return 1;
  const ga = bigrams(ka);
  const gb = bigrams(kb);
  let shared = 0;
  for (const gram of ga) if (gb.has(gram)) shared += 1;
  return (2 * shared) / (ga.size + gb.size);
}

/** 이미 있는 기억과 같은 뜻이면 true (같은 문장, 포함 관계, 2-gram 유사도) */
export function isDuplicateNote(text: string, notes: ProfileNote[]): boolean {
  const key = noteKey(text);
  if (!key) return true;
  return notes.some((note) => {
    const other = noteKey(note.text);
    if (!other) return false;
    if (key === other) return true;
    if (key.length >= 8 && other.length >= 8 && (key.includes(other) || other.includes(key))) return true;
    if (key.length < FUZZY_MIN_KEY_LENGTH || other.length < FUZZY_MIN_KEY_LENGTH) return false;
    return noteSimilarity(key, other) >= SIMILARITY_THRESHOLD;
  });
}

/* ----------------------------- 저장 · 병합 ----------------------------- */

/** 저장된 값(예전 버전 포함)을 안전한 ProfileNote[]로 다듬는다. */
export function sanitizeNotes(raw: unknown): ProfileNote[] {
  if (!Array.isArray(raw)) return [];
  const out: ProfileNote[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const value = item as Partial<ProfileNote>;
    const text = typeof value.text === 'string' ? normalizeNoteText(value.text).slice(0, MAX_NOTE_LENGTH) : '';
    if (text.length < 2) continue;
    const id = typeof value.id === 'string' && value.id ? value.id : uid();
    const createdAt =
      typeof value.createdAt === 'string' && value.createdAt ? value.createdAt : new Date().toISOString();
    out.push({ id, text, createdAt });
  }
  return out.slice(-MAX_NOTES);
}

/**
 * 추출된 후보 문장 0~2개를 새 기억으로 만든다.
 * 기존 기억과 겹치는 문장, 너무 짧은 문장, 상한을 넘는 문장은 버린다.
 */
export function makeNotes(
  existing: ProfileNote[],
  candidates: string[],
  now: Date = new Date(),
  max: number = MAX_NOTES_PER_EXCHANGE,
): ProfileNote[] {
  const created: ProfileNote[] = [];
  for (const candidate of candidates) {
    if (created.length >= max) break;
    const text = normalizeNoteText(String(candidate ?? '')).slice(0, MAX_NOTE_LENGTH);
    if (text.length < MIN_NOTE_LENGTH) continue;
    if (isDuplicateNote(text, [...existing, ...created])) continue;
    created.push({ id: uid(), text, createdAt: now.toISOString() });
  }
  return created;
}

/** 기존 기억에 새 기억을 합친다. 중복은 버리고 최근 MAX_NOTES개만 남긴다. */
export function mergeNotes(
  existing: ProfileNote[] | undefined,
  incoming: ProfileNote[],
  max: number = MAX_NOTES,
): ProfileNote[] {
  const merged = [...(existing ?? [])];
  for (const note of incoming) {
    if (isDuplicateNote(note.text, merged)) continue;
    merged.push(note);
  }
  return merged.slice(-max);
}

export function removeNote(notes: ProfileNote[] | undefined, id: string): ProfileNote[] {
  return (notes ?? []).filter((note) => note.id !== id);
}

/** 화면에는 최신 기억이 위로 오게 보여 준다. */
export function newestFirst(notes: ProfileNote[] | undefined): ProfileNote[] {
  return [...(notes ?? [])].reverse();
}

/* ----------------------------- 프롬프트 주입 ----------------------------- */

const MEMORY_USAGE_RULES = `※ 위 사실은 이미 나눈 대화에서 배운 것이다. 답변에 자연스럽게 반영하되 목록처럼 나열하거나 "기억하고 있다"고 강조하지 않는다.
※ 민감한 내용(건강·가족·돈)은 꼭 필요한 만큼만 부드럽게 다룬다.
※ 기억과 사용자의 새 말이 어긋나면 새 말을 따르고, 기억 쪽을 정정해 이야기한다.`;

/**
 * 시스템 프롬프트에 넣을 "이미 배운 사실" 구획.
 * 기억이 없으면 빈 문자열을 돌려 프롬프트가 커지지 않는다.
 */
export function buildMemoryBlock(
  own: ProfileNote[] | undefined,
  partner?: { name?: string; notes?: ProfileNote[] } | null,
): string {
  const mine = own ?? [];
  const theirs = partner?.notes ?? [];
  if (!mine.length && !theirs.length) return '';

  const lines = ['[이미 배운 사실 — 상담에 자동 반영]'];
  if (mine.length) {
    lines.push('사용자:');
    for (const note of mine) lines.push(`- ${note.text}`);
  }
  if (theirs.length) {
    lines.push(`배우자·파트너(${partner?.name || '이름 미입력'}):`);
    for (const note of theirs) lines.push(`- ${note.text}`);
  }
  lines.push(MEMORY_USAGE_RULES);
  return lines.join('\n');
}

/* ----------------------------- 추출 호출 ----------------------------- */

export interface ExtractNotesInput {
  apiKey: string;
  /** 사용자가 고른 모델 (가벼운 모델이 모두 실패할 때 마지막으로 시도) */
  model?: string;
  existing: ProfileNote[];
  /** 사주 요약 — 뽑은 사실을 해석 가능하게 만드는 최소 맥락 */
  context?: string;
  /** 'AI 상담' | 'A vs B 비교' */
  topic?: string;
  question: string;
  answer: string;
  signal?: AbortSignal;
}

export const EXTRACTION_SYSTEM = `너는 사주 상담 기록을 정리하는 조수다.
아래 [기존 기억]과 [방금 대화]를 비교해, 앞으로 상담에 계속 쓸 수 있는 "사용자에 대한 사실"만 0~2개 뽑는다.

[저장할 것]
- 실제 인생 사건: 결혼·이혼·출산·이사·이직·개업 등의 시기와 결과
- 직업·회사·업무·공부 맥락 (하는 일, 준비 중인 것, 겪는 상황)
- 건강·생활 습관, 가족·관계에 대한 구체적 사실
- 해석에 대한 피드백 (어떤 풀이가 맞았는지, 빗나갔는지, 사용자가 부인한 것)

[저장하지 말 것]
- 사주 이론·일반론, 추측, 인사·감정 표현("고민이 많다" 같은 막연한 말)
- 이미 계산된 사주 값(일간, 오행 개수, 대운 글자 등)
- 몇 주면 의미가 없어지는 임시 상황 (오늘 기분, 이번 주 일정)

[규칙]
- [기존 기억]에 있거나 같은 뜻인 내용은 절대 다시 쓰지 않는다.
- 각 항목은 40자 안팎의 한국어 한 문장. 날짜·고유명사는 그대로 둔다.
- 확실한 것만 쓴다. 사용자가 말하지 않은 사실을 지어내지 않는다.
- 뽑을 것이 없으면 빈 배열 [] 만 출력한다.

출력은 JSON 문자열 배열만. 설명·머리말·코드블록 표시를 쓰지 않는다.`;

function isGemini3(model: string): boolean {
  return /^gemini-[3-9]/.test(model);
}

function extractionBody(input: ExtractNotesInput, model: string): string {
  const existing = input.existing.length
    ? input.existing.map((note) => `- ${note.text}`).join('\n')
    : '(없음)';
  const generationConfig: Record<string, unknown> = {
    responseMimeType: 'application/json',
    responseSchema: { type: 'ARRAY', items: { type: 'STRING' } },
    maxOutputTokens: 512,
  };
  if (isGemini3(model)) generationConfig.thinkingConfig = { thinkingLevel: 'low' };
  else generationConfig.temperature = 0.2;

  const userText = `[기존 기억]
${existing}

[사용자 사주 요약]
${input.context?.trim() || '(없음)'}

[방금 대화 — ${input.topic || 'AI 상담'}]
사용자: ${input.question}
AI: ${input.answer}`;

  return JSON.stringify({
    systemInstruction: { parts: [{ text: EXTRACTION_SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig,
  });
}

/** 모델이 돌려준 텍스트에서 문자열 배열을 꺼낸다 (코드블록·설명이 섞여도 버틴다). */
export function parseNotesResponse(raw: string): string[] {
  const cleaned = String(raw ?? '')
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  if (!cleaned) return [];

  let data: unknown = null;
  try {
    data = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start >= 0 && end > start) {
      try {
        data = JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        data = null;
      }
    }
  }

  if (Array.isArray(data)) return data.filter((item): item is string => typeof item === 'string');
  // 배열 대신 {"notes": [...]} 형태로 답한 경우도 받아 준다.
  if (data && typeof data === 'object') {
    const nested = (data as { notes?: unknown }).notes;
    if (Array.isArray(nested)) return nested.filter((item): item is string => typeof item === 'string');
  }
  return [];
}

function extractionModels(preferred?: string): string[] {
  const chain = [NOTE_MODEL, ...MODEL_FALLBACKS, preferred ?? ''].filter(Boolean);
  return [...new Set(chain)];
}

/**
 * 방금 대화에서 새로 배울 사실을 뽑는다.
 * 상담 흐름을 막지 않도록 실패는 조용히 빈 배열로 돌려준다.
 */
export async function extractProfileNotes(input: ExtractNotesInput): Promise<ProfileNote[]> {
  const answer = input.answer.trim();
  if (!input.apiKey || !input.question.trim() || answer.length < MIN_EXTRACT_ANSWER) return [];

  for (const model of extractionModels(input.model)) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': input.apiKey },
          body: extractionBody(input, model),
          signal: input.signal,
        },
      );
      if (!res.ok) continue;

      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      };
      const text = (json.candidates?.[0]?.content?.parts ?? [])
        .map((part) => part.text ?? '')
        .join('')
        .trim();
      if (!text) continue;

      const notes = makeNotes(input.existing, parseNotesResponse(text));
      return notes;
    } catch (error) {
      if ((error as Error).name === 'AbortError') return [];
      /* 다음 모델 시도 */
    }
  }
  return [];
}

/** 이 대화는 배울 게 있을 만한가 (짧은 인사·잡담에는 호출하지 않는다). */
export function shouldExtractNotes(question: string, answer: string): boolean {
  if (question.trim().length < 2) return false;
  if (answer.trim().length < MIN_EXTRACT_ANSWER) return false;
  return true;
}
