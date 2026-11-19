import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BirthInput, MarriageInfo, Profile, Settings } from './types';
import { buildChart, type Chart } from './lib/saju';
import { createProfile, partnerChartOf } from './lib/profileUtils';
import {
  loadActiveId,
  loadProfiles,
  loadSettings,
  saveActiveId,
  saveProfiles,
  saveSettings,
} from './lib/storage';
import { MAX_PROFILES } from './constants';
import { Onboarding } from './components/Onboarding';
import { SajuTab } from './components/SajuTab';
import { ChatTab } from './components/ChatTab';
import { ChoiceTab } from './components/ChoiceTab';
import { SettingsModal } from './components/SettingsModal';
import { Icon } from './components/ui';
import { cn } from './lib/utils';

type TabKey = 'saju' | 'chat' | 'choice';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'saju', label: '내 사주', icon: 'grid' },
  { key: 'chat', label: 'AI 상담', icon: 'chat' },
  { key: 'choice', label: 'A vs B', icon: 'scales' },
];

export default function App() {
  const [profiles, setProfiles] = useState<Profile[]>(() => loadProfiles());
  const [activeId, setActiveId] = useState<string | null>(() => loadActiveId());
  const [draft, setDraft] = useState<Profile | null>(null);
  const [tab, setTab] = useState<TabKey>('saju');
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const current = useMemo(() => {
    const stored = profiles.find((profile) => profile.id === activeId);
    return stored ?? draft;
  }, [profiles, activeId, draft]);

  const chartState = useMemo((): { chart: Chart | null; error: string | null } => {
    if (!current) return { chart: null, error: null };
    try {
      return { chart: buildChart(current.birth), error: null };
    } catch (error) {
      return {
        chart: null,
        error: error instanceof Error ? error.message : '사주를 계산할 수 없습니다.',
      };
    }
  }, [current]);

  const partner = useMemo(() => {
    if (!current) return null;
    return partnerChartOf(current, profiles);
  }, [current, profiles]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const persistProfiles = useCallback((next: Profile[]) => {
    setProfiles(next);
    saveProfiles(next);
  }, []);

  const handleSubmit = useCallback(
    (birth: BirthInput, options: { save: boolean }) => {
      const profile = createProfile(birth);
      if (options.save) {
        if (profiles.length >= MAX_PROFILES) {
          showToast(`프로필은 최대 ${MAX_PROFILES}개까지 저장할 수 있어요.`);
          setDraft(profile);
          return;
        }
        const next = [...profiles, profile];
        persistProfiles(next);
        setActiveId(profile.id);
        saveActiveId(profile.id);
        setDraft(null);
        setTab('saju');
        showToast('사주를 세웠어요. 프로필에 저장했습니다.');
      } else {
        setDraft(profile);
        setActiveId(null);
        saveActiveId(null);
        setTab('saju');
      }
    },
    [persistProfiles, profiles, showToast],
  );

  const handleUpdateCurrent = useCallback(
    (patch: Partial<Profile>) => {
      if (!current) return;
      const updated: Profile = { ...current, ...patch, updatedAt: Date.now() };
      if (profiles.some((profile) => profile.id === current.id)) {
        persistProfiles(profiles.map((profile) => (profile.id === current.id ? updated : profile)));
      } else {
        setDraft(updated);
      }
    },
    [current, persistProfiles, profiles],
  );

  const handleSelectProfile = useCallback(
    (id: string) => {
      setDraft(null);
      setActiveId(id);
      saveActiveId(id);
      setTab('saju');
    },
    [],
  );

  const handleDeleteProfile = useCallback(
    (id: string) => {
      const next = profiles.filter((profile) => profile.id !== id);
      persistProfiles(next);
      if (activeId === id) {
        const fallback = next[0]?.id ?? null;
        setActiveId(fallback);
        saveActiveId(fallback);
        setDraft(null);
      }
      showToast('프로필을 삭제했어요.');
    },
    [activeId, persistProfiles, profiles, showToast],
  );

  const handleAddProfile = useCallback(() => {
    if (profiles.length >= MAX_PROFILES) {
      showToast(`프로필은 최대 ${MAX_PROFILES}개까지 저장할 수 있어요.`);
      return;
    }
    setDraft(null);
    setActiveId(null);
    saveActiveId(null);
  }, [profiles.length, showToast]);

  const handleSettings = useCallback((next: Settings) => {
    setSettings(next);
    saveSettings(next);
  }, []);

  const handleClearAll = useCallback(() => {
    localStorage.removeItem('saju.profiles.v1');
    localStorage.removeItem('saju.activeProfile.v1');
    setProfiles([]);
    setActiveId(null);
    setDraft(null);
    setSettingsOpen(false);
    showToast('저장된 프로필을 모두 지웠어요.');
  }, [showToast]);

  const toggleAutoRead = useCallback(
    (value: boolean) => {
      handleSettings({ ...settings, autoRead: value });
      if (value && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        // iOS는 사용자 제스처 안에서 첫 발화를 걸어 두어야 이후 읽기가 동작한다.
        const warmup = new SpeechSynthesisUtterance(' ');
        warmup.volume = 0;
        warmup.lang = 'ko-KR';
        window.speechSynthesis.speak(warmup);
      }
    },
    [handleSettings, settings],
  );

  const previewVoice = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance('안녕하세요. 사주의 흐름을 함께 읽어 드릴게요.');
    utterance.lang = 'ko-KR';
    utterance.rate = settings.speechRate;
    const ko = synth.getVoices().find((voice) => voice.lang.startsWith('ko'));
    if (ko) utterance.voice = ko;
    synth.speak(utterance);
  }, [settings.speechRate]);

  useEffect(() => {
    saveActiveId(activeId);
  }, [activeId]);

  const speechSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

  const onboarding = !current || !chartState.chart;

  return (
    <div className="relative mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden border-white/5 bg-ink-950/55 sm:border-x">
      <header className="safe-top z-20 shrink-0 border-b border-white/8 bg-ink-950/75 backdrop-blur">
        <div className="flex h-12 items-center justify-between gap-2 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-[17px] leading-none">🔮</span>
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-semibold leading-tight text-slate-100">사주 AI</p>
              <p className="truncate text-[10px] leading-tight text-slate-500">
                {current ? `${current.birth.name || '이름 없음'} · ${current.birth.gender === 'male' ? '남' : '여'} · 만 ${chartState.chart?.age ?? '-'}세` : '만세력 · 인생 선택 시뮬레이터'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {profileSaved(current, profiles) && tab !== 'saju' ? (
              <button
                type="button"
                onClick={() => setTab('saju')}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10.5px] text-slate-300"
              >
                내 사주
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="설정"
              className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-300 active:bg-white/10"
            >
              <Icon name="gear" className="h-[17px] w-[17px]" />
            </button>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden">
        {onboarding ? (
          <div className="h-full overflow-y-auto overscroll-contain">
            <Onboarding
              onSubmit={handleSubmit}
              savedCount={profiles.length}
              onCancel={
                profiles.length > 0
                  ? () => {
                      const first = profiles[0];
                      setDraft(null);
                      setActiveId(first.id);
                      saveActiveId(first.id);
                    }
                  : undefined
              }
            />
            {chartState.error ? (
              <p className="mx-4 mb-4 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200">
                {chartState.error}
              </p>
            ) : null}
          </div>
        ) : tab === 'saju' ? (
          <div className="h-full overflow-y-auto overscroll-contain">
            <SajuTab
              profile={current}
              chart={chartState.chart!}
              profiles={profiles}
              activeId={current.id}
              onSelectProfile={handleSelectProfile}
              onDeleteProfile={handleDeleteProfile}
              onAddProfile={handleAddProfile}
              onMarriageChange={(marriage: MarriageInfo) => handleUpdateCurrent({ marriage })}
              onOpenChat={() => setTab('chat')}
              onOpenChoice={() => setTab('choice')}
            />
          </div>
        ) : tab === 'chat' ? (
          <ChatTab
            key={`chat-${current.id}`}
            profile={current}
            chart={chartState.chart!}
            partner={partner}
            settings={settings}
            onOpenSettings={() => setSettingsOpen(true)}
            onToggleAutoRead={toggleAutoRead}
          />
        ) : (
          <ChoiceTab
            key={`choice-${current.id}`}
            profile={current}
            chart={chartState.chart!}
            partner={partner}
            settings={settings}
          />
        )}
      </main>

      {!onboarding ? (
        <nav className="safe-bottom z-20 shrink-0 border-t border-white/8 bg-ink-950/90 backdrop-blur">
          <div className="flex items-stretch">
            {TABS.map((item) => {
              const active = tab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className="relative flex flex-1 flex-col items-center gap-0.5 py-2"
                >
                  <Icon
                    name={item.icon}
                    className={cn('h-[19px] w-[19px] transition-colors', active ? 'text-gold' : 'text-slate-500')}
                  />
                  <span className={cn('text-[10px] font-medium', active ? 'text-gold' : 'text-slate-500')}>
                    {item.label}
                  </span>
                  {active ? <span className="absolute top-0 h-0.5 w-8 rounded-full bg-gold" /> : null}
                </button>
              );
            })}
          </div>
        </nav>
      ) : null}

      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-6">
          <div className="animate-fade-up rounded-full border border-white/12 bg-ink-800/95 px-4 py-2 text-[12px] text-slate-200 shadow-lg">
            {toast}
          </div>
        </div>
      ) : null}

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={handleSettings}
        onClearAll={handleClearAll}
        speechSupported={speechSupported}
        onPreviewVoice={previewVoice}
      />
    </div>
  );
}

function profileSaved(profile: Profile | null, profiles: Profile[]): boolean {
  return Boolean(profile && profiles.some((item) => item.id === profile.id));
}
