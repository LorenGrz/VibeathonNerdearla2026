'use client';

import { useEffect, useRef, useState } from 'react';
import type { CaptionDto } from '@subs/domain';

const AUTO_SCROLL_THRESHOLD_PX = 48;

export interface CaptionFeedProps {
  finals: CaptionDto[];
  partial: CaptionDto | null;
  fontSizeClassName: string;
  highContrast: boolean;
}

export function CaptionFeed({
  finals,
  partial,
  fontSizeClassName,
  highContrast,
}: CaptionFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Pause autoscroll once the user scrolls away from the bottom of the feed.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleScroll = (): void => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setAutoScroll(distanceFromBottom < AUTO_SCROLL_THRESHOLD_PX);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!autoScroll) return;
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [finals, partial, autoScroll]);

  const isEmpty = finals.length === 0 && !partial;

  return (
    <div className="relative h-[calc(100dvh-16rem)] min-h-64 overflow-hidden">
      <div
        ref={containerRef}
        role="log"
        aria-live="polite"
        className={`h-full overflow-y-auto rounded-cta border border-line p-4 ${
          highContrast ? 'bg-black text-white' : 'bg-surface-2 text-text'
        } ${fontSizeClassName}`}
      >
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex items-center gap-1.5 py-2" aria-hidden="true">
              <span className="h-6 w-1.5 rounded-full bg-teal animate-pulse" />
              <span className="h-10 w-1.5 rounded-full bg-accent animate-pulse [animation-delay:150ms]" />
              <span className="h-4 w-1.5 rounded-full bg-brand animate-pulse [animation-delay:300ms]" />
            </div>
            <p className="font-display text-lg uppercase font-semibold text-text">
              Esperando subtítulos…
            </p>
            <p className="text-xs text-text-muted max-w-sm">
              El motor de Gemini está conectado y escuchando en tiempo real.
            </p>
          </div>
        ) : (
          <ul className="space-y-3.5 p-2">
            {finals.map((caption) => (
              <li key={caption.id} className="leading-relaxed">
                {caption.text}
              </li>
            ))}
            {partial ? (
              <li
                key={partial.id}
                className="border-l-2 border-accent pl-3 text-accent/90 italic leading-relaxed"
              >
                {partial.text}
                <span className="inline-block w-1.5 h-4 ml-1.5 bg-accent align-middle animate-pulse" />
              </li>
            ) : null}
          </ul>
        )}
      </div>
      {!autoScroll ? (
        <button
          type="button"
          onClick={() => setAutoScroll(true)}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-chip border border-brand bg-brand-tint px-3 py-1 text-sm text-text"
        >
          Volver al final
        </button>
      ) : null}
    </div>
  );
}
