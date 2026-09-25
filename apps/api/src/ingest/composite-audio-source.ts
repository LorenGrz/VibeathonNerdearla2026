import type { AudioChunk, AudioSourcePort, AudioSourceSpec } from '@subs/domain';
import type { AudioSourceContext, ContextualAudioSource } from './audio-source-context.js';

/**
 * The adapter bound to `AUDIO_SOURCE`: dispatches by `spec.kind`.
 * `file`/`url` -> ffmpeg source · `mic` -> browser mic source (needs `context.sessionId`).
 */
export class CompositeAudioSource implements ContextualAudioSource {
  constructor(
    private readonly ffmpeg: AudioSourcePort,
    private readonly mic: ContextualAudioSource,
  ) {}

  open(
    spec: AudioSourceSpec,
    signal: AbortSignal,
    context?: AudioSourceContext,
  ): AsyncIterable<AudioChunk> {
    switch (spec.kind) {
      case 'file':
      case 'url':
        return this.ffmpeg.open(spec, signal);
      case 'mic':
        return this.mic.open(spec, signal, context);
    }
  }
}
