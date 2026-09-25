'use client';

import { useEffect, useRef, useState } from 'react';
import { needsSeek, playheadMs, videoSecondsAt } from '@/features/sync/programClock';
import type { VideoInfo } from './videoSource';
import { useYouTubePlayer } from './useYouTubePlayer';

const SYNC_CHECK_MS = 1_000;
export const MIN_DELAY_S = 0;
export const MAX_DELAY_S = 20;

interface VideoPlayerProps {
  video: VideoInfo;
  /** Live audio position of the session (ms), or null while unknown. */
  audioMs: number | null;
  delaySeconds: number;
  onDelayChange: (seconds: number) => void;
  onClose?: () => void;
}

/**
 * Plays the source video `delaySeconds` behind the live audio, so captions (gated on the same
 * playhead) land when the speaker says them: a broadcast delay, like TV live captioning.
 */
export function VideoPlayer({
  video,
  audioMs,
  delaySeconds,
  onDelayChange,
  onClose,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const player = useYouTubePlayer(containerRef, video.youtubeId, video.startSeconds);
  const [driftSeconds, setDriftSeconds] = useState<number | null>(null);

  const targetRef = useRef<number | null>(null);
  useEffect(() => {
    targetRef.current =
      audioMs === null ? null : videoSecondsAt(playheadMs(audioMs, delaySeconds * 1000), video);
  }, [audioMs, delaySeconds, video]);

  const { ready, playing, currentTime, seek } = player;
  useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => {
      const target = targetRef.current;
      const current = currentTime();
      if (target === null || current === null) return;
      setDriftSeconds(current - target);
      if (playing && needsSeek(current, target)) seek(target);
    }, SYNC_CHECK_MS);
    return () => clearInterval(id);
  }, [ready, playing, currentTime, seek]);

  const syncNow = (): void => {
    if (targetRef.current !== null) seek(targetRef.current);
  };

  const synced = playing && driftSeconds !== null && Math.abs(driftSeconds) <= 1.5;

  return (
    <div className="flex flex-col overflow-hidden rounded-cta border border-line bg-surface-2 shadow-md">
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-2 text-xs">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />
          <span className="font-display font-bold uppercase tracking-wider text-text">
            Video de la charla
          </span>
          <span className="hidden max-w-xs truncate text-text-muted sm:inline">
            ({video.title})
          </span>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="px-1 text-sm font-bold text-text-muted hover:text-text"
            title="Cerrar video"
          >
            ✕
          </button>
        ) : null}
      </div>

      <div
        ref={containerRef}
        className="relative aspect-video w-full bg-black [&>*]:absolute [&>*]:inset-0 [&>*]:h-full [&>*]:w-full"
      />

      <div className="flex flex-col gap-3 bg-surface p-3 text-xs text-text-soft">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className={`rounded-chip border px-2.5 py-0.5 font-display font-semibold uppercase ${
              synced ? 'border-teal text-teal' : 'border-accent text-accent'
            }`}
          >
            {audioMs === null
              ? 'Esperando audio de la sesión…'
              : synced
                ? `Sincronizado · desfase ${driftSeconds?.toFixed(1)} s`
                : playing
                  ? 'Resincronizando…'
                  : 'Pausado'}
          </span>
          <button
            type="button"
            onClick={syncNow}
            disabled={!ready || audioMs === null}
            className="rounded-btn bg-brand px-3 py-1 font-display font-semibold uppercase text-white disabled:opacity-40"
          >
            ▶ Sincronizar con el vivo
          </button>
        </div>

        <label className="flex items-center gap-3">
          <span className="shrink-0 font-display uppercase text-text">Retraso</span>
          <input
            type="range"
            min={MIN_DELAY_S}
            max={MAX_DELAY_S}
            step={1}
            value={delaySeconds}
            onChange={(event) => onDelayChange(Number(event.target.value))}
            className="w-full accent-[var(--accent)]"
            aria-label="Retraso del video respecto del vivo, en segundos"
          />
          <span className="w-10 shrink-0 text-right font-display text-sm text-accent">
            {delaySeconds} s
          </span>
        </label>
        <p className="text-text-muted">
          El video corre {delaySeconds} s detrás del audio en vivo para que la transcripción y la
          traducción lleguen a tiempo. Si los subtítulos llegan tarde, subí el retraso.
        </p>
      </div>
    </div>
  );
}
