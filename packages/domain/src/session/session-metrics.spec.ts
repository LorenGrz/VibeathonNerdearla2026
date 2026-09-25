import { describe, expect, it } from 'vitest';
import { fixedClock } from '../shared/clock.js';
import { LATENCY_WINDOW_SIZE, SessionMetrics, percentile } from './session-metrics.js';

describe('percentile', () => {
  it('uses nearest-rank', () => {
    const values = Array.from({ length: 100 }, (_, i) => 100 - i); // 100..1 unsorted
    expect(percentile(values, 50)).toBe(50);
    expect(percentile(values, 95)).toBe(95);
    expect(percentile([7], 95)).toBe(7);
    expect(percentile([], 50)).toBeNull();
  });
});

describe('SessionMetrics', () => {
  it('starts empty', () => {
    expect(new SessionMetrics(fixedClock(0)).snapshot()).toEqual({
      chunksIn: 0,
      bytesIn: 0,
      latencyP50Ms: null,
      latencyP95Ms: null,
      errors: 0,
      lastError: null,
      lastActivityAt: null,
    });
  });

  it('counts chunks, bytes and errors and tracks last activity', () => {
    const clock = fixedClock('2026-02-02T10:00:00.000Z');
    const m = new SessionMetrics(clock);
    m.recordChunk(100);
    m.recordChunk(50);
    clock.set(new Date('2026-02-02T10:00:05.000Z'));
    m.recordError('first');
    m.recordError('second');
    expect(m.snapshot()).toMatchObject({
      chunksIn: 2,
      bytesIn: 150,
      errors: 2,
      lastError: 'second',
      lastActivityAt: '2026-02-02T10:00:05.000Z',
    });
  });

  it('computes p50/p95 over the recorded latencies', () => {
    const m = new SessionMetrics(fixedClock(0));
    for (let i = 1; i <= 20; i++) m.recordLatency(i * 10);
    expect(m.snapshot()).toMatchObject({ latencyP50Ms: 100, latencyP95Ms: 190 });
  });

  it('only keeps the last 100 samples (circular window)', () => {
    const m = new SessionMetrics(fixedClock(0));
    for (let i = 0; i < LATENCY_WINDOW_SIZE; i++) m.recordLatency(10_000);
    for (let i = 1; i <= LATENCY_WINDOW_SIZE; i++) m.recordLatency(i);
    expect(m.snapshot()).toMatchObject({ latencyP50Ms: 50, latencyP95Ms: 95 });
    for (let i = 0; i < 50; i++) m.recordLatency(1000);
    // window now: 51..100 plus 50x 1000
    expect(m.snapshot()).toMatchObject({ latencyP50Ms: 100, latencyP95Ms: 1000 });
  });

  it('ignores invalid latencies', () => {
    const m = new SessionMetrics(fixedClock(0));
    m.recordLatency(-1);
    m.recordLatency(Number.NaN);
    expect(m.snapshot().latencyP50Ms).toBeNull();
  });
});
