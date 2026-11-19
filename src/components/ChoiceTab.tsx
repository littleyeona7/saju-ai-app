import { useCallback, useMemo, useState } from 'react';
import type { Profile, Settings } from '../types';
import type { Chart } from '../lib/saju';
import { buildComparisonSystemPrompt, buildComparisonUserPrompt } from '../lib/prompts';
import { useGeminiChat } from '../hooks/useGeminiChat';
import { useSpeechOutput } from '../hooks/useSpeech';
import { Markdown } from './Markdown';
import { ChatBubble, Composer, ErrorNotice } from './ChatPanel';
import { Card, GhostButton, Icon, PrimaryButton, inputClass } from './ui';
import { cn, toSpeechText } from '../lib/utils';

interface Sections {
  a: string;
  b: string;
  c: string;
  hasMarkers: boolean;
  done: boolean;
}

export function parseComparison(text: string, done: boolean): Sections {
  const aIndex = text.indexOf('[[A]]');
  const bIndex = text.indexOf('[[B]]');
  const cIndex = text.indexOf('[[C]]');

  if (aIndex < 0 && bIndex < 0 && cIndex < 0) {
    return { a: text, b: '', c: '', hasMarkers: false, done };
  }

  const cut = (start: number) => {
    const rest = text.slice(start + 5);
    const nextMarker = rest.search(/\[\[[ABC]\]\]/);
    return nextMarker >= 0 ? rest.slice(0, nextMarker) : rest;
  };

  const stripHeading = (section: string) =>
    section.replace(/^\s*###[^\n]*\n/, '').trim();

  return {
    a: aIndex >= 0 ? stripHeading(cut(aIndex)) : '',
    b: bIndex >= 0 ? stripHeading(cut(bIndex)) : '',
    c: cIndex >= 0 ? stripHeading(cut(cIndex)) : '',
    hasMarkers: true,
    done,
  };
}

const TIMING_CHIPS = ['3개월 안', '올해 안', '내년 상반기', '2028년'];

export function ChoiceTab({
  profile,
  chart,
  partner,
  settings,
}: {
  profile: Profile;
  chart: Chart;
  partner: { name: string; chart: Chart } | null;
  settings: Settings;
}) {
  const [crossroad, setCrossroad] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [timing, setTiming] = useState('');
  const [usePartner, setUsePartner] = useState(Boolean(partner));
  const [request, setRequest] = useState<{ crossroad: string; a: string; b: string; timing: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const systemInstruction = useMemo(
    () => buildComparisonSystemPrompt(profile, chart, partner),
    [profile, chart, partner],
  );

  const chat = useGeminiChat({
    apiKey: settings.apiKey,
    model: settings.model,
    systemInstruction,
  });

  const speech = useSpeechOutput(settings.speechRate);

  // 이어서 묻는 질문에도 그 주제에 맞는 명리 기준을 함께 넣는다.
  const sendFollowUp = useCallback(
    (text: string) => {
      void chat.send(text, buildComparisonSystemPrompt(profile, chart, partner, text));
    },
    [chat, chart, partner, profile],
  );

  const comparisonMessage = chat.messages.find((message) => message.role === 'assistant');
  const comparisonText = comparisonMessage?.text ?? '';
  const isComparisonStreaming = chat.streaming && comparisonMessage?.id === chat.messages[chat.messages.length - 1]?.id;
  const sections = useMemo(
    () => parseComparison(comparisonText, Boolean(comparisonMessage) && !isComparisonStreaming),
    [comparisonText, comparisonMessage, isComparisonStreaming],
  );

  const comparisonIndex = chat.messages.findIndex((message) => message.role === 'assistant');
  const followUps = comparisonIndex >= 0 ? chat.messages.slice(comparisonIndex + 1) : [];
  const hasKey = Boolean(settings.apiKey.trim());

  const submit = () => {
    if (!crossroad.trim() || !optionA.trim() || !optionB.trim()) {
      setFormError('갈림길과 A안, B안을 모두 적어 주세요.');
      return;
    }
    if (!hasKey) {
      setFormError('설정(⚙)에서 Gemini API 키를 먼저 넣어 주세요.');
      return;
    }
    setFormError(null);
    setRequest({ crossroad: crossroad.trim(), a: optionA.trim(), b: optionB.trim(), timing: timing.trim() });
    void chat.send(
      buildComparisonUserPrompt(
        { crossroad, optionA, optionB, timing, usePartner },
        chart,
        partner,
      ),
      buildComparisonSystemPrompt(profile, chart, partner, crossroad),
    );
  };

  const restart = () => {
    chat.reset();
    setRequest(null);
    setFormError(null);
  };

  /* ----------------------------- 입력 화면 ----------------------------- */
  if (!request) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="no-scrollbar flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto w-full max-w-md space-y-3">
            <div className="animate-fade-up">
              <h2 className="text-[21px] font-bold tracking-tight text-ink">인생 선택 A vs B</h2>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink-muted">
                지금 고민하는 갈림길을 적으면, 두 선택의 1·3·5년 뒤를 사주로 나란히 펼쳐 드려요.
              </p>
            </div>

            <Card className="space-y-3.5">
              <div>
                <span className="mb-1.5 block text-[13px] font-semibold tracking-wide text-ink-muted">갈림길</span>
                <input
                  className={inputClass}
                  value={crossroad}
                  onChange={(event) => setCrossroad(event.target.value.slice(0, 60))}
                  placeholder="예: 결혼할까 vs 지금처럼 살까"
                />
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div className="rounded-xl border border-[#d9d2fb] bg-[#f4f1ff] p-3">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold text-[#5b47c9]">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#7c6cf0] text-[11.5px] font-bold text-white">
                      A
                    </span>
                    선택지 A
                  </span>
                  <textarea
                    value={optionA}
                    onChange={(event) => setOptionA(event.target.value.slice(0, 200))}
                    rows={3}
                    placeholder="예: 이직해서 새 회사로 간다"
                    className="w-full resize-none rounded-lg border border-[#d9d2fb] bg-surface px-3 py-2.5 text-[15.5px] leading-snug text-ink placeholder:text-ink-faint focus:border-[#8b7bf7] focus:outline-none focus:ring-2 focus:ring-[#8b7bf7]/25"
                  />
                </div>
                <div className="rounded-xl border border-[#bfe6dc] bg-[#eefaf6] p-3">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold text-[#0f766e]">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#14b8a6] text-[11.5px] font-bold text-white">
                      B
                    </span>
                    선택지 B
                  </span>
                  <textarea
                    value={optionB}
                    onChange={(event) => setOptionB(event.target.value.slice(0, 200))}
                    rows={3}
                    placeholder="예: 지금 회사에 남아 승진을 노린다"
                    className="w-full resize-none rounded-lg border border-[#bfe6dc] bg-surface px-3 py-2.5 text-[15.5px] leading-snug text-ink placeholder:text-ink-faint focus:border-[#14b8a6] focus:outline-none focus:ring-2 focus:ring-[#14b8a6]/25"
                  />
                </div>
              </div>

              <div>
                <span className="mb-1.5 block text-[13px] font-semibold tracking-wide text-ink-muted">목표 시점</span>
                <input
                  className={inputClass}
                  value={timing}
                  onChange={(event) => setTiming(event.target.value.slice(0, 40))}
                  placeholder="예: 2027년 봄, 내년 상반기"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {TIMING_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setTiming(chip)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[12.5px] font-medium',
                        timing === chip
                          ? 'border-gold bg-gold/20 text-gold-ink'
                          : 'border-line bg-surface text-ink-muted',
                      )}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {partner ? (
                <label className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-2 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={usePartner}
                    onChange={(event) => setUsePartner(event.target.checked)}
                    className="h-[18px] w-[18px] accent-[#c1912f]"
                  />
                  <span className="min-w-0 text-[14px] leading-snug text-ink-soft">
                    배우자·파트너 사주({partner.name || '파트너'}) 함께 보기
                  </span>
                </label>
              ) : null}

              {formError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13.5px] text-rose-700">
                  {formError}
                </p>
              ) : null}

              <PrimaryButton onClick={submit}>
                <Icon name="scales" className="h-5 w-5" />
                두 갈래 미래 비교하기
              </PrimaryButton>
            </Card>

            <div className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-[14px] font-bold text-ink-soft">이렇게 비교해 드려요</p>
              <ul className="mt-2 space-y-1.5 text-[13.5px] leading-relaxed text-ink-muted">
                <li>· 오행·십신·합충이 어떻게 달라지는지</li>
                <li>· 1년 · 3년 · 5년 흐름</li>
                <li>· 각 선택에서 얻는 것과 리스크</li>
                <li>· 지금 움직일지 기다릴지, 명리학적 종합 조언</li>
              </ul>
            </div>

            <div className="flex flex-wrap gap-2 pb-2">
              {[
                { label: '결혼 vs 비혼', a: '지금 결혼을 결정한다', b: '조금 더 지내며 지켜본다' },
                { label: '이직 vs 유지', a: '올해 이직한다', b: '현 직장에 남는다' },
                { label: '창업 vs 취업', a: '내 사업을 시작한다', b: '안정적인 회사에 들어간다' },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setCrossroad(preset.label);
                    setOptionA(preset.a);
                    setOptionB(preset.b);
                    setFormError(null);
                  }}
                  className="rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-medium text-ink-soft active:bg-surface-2"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ----------------------------- 결과 화면 ----------------------------- */
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-2 border-b border-line bg-surface/70 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[15.5px] font-bold text-ink">{request.crossroad}</p>
          <p className="truncate text-[12.5px] text-ink-faint">
            {request.timing ? `${request.timing} · ` : ''}
            {profile.birth.name || '나'}의 사주 기준
          </p>
        </div>
        <GhostButton onClick={restart} className="shrink-0 py-1.5 text-[12.5px]">
          새로 비교
        </GhostButton>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto overscroll-contain px-3 py-3">
        <div className="mx-auto w-full max-w-md space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <ComparisonCard
              tone="a"
              title="A안"
              option={request.a}
              body={sections.a}
              streaming={isComparisonStreaming && !sections.b}
            />
            <ComparisonCard
              tone="b"
              title="B안"
              option={request.b}
              body={sections.b}
              streaming={isComparisonStreaming && Boolean(sections.a) && !sections.b}
            />
          </div>

          {sections.c ? (
            <Card className="animate-fade-up border-gold/70 bg-[#fdf6e7]">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[14.5px] font-bold text-gold-ink">
                  <Icon name="spark" className="h-4 w-4" /> 종합 조언
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (speech.speakingId === 'comparison') speech.stop();
                    else speech.speak(toSpeechText(sections.c), 'comparison');
                  }}
                  className="rounded-md p-1.5 text-gold-ink"
                  aria-label="조언 읽어 주기"
                >
                  <Icon name={speech.speakingId === 'comparison' ? 'volume' : 'mute'} className="h-4 w-4" />
                </button>
              </div>
              <Markdown text={sections.c} />
            </Card>
          ) : isComparisonStreaming ? (
            <div className="space-y-1.5">
              <div className="skeleton h-3 w-2/3 rounded" />
              <div className="skeleton h-3 w-full rounded" />
            </div>
          ) : null}

          {!sections.hasMarkers && sections.a && !isComparisonStreaming ? (
            <p className="px-1 text-[12px] leading-snug text-ink-faint">
              모델이 구획 표시 없이 답했습니다. 위 A/B 카드에 전체 답변이 나뉘어 담겼어요.
            </p>
          ) : null}

          {followUps.length ? (
            <div className="space-y-3.5 border-t border-line pt-3">
              <p className="text-[12.5px] font-semibold text-ink-faint">이어서 물어보기</p>
              {followUps.map((message) => (
                <ChatBubble
                  key={message.id}
                  message={message}
                  streaming={chat.streaming && message.id === chat.messages[chat.messages.length - 1]?.id}
                  speaking={speech.speakingId === message.id}
                  onSpeak={() => {
                    if (speech.speakingId === message.id) speech.stop();
                    else speech.speak(toSpeechText(message.text), message.id);
                  }}
                />
              ))}
            </div>
          ) : null}

          {!isComparisonStreaming && sections.c ? (
            <div className="flex flex-wrap gap-1.5 pb-2">
              {['A안 더 자세히', 'B안 리스크만', '언제 움직이면 좋을까?'].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => sendFollowUp(chip)}
                  className="rounded-full border border-line bg-surface px-3 py-1.5 text-[12.5px] font-medium text-ink-soft active:bg-surface-2"
                >
                  {chip}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <ErrorNotice error={chat.error} />
      <Composer
        onSend={sendFollowUp}
        streaming={chat.streaming}
        onStop={chat.stop}
        placeholder="A안과 B안에 대해 더 물어보세요"
        disabled={!hasKey}
      />
    </div>
  );
}

function ComparisonCard({
  tone,
  title,
  option,
  body,
  streaming,
}: {
  tone: 'a' | 'b';
  title: string;
  option: string;
  body: string;
  streaming: boolean;
}) {
  const styles =
    tone === 'a'
      ? {
          border: 'border-[#d9d2fb]',
          bg: 'bg-[#f6f3ff]',
          text: 'text-[#5040b0]',
          badge: 'bg-[#7c6cf0] text-white',
        }
      : {
          border: 'border-[#bfe6dc]',
          bg: 'bg-[#f0faf7]',
          text: 'text-[#0f766e]',
          badge: 'bg-[#14b8a6] text-white',
        };

  return (
    <div className={cn('rounded-2xl border p-3', styles.border, styles.bg)}>
      <div className="mb-2">
        <span
          className={cn(
            'mb-1 inline-flex h-5 w-5 items-center justify-center rounded-md text-[11.5px] font-bold',
            styles.badge,
          )}
        >
          {tone.toUpperCase()}
        </span>
        <p className={cn('mt-1 text-[14.5px] font-bold leading-snug', styles.text)}>{title}</p>
        <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-ink-muted">{option}</p>
      </div>
      {body ? (
        <Markdown
          text={body}
          className="[&_h4]:mb-1 [&_h4]:mt-2.5 [&_h4]:text-[13.5px] [&_li]:text-[13px] [&_li]:leading-[1.6] [&_p]:my-1 [&_p]:text-[13px] [&_p]:leading-[1.65] [&_ul]:my-1 [&_ul]:space-y-1"
        />
      ) : streaming ? (
        <div className="space-y-1.5 pt-1">
          <div className="skeleton h-2.5 w-3/4 rounded" />
          <div className="skeleton h-2.5 w-full rounded" />
          <div className="skeleton h-2.5 w-5/6 rounded" />
          <div className="skeleton h-2.5 w-full rounded" />
        </div>
      ) : (
        <p className="text-[13px] text-ink-faint">—</p>
      )}
    </div>
  );
}
