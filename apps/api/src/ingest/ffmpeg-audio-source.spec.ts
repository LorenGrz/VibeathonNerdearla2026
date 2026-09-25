import { resolve } from 'node:path';
import type { AudioChunk } from '@subs/domain';
import { FfmpegAudioSource } from './ffmpeg-audio-source.js';

const samplesDir = resolve(import.meta.dirname, '../../../../samples');

async function collect(iterable: AsyncIterable<AudioChunk>): Promise<AudioChunk[]> {
  const chunks: AudioChunk[] = [];
  for await (const chunk of iterable) {
    chunks.push(chunk);
  }
  return chunks;
}

describe('FfmpegAudioSource', () => {
  it('yields ~20 fixed 3200-byte chunks with increasing offsetMs for a 2s tone file', async () => {
    const source = new FfmpegAudioSource({ samplesDir, realtime: false });
    const controller = new AbortController();

    const chunks = await collect(
      source.open({ kind: 'file', path: 'tone-2s.mp3' }, controller.signal),
    );

    expect(chunks.length).toBeGreaterThanOrEqual(18);
    expect(chunks.length).toBeLessThanOrEqual(22);

    const allButLast = chunks.slice(0, -1);
    for (const chunk of allButLast) {
      expect(chunk.data.byteLength).toBe(3200);
      expect(chunk.durationMs).toBe(100);
    }

    const lastChunk = chunks.at(-1);
    expect(lastChunk?.data.byteLength).toBeGreaterThan(0);
    expect(lastChunk?.data.byteLength).toBeLessThanOrEqual(3200);

    chunks.forEach((chunk, index) => {
      expect(chunk.offsetMs).toBe(index * 100);
    });
  });

  it('rejects a relative path that escapes SAMPLES_DIR', async () => {
    const source = new FfmpegAudioSource({ samplesDir, realtime: false });
    const controller = new AbortController();

    await expect(async () => {
      for await (const _chunk of source.open(
        { kind: 'file', path: '../../etc/passwd' },
        controller.signal,
      )) {
        // no-op: the first `next()` call should throw before yielding anything
      }
    }).rejects.toThrow(/traversal|outside SAMPLES_DIR/i);
  });

  it('rejects an absolute path outside SAMPLES_DIR', async () => {
    const source = new FfmpegAudioSource({ samplesDir, realtime: false });
    const controller = new AbortController();

    await expect(async () => {
      for await (const _chunk of source.open(
        { kind: 'file', path: '/etc/passwd' },
        controller.signal,
      )) {
        // no-op
      }
    }).rejects.toThrow(/outside SAMPLES_DIR/i);
  });

  it('rejects the "mic" source kind', async () => {
    const source = new FfmpegAudioSource({ samplesDir, realtime: false });
    const controller = new AbortController();

    await expect(async () => {
      for await (const _chunk of source.open({ kind: 'mic' }, controller.signal)) {
        // no-op
      }
    }).rejects.toThrow(/mic/i);
  });

  it('stops iterating and kills ffmpeg when the signal aborts mid-stream', async () => {
    const source = new FfmpegAudioSource({ samplesDir, realtime: true });
    const controller = new AbortController();

    const iterator = source
      .open({ kind: 'file', path: 'tone-2s.mp3' }, controller.signal)
      [Symbol.asyncIterator]();

    const first = await iterator.next();
    expect(first.done).toBe(false);

    const start = Date.now();
    controller.abort();

    const collected: AudioChunk[] = [];
    let result = await iterator.next();
    while (!result.done) {
      collected.push(result.value);
      result = await iterator.next();
    }
    const elapsedMs = Date.now() - start;

    // With `-re` the full 2s tone would take ~2000ms to stream; aborting after the first
    // chunk must stop the process well before that instead of running to completion.
    expect(elapsedMs).toBeLessThan(1500);
    expect(collected.length).toBeLessThan(20);
  });
});
