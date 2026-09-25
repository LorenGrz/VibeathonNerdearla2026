import { systemClock, type Clock } from '@subs/domain';

/** Optional Nest token to override retry/backoff timings (tests use tiny values). */
export const ORCHESTRATOR_OPTIONS = Symbol('ORCHESTRATOR_OPTIONS');

export interface OrchestratorOptions {
  /** First retry delay; doubles on each consecutive failure. */
  baseDelayMs: number;
  /** Cap for the exponential backoff. */
  maxDelayMs: number;
  /** Consecutive failed retries allowed before `session.fail()`. */
  maxRetries: number;
  /** Max time `stop()` waits for a pipeline to wind down after abort. */
  stopTimeoutMs: number;
  clock: Clock;
}

export const DEFAULT_ORCHESTRATOR_OPTIONS: OrchestratorOptions = {
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
  maxRetries: 5,
  stopTimeoutMs: 5000,
  clock: systemClock,
};

/** Delay before retry number `failure` (1-based): base * 2^(failure-1), capped at maxDelayMs. */
export const backoffDelay = (
  failure: number,
  o: Pick<OrchestratorOptions, 'baseDelayMs' | 'maxDelayMs'>,
): number => Math.min(o.baseDelayMs * 2 ** Math.max(0, failure - 1), o.maxDelayMs);
