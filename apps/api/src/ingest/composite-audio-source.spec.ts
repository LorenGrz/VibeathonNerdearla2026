import type { AudioChunk, AudioSourcePort } from '@subs/domain';
import type { ContextualAudioSource } from './audio-source-context.js';
import { CompositeAudioSource } from './composite-audio-source.js';

async function* once(tag: number): AsyncGenerator<AudioChunk> {
  yield { data: new Uint8Array([tag]), offsetMs: 0, durationMs: 100 };
}

describe('CompositeAudioSource', () => {
  const setup = () => {
    const ffmpeg = { open: vi.fn(() => once(1)) } satisfies AudioSourcePort;
    const mic = { open: vi.fn(() => once(2)) } satisfies ContextualAudioSource;
    return { ffmpeg, mic, composite: new CompositeAudioSource(ffmpeg, mic) };
  };
  const signal = new AbortController().signal;

  it.each([
    { kind: 'file', path: 'talk.mp3' },
    { kind: 'url', url: 'https://example.com/live.m3u8' },
  ] as const)('sends $kind sources to ffmpeg', (spec) => {
    const { ffmpeg, mic, composite } = setup();
    composite.open(spec, signal, { sessionId: 's-1' });
    expect(ffmpeg.open).toHaveBeenCalledWith(spec, signal);
    expect(mic.open).not.toHaveBeenCalled();
  });

  it('sends mic sources to the mic source with the session context', async () => {
    const { ffmpeg, mic, composite } = setup();
    const chunks: AudioChunk[] = [];
    for await (const chunk of composite.open({ kind: 'mic' }, signal, { sessionId: 's-1' })) {
      chunks.push(chunk);
    }
    expect(mic.open).toHaveBeenCalledWith({ kind: 'mic' }, signal, { sessionId: 's-1' });
    expect(ffmpeg.open).not.toHaveBeenCalled();
    expect(chunks[0]?.data[0]).toBe(2);
  });
});
