/** Shared application types. */

export type CalendarType = 'solar' | 'lunar';
export type Gender = 'female' | 'male';
export type MaritalStatus = 'single' | 'married';

export interface BirthInput {
  name: string;
  calendar: CalendarType;
  year: number;
  month: number;
  day: number;
  /** 음력 윤달 여부 (calendar === 'lunar' 일 때만 의미) */
  leapMonth: boolean;
  timeKnown: boolean;
  hour: number;
  minute: number;
  gender: Gender;
}

export interface PartnerBirth {
  name: string;
  birth: BirthInput;
}

export interface MarriageInfo {
  status: MaritalStatus;
  date: { year: number; month: number; day: number } | null;
  /** 저장된 프로필에서 고른 배우자 */
  partnerProfileId: string | null;
  /** 직접 입력한 배우자 사주 */
  partnerManual: PartnerBirth | null;
}

/**
 * AI 상담에서 앱이 배운 사실 한 줄.
 * (결혼 연도, 직장·업무 맥락, 건강·생활 습관, 어떤 해석이 맞았는지 같은 실제 피드백)
 */
export interface ProfileNote {
  id: string;
  text: string;
  /** ISO 8601 문자열 */
  createdAt: string;
}

export interface Profile {
  id: string;
  birth: BirthInput;
  marriage: MarriageInfo;
  /** 상담 피드백 자동 기억 (최신이 뒤) */
  notes?: ProfileNote[];
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  apiKey: string;
  model: string;
  autoRead: boolean;
  speechRate: number;
}

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  model?: string;
  error?: string;
}
