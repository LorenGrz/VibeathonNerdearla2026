import type { AudioChunk, AudioSourcePort, AudioSourceSpec } from '@subs/domain';

/**
 * Per-run information the api layer knows but `AudioSourceSpec` does not carry. `{ kind: 'mic' }`
 * has no payload: the mic source needs the session id to find the browser feeding that session.
 */
export interface AudioSourceContext {
  readonly sessionId: string;
}

/**
 * Api-layer widening of the domain `AudioSourcePort` with an optional third argument.
 * Every plain `AudioSourcePort` (2-parameter `open`) is structurally assignable to it, so the
 * domain port stays untouched and existing adapters/fakes keep working.
 */
export interface ContextualAudioSource extends AudioSourcePort {
  open(
    spec: AudioSourceSpec,
    signal: AbortSignal,
    context?: AudioSourceContext,
  ): AsyncIterable<AudioChunk>;
}
