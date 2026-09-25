'use client';

import { useEffect, useState } from 'react';
import type { SessionDto } from '@subs/domain';
import { getApiBaseUrl } from '@/lib/api';
import { anchorFromMetrics, audioNowMs, type ClockAnchor } from './programClock';

const POLL_MS = 2_000;
const TICK_MS = 250;

/**
 * Estimates where the server's audio is right now (ms since the session started streaming).
 * Anchors on `metrics.bytesIn` every 2 s and interpolates in between; `null` until the first
 * snapshot arrives.
 */
export function useProgramClock(sessionId: string, enabled: boolean): number | null {
  const [anchor, setAnchor] = useState<ClockAnchor | null>(null);
  const [audioMs, setAudioMs] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const poll = (): void => {
      fetch(`${getApiBaseUrl()}/api/sessions/${encodeURIComponent(sessionId)}`, {
        cache: 'no-store',
      })
        .then((res) => (res.ok ? (res.json() as Promise<SessionDto>) : null))
        .then((session) => {
          if (!cancelled && session) {
            setAnchor(anchorFromMetrics(session.metrics, session.status, performance.now()));
          }
        })
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [sessionId, enabled]);

  useEffect(() => {
    if (!enabled || !anchor) return;
    const id = setInterval(() => setAudioMs(audioNowMs(anchor, performance.now())), TICK_MS);
    return () => clearInterval(id);
  }, [anchor, enabled]);

  return enabled ? audioMs : null;
}
