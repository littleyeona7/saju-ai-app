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

export interface Profile {
  id: string;
  birth: BirthInput;
  marriage: MarriageInfo;
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
