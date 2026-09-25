import type { CaptionDto, SessionMetricsDto, SessionStatus } from '@subs/domain';

/** PCM s16le mono at 16 kHz: 16 000 samples/s × 2 bytes = 32 bytes per millisecond. */
const PCM_BYTES_PER_MS = 32;

/**
 * Where the server's audio is, sampled when a metrics snapshot arrives.
 * `atMs` is the client's clock (`performance.now()`), so server/client clock skew never matters.
 */
export interface ClockAnchor {
  audioMs: number;
  atMs: number;
  running: boolean;
}

export function anchorFromMetrics(
  metrics: Pick<SessionMetricsDto, 'bytesIn'>,
  status: SessionStatus,
  atMs: number,
): ClockAnchor {
  return { audioMs: metrics.bytesIn / PCM_BYTES_PER_MS, atMs, running: status === 'live' };
}

/** Audio position of the server "now": the anchor plus the time elapsed while live. */
export function audioNowMs(anchor: ClockAnchor, nowMs: number): number {
  return anchor.running ? anchor.audioMs + Math.max(0, nowMs - anchor.atMs) : anchor.audioMs;
}

/**
 * Program position the viewer should be at: the live audio minus the broadcast delay. The delay
 * gives transcription + translation time to arrive before the video reaches that sentence.
 */
export function playheadMs(audioMs: number, delayMs: number): number {
  return Math.max(0, audioMs - delayMs);
}

/** Maps an audio offset to a position in the source video (clips loop with `-stream_loop`). */
export function videoSecondsAt(
  audioMs: number,
  video: { startSeconds: number; clipSeconds: number | null },
): number {
  const clipMs = video.clipSeconds ? video.clipSeconds * 1000 : null;
  const offsetMs = clipMs ? audioMs % clipMs : audioMs;
  return video.startSeconds + offsetMs / 1000;
}

/** Only captions whose speech already started at the playhead are shown. */
export function captionsAt(
  finals: readonly CaptionDto[],
  partial: CaptionDto | null,
  playhead: number,
): { finals: CaptionDto[]; partial: CaptionDto | null } {
  return {
    finals: finals.filter((caption) => caption.startMs <= playhead),
    partial: partial && partial.startMs <= playhead ? partial : null,
  };
}

/** Seek only when the player drifted enough to be noticeable; small drift is left alone. */
export const DRIFT_TOLERANCE_SECONDS = 1.5;

export function needsSeek(currentSeconds: number, targetSeconds: number): boolean {
  return Math.abs(currentSeconds - targetSeconds) > DRIFT_TOLERANCE_SECONDS;
}
