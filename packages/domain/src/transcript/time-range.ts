import { InvalidArgumentError } from '../shared/errors.js';

export class TimeRange {
  private constructor(
    readonly startMs: number,
    readonly endMs: number,
  ) {
    Object.freeze(this);
  }

  static of(startMs: number, endMs: number): TimeRange {
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      throw new InvalidArgumentError('TimeRange bounds must be finite numbers');
    }
    if (startMs < 0) throw new InvalidArgumentError('TimeRange start cannot be negative');
    if (endMs < startMs) throw new InvalidArgumentError('TimeRange end cannot precede start');
    return new TimeRange(startMs, endMs);
  }

  durationMs(): number {
    return this.endMs - this.startMs;
  }

  equals(other: TimeRange): boolean {
    return this.startMs === other.startMs && this.endMs === other.endMs;
  }
}
