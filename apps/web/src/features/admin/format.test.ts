import { describe, expect, it } from 'vitest';
import { formatBytes, formatLastActivity, formatLatency, isStale } from './format';

describe('formatLatency', () => {
  it('formats a rounded millisecond value', () => {
    expect(formatLatency(123.6)).toBe('124 ms');
  });

  it('renders a dash when there is no measurement yet', () => {
    expect(formatLatency(null)).toBe('—');
  });
});

describe('formatBytes', () => {
  it('formats bytes, kilobytes and megabytes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('formatLastActivity', () => {
  it('reports no activity when there is no timestamp', () => {
    expect(formatLastActivity(null)).toBe('Sin actividad');
  });

  it('reports "Ahora mismo" right at the timestamp', () => {
    const now = new Date('2026-09-25T12:00:00.000Z');
    expect(formatLastActivity(now.toISOString(), now)).toBe('Ahora mismo');
  });

  it('reports elapsed seconds since the last activity', () => {
    const now = new Date('2026-09-25T12:00:20.000Z');
    const lastActivityAt = '2026-09-25T12:00:05.000Z';
    expect(formatLastActivity(lastActivityAt, now)).toBe('Hace 15s');
  });
});

describe('isStale', () => {
  it('is never stale when the session is not live', () => {
    expect(isStale('stopped', null)).toBe(false);
  });

  it('is stale when a live session has no activity timestamp', () => {
    expect(isStale('live', null)).toBe(true);
  });

  it('is stale when a live session has been silent for more than 10s', () => {
    const now = new Date('2026-09-25T12:00:20.000Z');
    expect(isStale('live', '2026-09-25T12:00:00.000Z', now)).toBe(true);
  });

  it('is not stale when a live session had recent activity', () => {
    const now = new Date('2026-09-25T12:00:05.000Z');
    expect(isStale('live', '2026-09-25T12:00:00.000Z', now)).toBe(false);
  });
});
