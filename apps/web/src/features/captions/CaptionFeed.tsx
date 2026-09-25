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
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={containerRef}
        role="log"
        aria-live="polite"
        className={`h-full overflow-y-auto rounded-cta border border-line p-4 ${
          highContrast ? 'bg-black text-white' : 'bg-surface-2 text-text'
        } ${fontSizeClassName}`}
      >
        {isEmpty ? (
          <p className="text-text-muted">Esperando subtítulos…</p>
        ) : (
          <ul className="space-y-2">
            {finals.map((caption) => (
              <li key={caption.id}>{caption.text}</li>
            ))}
            {partial ? (
              <li key={partial.id} className="text-text-muted italic">
                {partial.text}
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
