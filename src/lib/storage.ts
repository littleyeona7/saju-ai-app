import type { Profile, Settings } from '../types';
import { DEFAULT_MODEL, MAX_PROFILES, migrateModel } from '../constants';

const PROFILES_KEY = 'saju.profiles.v1';
const ACTIVE_KEY = 'saju.activeProfile.v1';
const SETTINGS_KEY = 'saju.settings.v1';

export { MAX_PROFILES };

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isProfile(value: unknown): value is Profile {
  if (!value || typeof value !== 'object') return false;
  const p = value as Partial<Profile>;
  return Boolean(p.id && p.birth && typeof p.birth.year === 'number');
}

export function loadProfiles(): Profile[] {
  const parsed = safeParse<unknown>(localStorage.getItem(PROFILES_KEY));
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isProfile).slice(0, MAX_PROFILES);
}

export function saveProfiles(profiles: Profile[]): void {
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles.slice(0, MAX_PROFILES)));
  } catch {
    /* 저장 공간이 가득 찬 경우는 조용히 무시 */
  }
}

export function loadActiveId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function saveActiveId(id: string | null): void {
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
}

export function defaultSettings(): Settings {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  const envKey = env?.VITE_GEMINI_API_KEY ?? '';
  return {
    apiKey: envKey,
    model: DEFAULT_MODEL,
    autoRead: false,
    speechRate: 1,
  };
}

export function loadSettings(): Settings {
  const parsed = safeParse<Partial<Settings>>(localStorage.getItem(SETTINGS_KEY));
  const base = defaultSettings();
  if (!parsed) return base;
  return {
    apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : base.apiKey,
    // 예전에 저장한 단종 모델(gemini-2.5-flash 등)은 지금 쓸 수 있는 모델로 옮긴다.
    model: migrateModel(typeof parsed.model === 'string' && parsed.model ? parsed.model : base.model),
    autoRead: Boolean(parsed.autoRead),
    speechRate: typeof parsed.speechRate === 'number' ? parsed.speechRate : base.speechRate,
  };
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}
