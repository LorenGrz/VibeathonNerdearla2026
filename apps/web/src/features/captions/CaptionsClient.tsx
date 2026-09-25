'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LanguageCodeValue, SessionStatus } from '@subs/domain';
import { CaptionControls } from './CaptionControls';
import { CaptionFeed } from './CaptionFeed';
import { ConnectionBadge } from './ConnectionBadge';
import { LanguageSelector } from './LanguageSelector';
import type { FontSize } from './usePreferences';
import { useCaptionPreferences } from './usePreferences';
import { useCaptions } from './useCaptions';

const FONT_SIZE_CLASSES: Record<FontSize, string> = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-3xl',
  xl: 'text-4xl',
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
  const { finals, partial, connectionStatus, sessionStatus } = useCaptions(
    sessionId,
    language,
    initialStatus ?? null,
  );
  const { preferences, increaseFontSize, decreaseFontSize, toggleHighContrast } =
    useCaptionPreferences();

  const handleLanguageChange = (next: LanguageCodeValue): void => {
    setLanguage(next);
    router.replace(`/s/${sessionId}?lang=${next}`, { scroll: false });
  };

  return (
    <section className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <LanguageSelector languages={languages} active={language} onChange={handleLanguageChange} />
        <ConnectionBadge status={connectionStatus} sessionStatus={sessionStatus} />
      </div>
      <CaptionControls
        onIncrease={increaseFontSize}
        onDecrease={decreaseFontSize}
        onToggleContrast={toggleHighContrast}
        highContrast={preferences.highContrast}
      />
      <CaptionFeed
        finals={finals}
        partial={partial}
        fontSizeClassName={FONT_SIZE_CLASSES[preferences.fontSize]}
        highContrast={preferences.highContrast}
        sessionStatus={sessionStatus}
      />
    </section>
  );
}
