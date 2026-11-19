import { useCallback, useEffect, useRef, useState } from 'react';

/* ------------------------------------------------------------------ */
/* 음성 입력 (Web Speech API, ko-KR)                                    */
/* ------------------------------------------------------------------ */

type RecognitionResultEvent = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: { isFinal: boolean; 0: { transcript: string } };
  };
};

type RecognitionErrorEvent = { error: string; message?: string };

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

type RecognitionCtor = new () => RecognitionLike;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechInput(onFinal: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<RecognitionLike | null>(null);
  const finalRef = useRef('');
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    setSupported(true);
    const recognition = new Ctor();
    recognition.lang = 'ko-KR';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setError(null);
    };
    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) finalText += transcript;
        else interimText += transcript;
      }
      if (finalText) finalRef.current += finalText;
      setInterim(interimText);
    };
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError('마이크 사용이 허용되지 않았어요. 브라우저 설정에서 마이크를 허용해 주세요.');
      } else if (event.error === 'no-speech') {
        setError('음성이 잘 들리지 않았어요. 다시 한 번 말씀해 주세요.');
      } else if (event.error === 'aborted') {
        /* 사용자가 멈춘 경우 */
      } else {
        setError('음성 인식을 사용할 수 없어요. 잠시 뒤 다시 시도해 주세요.');
      }
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
      setInterim('');
      const text = finalRef.current.trim();
      finalRef.current = '';
      if (text) onFinalRef.current(text);
    };

    recognitionRef.current = recognition;
    return () => {
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setError('이 브라우저에서는 음성 입력을 지원하지 않아요. 키보드로 입력해 주세요.');
      return;
    }
    setError(null);
    finalRef.current = '';
    try {
      recognition.start();
    } catch {
      /* 이미 시작된 경우 */
    }
  }, []);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  return { supported, listening, interim, error, start, stop, toggle, clearError: () => setError(null) };
}

/* ------------------------------------------------------------------ */
/* 음성 읽기 (SpeechSynthesis, ko-KR)                                  */
/* ------------------------------------------------------------------ */

export function useSpeechOutput(rate: number) {
  const [supported, setSupported] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const rateRef = useRef(rate);
  rateRef.current = rate;

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    setSupported(true);
    const load = () => {
      const voices = window.speechSynthesis.getVoices();
      const ko =
        voices.find((v) => v.lang === 'ko-KR' && /Yuna|Heami|Google|Sora|Samsung/i.test(v.name)) ??
        voices.find((v) => v.lang === 'ko-KR') ??
        voices.find((v) => v.lang.startsWith('ko')) ??
        null;
      voiceRef.current = ko;
    };
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', load);
      window.speechSynthesis.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, []);

  const speak = useCallback(
    (text: string, id: string) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text.slice(0, 4000));
      utterance.lang = 'ko-KR';
      utterance.rate = Math.min(1.6, Math.max(0.6, rateRef.current));
      utterance.pitch = 1;
      if (voiceRef.current) utterance.voice = voiceRef.current;
      utterance.onend = () => setSpeakingId((current) => (current === id ? null : current));
      utterance.onerror = () => setSpeakingId((current) => (current === id ? null : current));
      setSpeakingId(id);
      synth.speak(utterance);
    },
    [],
  );

  /** iOS/Safari: 첫 발화는 사용자 제스처 안에서 미리 걸어 두어야 이후 자동 읽기가 동작한다. */
  const prime = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    if (synth.speaking || synth.pending) return;
    const warmup = new SpeechSynthesisUtterance(' ');
    warmup.volume = 0;
    warmup.lang = 'ko-KR';
    synth.speak(warmup);
  }, []);

  const speaking = speakingId !== null;

  return { supported, speaking, speakingId, speak, stop, prime };
}
