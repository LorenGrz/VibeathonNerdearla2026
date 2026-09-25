import type { SessionStatus } from '@subs/domain';

const STALE_THRESHOLD_SECONDS = 10;

export function formatLatency(ms: number | null): string {
  if (ms === null) return '—';
  return `${Math.round(ms)} ms`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function secondsSince(isoDate: string | null, now: Date = new Date()): number | null {
  if (!isoDate) return null;
  const diffMs = now.getTime() - new Date(isoDate).getTime();
  return Math.max(0, Math.round(diffMs / 1000));
}

export function formatLastActivity(isoDate: string | null, now: Date = new Date()): string {
  const seconds = secondsSince(isoDate, now);
  if (seconds === null) return 'Sin actividad';
  if (seconds === 0) return 'Ahora mismo';
  return `Hace ${seconds}s`;
}

/** A `live` session is stale once it has gone more than 10s without recorded activity. */
export function isStale(
  status: SessionStatus,
  lastActivityAt: string | null,
  now: Date = new Date(),
): boolean {
  if (status !== 'live') return false;
  const seconds = secondsSince(lastActivityAt, now);
  return seconds === null || seconds > STALE_THRESHOLD_SECONDS;
}
