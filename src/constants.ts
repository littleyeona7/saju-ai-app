export const MAX_PROFILES = 10;

export const DEFAULT_MODEL = 'gemini-2.5-flash';

export const MODEL_OPTIONS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (빠름 · 기본)' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (가장 빠름)' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (깊은 해석 · 느림)' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (이전 버전)' },
];

/** 모델을 찾지 못했을 때(404) 순서대로 시도할 대체 모델 */
export const MODEL_FALLBACKS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];
