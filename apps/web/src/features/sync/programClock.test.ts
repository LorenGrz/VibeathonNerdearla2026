import { describe, expect, it } from 'vitest';
import type { CaptionDto } from '@subs/domain';
import {
  anchorFromMetrics,
  audioNowMs,
  captionsAt,
  needsSeek,
  playheadMs,
  videoSecondsAt,
} from './programClock';

const caption = (id: string, startMs: number, isFinal = true): CaptionDto => ({
  id,
  sessionId: 's1',
  language: 'es',
  text: id,
  startMs,
  endMs: startMs + 3000,
  isFinal,
  kind: 'original',
});

describe('programClock', () => {
  it('should convert PCM bytes to milliseconds of audio when anchoring on metrics', () => {
    const anchor = anchorFromMetrics({ bytesIn: 320_000 }, 'live', 1_000);
    expect(anchor).toEqual({ audioMs: 10_000, atMs: 1_000, running: true });
  });

  it('should advance the audio clock with elapsed time only while the session is live', () => {
    const live = anchorFromMetrics({ bytesIn: 320_000 }, 'live', 1_000);
    const stopped = anchorFromMetrics({ bytesIn: 320_000 }, 'stopped', 1_000);
    expect(audioNowMs(live, 3_500)).toBe(12_500);
    expect(audioNowMs(stopped, 3_500)).toBe(10_000);
  });

  it('should keep the playhead behind the live audio by the delay and never below zero', () => {
    expect(playheadMs(20_000, 8_000)).toBe(12_000);
    expect(playheadMs(3_000, 8_000)).toBe(0);
  });

  it('should map audio offsets into the looping clip of the source video', () => {
    const video = { startSeconds: 60, clipSeconds: 90 };
    expect(videoSecondsAt(30_000, video)).toBe(90);
    expect(videoSecondsAt(95_000, video)).toBe(65);
    expect(videoSecondsAt(95_000, { startSeconds: 0, clipSeconds: null })).toBe(95);
  });

  it('should only show captions whose speech started at the playhead', () => {
    const finals = [caption('a', 0), caption('b', 7_000), caption('c', 14_000)];
    const visible = captionsAt(finals, caption('p', 21_000, false), 10_000);
    expect(visible.finals.map((c) => c.id)).toEqual(['a', 'b']);
    expect(visible.partial).toBeNull();
    expect(captionsAt(finals, caption('p', 9_000, false), 10_000).partial?.id).toBe('p');
  });

  it('should seek only when drift exceeds the tolerance', () => {
    expect(needsSeek(100, 101)).toBe(false);
    expect(needsSeek(100, 102)).toBe(true);
  });
});
