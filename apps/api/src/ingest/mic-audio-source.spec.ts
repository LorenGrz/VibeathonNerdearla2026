import type { AudioChunk } from '@subs/domain';
import { MIC_CHUNK_BYTES, MicAudioSource } from './mic-audio-source.js';

const SESSION = 'session-1';
const EMITTER = 'socket-a';

/** Waits until the generator body has run (and registered its stream) by pulling once. */
function start(source: MicAudioSource, signal: AbortSignal, sessionId = SESSION) {
  const iterator = source.open({ kind: 'mic' }, signal, { sessionId })[Symbol.asyncIterator]();
  const first = iterator.next();
  return { iterator, first };
}

/** Bytes whose first byte identifies the chunk, so drop order is observable. */
function tagged(tag: number, bytes = MIC_CHUNK_BYTES): Uint8Array {
  const data = new Uint8Array(bytes);
  data[0] = tag;
  return data;
}

async function collect(iterator: AsyncIterator<AudioChunk>, count: number): Promise<AudioChunk[]> {
  const out: AudioChunk[] = [];
  for (let i = 0; i < count; i += 1) {
    const next = await iterator.next();
    if (next.done) break;
    out.push(next.value);
  }
  return out;
}

describe('MicAudioSource', () => {
  it('re-slices arbitrary pushes into 100 ms chunks with increasing offsetMs', async () => {
    const source = new MicAudioSource();
    const controller = new AbortController();
    source.claim(SESSION, EMITTER);
    const { iterator, first } = start(source, controller.signal);

    // 2.5 chunks, then 0.5 chunk: exactly 3 chunks in total, split across pushes.
    source.push(SESSION, EMITTER, new Uint8Array(MIC_CHUNK_BYTES * 2.5));
    source.push(SESSION, EMITTER, new Uint8Array(MIC_CHUNK_BYTES * 0.5));

    const chunks = [(await first).value as AudioChunk, ...(await collect(iterator, 2))];
    expect(chunks.map((c) => c.offsetMs)).toEqual([0, 100, 200]);
    expect(chunks.every((c) => c.durationMs === 100)).toBe(true);
    expect(chunks.every((c) => c.data.byteLength === MIC_CHUNK_BYTES)).toBe(true);
    controller.abort();
  });

  it('drops the oldest chunks when more than 2 s are queued', async () => {
    const source = new MicAudioSource();
    const controller = new AbortController();
    source.claim(SESSION, EMITTER);
    const { iterator, first } = start(source, controller.signal);

    source.push(SESSION, EMITTER, tagged(0)); // resolves the pending `first` immediately
    const firstChunk = (await first).value as AudioChunk;
    expect(firstChunk.data[0]).toBe(0);

    for (let tag = 1; tag <= 25; tag += 1) source.push(SESSION, EMITTER, tagged(tag));
    expect(source.droppedChunks(SESSION)).toBe(5);

    const kept = await collect(iterator, 20);
    expect(kept.map((c) => c.data[0])).toEqual(Array.from({ length: 20 }, (_, i) => i + 6));
    // Offsets keep the real timeline: dropped audio leaves a gap, never a rewind.
    expect(kept[0]?.offsetMs).toBe(600);
    expect(kept.at(-1)?.offsetMs).toBe(2500);
    controller.abort();
  });

  it('ends the iterable when the signal aborts', async () => {
    const source = new MicAudioSource();
    const controller = new AbortController();
    const { iterator, first } = start(source, controller.signal);

    controller.abort();
    await expect(first).resolves.toEqual({ value: undefined, done: true });
    await expect(iterator.next()).resolves.toMatchObject({ done: true });

    // After the run ended, pushed audio goes nowhere (and does not throw).
    source.claim(SESSION, EMITTER);
    expect(source.push(SESSION, EMITTER, tagged(1))).toBe(true);
  });

  it('yields nothing when opened with an already aborted signal', async () => {
    const source = new MicAudioSource();
    const controller = new AbortController();
    controller.abort();
    const { first } = start(source, controller.signal);
    await expect(first).resolves.toMatchObject({ done: true });
  });

  it('accepts a single emitter per session', async () => {
    const source = new MicAudioSource();
    const controller = new AbortController();
    const { iterator, first } = start(source, controller.signal);

    expect(source.claim(SESSION, EMITTER)).toBe(true);
    expect(source.claim(SESSION, EMITTER)).toBe(true); // idempotent for the owner
    expect(source.claim(SESSION, 'socket-b')).toBe(false);
    expect(source.push(SESSION, 'socket-b', tagged(9))).toBe(false);

    source.release(SESSION, 'socket-b'); // not the owner: no effect
    expect(source.emitterOf(SESSION)).toBe(EMITTER);

    source.push(SESSION, EMITTER, tagged(1));
    expect(((await first).value as AudioChunk).data[0]).toBe(1);

    source.release(SESSION, EMITTER);
    expect(source.claim(SESSION, 'socket-b')).toBe(true);
    source.push(SESSION, 'socket-b', tagged(2));
    expect((await collect(iterator, 1))[0]?.data[0]).toBe(2);
    controller.abort();
  });

  it('isolates sessions', async () => {
    const source = new MicAudioSource();
    const a = new AbortController();
    const b = new AbortController();
    source.claim('a', EMITTER);
    source.claim('b', 'socket-b');
    const runA = start(source, a.signal, 'a');
    const runB = start(source, b.signal, 'b');

    source.push('b', 'socket-b', tagged(2));
    source.push('a', EMITTER, tagged(1));

    expect(((await runA.first).value as AudioChunk).data[0]).toBe(1);
    expect(((await runB.first).value as AudioChunk).data[0]).toBe(2);
    a.abort();
    b.abort();
  });

  it('rejects non-mic specs and a missing session id', async () => {
    const source = new MicAudioSource();
    const signal = new AbortController().signal;
    const fileRun = source.open({ kind: 'file', path: 'x.mp3' }, signal, { sessionId: SESSION });
    await expect(fileRun[Symbol.asyncIterator]().next()).rejects.toThrow(/cannot open "file"/);
    const noContext = source.open({ kind: 'mic' }, signal);
    await expect(noContext[Symbol.asyncIterator]().next()).rejects.toThrow(/context.sessionId/);
  });

  it('a new run for the same session supersedes the previous one', async () => {
    const source = new MicAudioSource();
    const controller = new AbortController();
    const old = start(source, controller.signal);
    const fresh = start(source, controller.signal);

    await expect(old.first).resolves.toMatchObject({ done: true });
    source.claim(SESSION, EMITTER);
    source.push(SESSION, EMITTER, tagged(4));
    expect(((await fresh.first).value as AudioChunk).data[0]).toBe(4);
    controller.abort();
  });
});
