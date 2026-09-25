'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LanguageCodeValue, SessionStatus } from '@subs/domain';
import { startSession } from '@/features/admin/api';
import { CaptionControls } from './CaptionControls';
import { CaptionFeed } from './CaptionFeed';
import { ConnectionBadge } from './ConnectionBadge';
import { LanguageSelector } from './LanguageSelector';
import type { FontSize } from './usePreferences';
import { useCaptionPreferences } from './usePreferences';
import { useCaptions } from './useCaptions';

import { captionsAt, playheadMs } from '@/features/sync/programClock';
import { useProgramClock } from '@/features/sync/useProgramClock';
import type { VideoInfo } from '@/features/video/videoSource';
import { VideoPlayer } from '@/features/video/VideoPlayer';

/**
 * Originals arrive as partials within ~1 s. Translations wait for a final (utterances are capped
 * at 12 s) plus a Gemini call, so the video must trail the live audio by ~14 s.
 */
const DEFAULT_DELAY_S = { original: 3, translation: 14 } as const;

const FONT_SIZE_CLASSES: Record<FontSize, string> = {
  sm: 'text-sm sm:text-base',
  md: 'text-base sm:text-lg',
  lg: 'text-lg sm:text-xl',
  xl: 'text-xl sm:text-2xl',
};

export interface CaptionsClientProps {
  sessionId: string;
  languages: LanguageCodeValue[];
  initialLanguage: LanguageCodeValue;
  initialStatus?: SessionStatus;
  videoInfo?: VideoInfo | null;
}

export function CaptionsClient({
  sessionId,
  languages,
  initialLanguage,
  initialStatus,
  videoInfo,
}: CaptionsClientProps) {
  const router = useRouter();
  const [language, setLanguage] = useState<LanguageCodeValue>(initialLanguage);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSplitVideo, setShowSplitVideo] = useState(false);
  const { finals, partial, connectionStatus, sessionStatus } = useCaptions(
    sessionId,
    language,
    initialStatus ?? null,
  );
  const { preferences, increaseFontSize, decreaseFontSize, toggleHighContrast } =
    useCaptionPreferences();

  const isOriginal = language === languages[0];
  const [delayOverrides, setDelayOverrides] = useState<Partial<Record<LanguageCodeValue, number>>>(
    {},
  );
  const delaySeconds =
    delayOverrides[language] ??
    (isOriginal ? DEFAULT_DELAY_S.original : DEFAULT_DELAY_S.translation);
  const syncing = showSplitVideo && Boolean(videoInfo);
  const audioMs = useProgramClock(sessionId, syncing);
  // With the video open, captions follow the delayed playhead instead of arriving "early".
  const shown =
    syncing && audioMs !== null
      ? captionsAt(finals, partial, playheadMs(audioMs, delaySeconds * 1000))
      : { finals, partial };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleLanguageChange = (next: LanguageCodeValue): void => {
    setLanguage(next);
    router.replace(`/s/${sessionId}?lang=${next}`, { scroll: false });
  };

  const handleCopy = useCallback(async (): Promise<boolean> => {
    const text = finals.map((c) => c.text).join('\n\n');
    if (!text) return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }, [finals]);

  const handleDownloadTxt = useCallback(() => {
    const text = finals
      .map((c) => `[${new Date(c.startMs).toISOString().slice(14, 19)}] ${c.text}`)
      .join('\n\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LiveSubs-${sessionId.slice(0, 8)}-${language}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [finals, sessionId, language]);

  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const handleRestart = useCallback(() => {
    startSession(sessionId).catch(() => {});
  }, [sessionId]);

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-3 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <LanguageSelector languages={languages} active={language} onChange={handleLanguageChange} />
        <ConnectionBadge status={connectionStatus} sessionStatus={sessionStatus} />
      </div>

      <CaptionControls
        onIncrease={increaseFontSize}
        onDecrease={decreaseFontSize}
        onToggleContrast={toggleHighContrast}
        highContrast={preferences.highContrast}
        onCopy={finals.length > 0 ? handleCopy : undefined}
        onDownloadTxt={finals.length > 0 ? handleDownloadTxt : undefined}
        onToggleFullscreen={handleToggleFullscreen}
        isFullscreen={isFullscreen}
      />

      {videoInfo ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold uppercase text-accent">
              Video sincronizado disponible
            </span>
            <span className="text-text-muted hidden sm:inline">· {videoInfo.title}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSplitVideo((prev) => !prev)}
              className={`rounded px-2.5 py-1 font-display uppercase font-bold text-xs transition-all ${
                showSplitVideo
                  ? 'bg-accent text-ink shadow-sm'
                  : 'border border-line bg-surface hover:bg-surface-2 text-text'
              }`}
            >
              {showSplitVideo ? '✕ Cerrar Video Split' : '📺 Dividir Pantalla (Video + Subs)'}
            </button>
            <a
              href={videoInfo.watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-line bg-surface hover:bg-surface-2 px-2.5 py-1 text-text-soft hover:text-accent font-medium text-xs transition-colors"
            >
              Abrir en YouTube ↗
            </a>
          </div>
        </div>
      ) : null}

      <div
        className={`grid gap-4 w-full ${showSplitVideo && videoInfo ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}
      >
        {showSplitVideo && videoInfo ? (
          <VideoPlayer
            video={videoInfo}
            audioMs={audioMs}
            delaySeconds={delaySeconds}
            onDelayChange={(seconds) =>
              setDelayOverrides((prev) => ({ ...prev, [language]: seconds }))
            }
            onClose={() => setShowSplitVideo(false)}
          />
        ) : null}
        <CaptionFeed
          finals={shown.finals}
          partial={shown.partial}
          fontSizeClassName={FONT_SIZE_CLASSES[preferences.fontSize]}
          highContrast={preferences.highContrast}
          sessionStatus={sessionStatus}
          onRestart={handleRestart}
        />
      </div>
    </section>
  );
}
