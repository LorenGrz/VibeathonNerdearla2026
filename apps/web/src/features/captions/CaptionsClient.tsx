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

const FONT_SIZE_CLASSES: Record<FontSize, string> = {
  sm: 'text-base sm:text-lg',
  md: 'text-xl sm:text-2xl',
  lg: 'text-2xl sm:text-3xl',
  xl: 'text-3xl sm:text-4xl',
};

export interface CaptionsClientProps {
  sessionId: string;
  languages: LanguageCodeValue[];
  initialLanguage: LanguageCodeValue;
  initialStatus?: SessionStatus;
}

export function CaptionsClient({
  sessionId,
  languages,
  initialLanguage,
  initialStatus,
}: CaptionsClientProps) {
  const router = useRouter();
  const [language, setLanguage] = useState<LanguageCodeValue>(initialLanguage);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { finals, partial, connectionStatus, sessionStatus } = useCaptions(
    sessionId,
    language,
    initialStatus ?? null,
  );
  const { preferences, increaseFontSize, decreaseFontSize, toggleHighContrast } =
    useCaptionPreferences();

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
    <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-3 p-4 sm:p-6">
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

      <CaptionFeed
        finals={finals}
        partial={partial}
        fontSizeClassName={FONT_SIZE_CLASSES[preferences.fontSize]}
        highContrast={preferences.highContrast}
        sessionStatus={sessionStatus}
        onRestart={handleRestart}
      />
    </section>
  );
}
