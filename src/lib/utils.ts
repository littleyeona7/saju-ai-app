import { BRANCH_KO, STEM_KO } from './saju';

export function cn(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const HANJA_TO_HANGUL: Record<string, string> = { ...STEM_KO, ...BRANCH_KO };

/** 음성 합성이 한자를 읽지 못하는 경우가 많아 한글 독음으로 바꾼다. */
export function hanjaToHangul(text: string): string {
  return text.replace(/[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]/g, (c) => HANJA_TO_HANGUL[c] ?? c);
}

/** 화면에 읽어 줄 텍스트를 정리한다 (마크다운 기호 제거). */
export function toSpeechText(markdown: string): string {
  const cleaned = markdown
    .replace(/\[\[[A-Z]\]\]/g, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/>\s?/g, '')
    .replace(/---+/g, ' ')
    .replace(/\n{2,}/g, '\n');
  return hanjaToHangul(cleaned).trim();
}

export function todayYear(): number {
  return new Date().getFullYear();
}

export function formatKoreanDate(d: { year: number; month: number; day: number }): string {
  return `${d.year}년 ${d.month}월 ${d.day}일`;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
