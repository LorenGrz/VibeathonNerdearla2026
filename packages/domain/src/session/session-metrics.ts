import type { SessionMetricsDto } from '../contracts/dto.js';
import { systemClock, type Clock } from '../shared/clock.js';

export const LATENCY_WINDOW_SIZE = 100;

/** Nearest-rank percentile over an unsorted sample. Returns null for an empty sample. */
export const percentile = (values: readonly number[], p: number): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[Math.min(rank, sorted.length) - 1] ?? null;
};

export class SessionMetrics {
  private chunksIn = 0;
  private bytesIn = 0;
  private errors = 0;
  private lastError: string | null = null;
  private lastActivityAt: Date | null = null;
  private readonly latencies: number[] = [];
  private cursor = 0;

  constructor(private readonly clock: Clock = systemClock) {}

  recordChunk(bytes: number): void {
    this.chunksIn += 1;
    this.bytesIn += Math.max(0, bytes);
    this.touch();
  }

  /** Latency from audio-end to published segment. Kept in a circular window of 100 samples. */
  recordLatency(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) return;
    if (this.latencies.length < LATENCY_WINDOW_SIZE) {
      this.latencies.push(ms);
    } else {
      this.latencies[this.cursor] = ms;
    }
    this.cursor = (this.cursor + 1) % LATENCY_WINDOW_SIZE;
    this.touch();
  }

  recordError(message: string): void {
    this.errors += 1;
    this.lastError = message;
    this.touch();
  }

  snapshot(): SessionMetricsDto {
    return {
      chunksIn: this.chunksIn,
      bytesIn: this.bytesIn,
      latencyP50Ms: percentile(this.latencies, 50),
      latencyP95Ms: percentile(this.latencies, 95),
      errors: this.errors,
      lastError: this.lastError,
      lastActivityAt: this.lastActivityAt?.toISOString() ?? null,
    };
  }

  private touch(): void {
    this.lastActivityAt = this.clock.now();
  }
}
