import { describe, expect, it } from 'vitest';
import { InvalidArgumentError } from '../shared/errors.js';
import { TimeRange } from './time-range.js';

describe('TimeRange', () => {
  it('computes duration and equality', () => {
    const r = TimeRange.of(1000, 2500);
    expect(r.durationMs()).toBe(1500);
    expect(r.equals(TimeRange.of(1000, 2500))).toBe(true);
    expect(TimeRange.of(5, 5).durationMs()).toBe(0);
  });

  it.each([
    [-1, 10],
    [10, 5],
    [0, Number.POSITIVE_INFINITY],
  ])('rejects (%s, %s)', (start, end) => {
    expect(() => TimeRange.of(start, end)).toThrow(InvalidArgumentError);
  });
});
