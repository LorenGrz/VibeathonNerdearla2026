import type { ReactNode } from 'react';

export type BadgeTone = 'live' | 'neutral' | 'warning' | 'error';

const TONE_CLASSES: Record<BadgeTone, string> = {
  live: 'border-brand bg-brand-tint text-text shadow-[0_0_12px_rgba(224,40,50,0.25)]',
  neutral: 'border-line-strong bg-glass text-text-soft',
  warning: 'border-accent bg-accent/10 text-accent',
  error: 'border-brand bg-brand/10 text-brand-soft',
};

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-chip border px-3 py-1 font-display text-xs font-semibold uppercase tracking-wide transition-all ${TONE_CLASSES[tone]}`}
    >
      {tone === 'live' ? (
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-bright opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-bright" />
        </span>
      ) : null}
      {children}
    </span>
  );
}
