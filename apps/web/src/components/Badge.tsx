import type { ReactNode } from 'react';

export type BadgeTone = 'live' | 'neutral' | 'warning' | 'error';

const TONE_CLASSES: Record<BadgeTone, string> = {
  live: 'border-brand bg-brand-tint text-text',
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
      className={`inline-flex items-center gap-1.5 rounded-chip border px-3 py-1 font-display text-xs font-semibold uppercase tracking-wide ${TONE_CLASSES[tone]}`}
    >
      {tone === 'live' ? (
        <span className="h-2 w-2 rounded-full bg-brand-bright" aria-hidden="true" />
      ) : null}
      {children}
    </span>
  );
}
