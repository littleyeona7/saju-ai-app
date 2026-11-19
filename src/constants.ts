export const MAX_PROFILES = 10;

/**
 * 기본 모델.
 * 2026-11-19 기준 Gemini 2.x 계열은 신규 사용자에게 제공되지 않아 404(no longer available)가 난다.
 * Gemini 3.8 Flash(GA, 2026-09-02 공개)가 현재 기본 Flash 모델이다.
 */
export const DEFAULT_MODEL = 'gemini-3.8-flash';

export const MODEL_OPTIONS = [
  { value: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (빠름 · 기본)' },
  { value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash (이전 Flash)' },
  { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite (가장 빠름)' },
  { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (깊은 해석 · 느림)' },
];

/** 모델을 찾지 못했을 때(404) 또는 모델이 붐빌 때(503) 순서대로 시도할 대체 모델 */
export const MODEL_FALLBACKS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];

/** 더 이상 쓸 수 없는 모델 → 대체 모델. 저장된 설정을 불러올 때 자동으로 옮긴다. */
export const RETIRED_MODELS: Record<string, string> = {
  'gemini-2.0-flash': 'gemini-3.8-flash',
  'gemini-2.0-flash-lite': 'gemini-3.5-flash-lite',
  'gemini-2.5-flash': 'gemini-3.8-flash',
  'gemini-2.5-flash-lite': 'gemini-3.5-flash-lite',
  'gemini-2.5-pro': 'gemini-3.8-flash',
};

/** 저장된 모델 이름이 단종된 것이면 지금 쓸 수 있는 모델로 바꾼다. */
export function migrateModel(model: string): string {
  return RETIRED_MODELS[model] ?? model;
}
