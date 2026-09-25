'use client';

import { useEffect } from 'react';
import type { LanguageCodeValue } from '@subs/domain';
import { OverlayLines } from './OverlayLines';
import { useCaptions } from './useCaptions';

/** Overrides the (otherwise opaque) body/html background so OBS/vMix can key on transparency. */
function useTransparentBody(): void {
  useEffect(() => {
    const { body, documentElement } = document;
    const previousBodyBackground = body.style.background;
    const previousHtmlBackground = documentElement.style.background;
    body.style.background = 'transparent';
    documentElement.style.background = 'transparent';
    return () => {
      body.style.background = previousBodyBackground;
      documentElement.style.background = previousHtmlBackground;
    };
  }, []);
}

export interface OverlayClientProps {
  sessionId: string;
  language: LanguageCodeValue;
  lines: number;
}

export function OverlayClient({ sessionId, language, lines }: OverlayClientProps) {
  useTransparentBody();
  const { finals, partial } = useCaptions(sessionId, language);
  const combined = partial ? [...finals, partial] : finals;

  return (
    <div className="fixed inset-0 flex flex-col justify-end bg-transparent p-8" aria-live="polite">
      <OverlayLines lines={combined} maxLines={lines} />
    </div>
  );
}
