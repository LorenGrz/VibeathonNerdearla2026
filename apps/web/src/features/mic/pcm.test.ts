import { describe, expect, it } from 'vitest';
import {
  FRAME_SAMPLES,
  PcmEncoder,
  downsampleToInt16,
  floatToInt16,
  meterLevel,
  rmsInt16,
} from './pcm';

function sine(samples: number, rate: number, hz = 440, amplitude = 0.5): Float32Array {
  return Float32Array.from(
    { length: samples },
    (_, i) => amplitude * Math.sin((2 * Math.PI * hz * i) / rate),
  );
}

describe('floatToInt16', () => {
  it('scales and clamps to the Int16 range', () => {
    expect(floatToInt16(0)).toBe(0);
    expect(floatToInt16(1)).toBe(32767);
    expect(floatToInt16(-1)).toBe(-32768);
    expect(floatToInt16(0.5)).toBe(16384);
    expect(floatToInt16(2)).toBe(32767);
    expect(floatToInt16(-3)).toBe(-32768);
    expect(floatToInt16(Number.NaN)).toBe(0);
  });
});

describe('downsampleToInt16', () => {
  it('turns 100 ms at 48 kHz into 1600 samples at 16 kHz', () => {
    const out = downsampleToInt16(new Float32Array(4800).fill(0.25), 48_000);
    expect(out).toHaveLength(1600);
    expect(out.every((s) => s === floatToInt16(0.25))).toBe(true);
  });

  it('averages each window (box filter)', () => {
    const out = downsampleToInt16(Float32Array.from([0, 0.3, 0.6, 1, 1, 1]), 48_000);
    expect(Array.from(out)).toEqual([floatToInt16(0.3), 32767]);
  });

  it('handles non-integer ratios (44.1 kHz)', () => {
    const out = downsampleToInt16(new Float32Array(4410), 44_100);
    expect(Math.abs(out.length - 1600)).toBeLessThanOrEqual(1);
  });

  it('passes 16 kHz input through unchanged', () => {
    const input = Float32Array.from([0, 0.5, -0.5, 1]);
    expect(Array.from(downsampleToInt16(input, 16_000))).toEqual([0, 16384, -16384, 32767]);
  });
});

describe('PcmEncoder', () => {
  it('emits exact 100 ms frames from 128-sample worklet blocks, matching the stateless path', () => {
    const rate = 48_000;
    const signal = sine(rate, rate); // 1 s
    const encoder = new PcmEncoder(rate);
    const frames = [];
    for (let i = 0; i < signal.length; i += 128) {
      frames.push(...encoder.push(signal.subarray(i, i + 128)));
    }

    expect(frames).toHaveLength(10);
    expect(frames.every((f) => f.pcm.length === FRAME_SAMPLES)).toBe(true);
    expect(frames.every((f) => f.pcm.buffer.byteLength === FRAME_SAMPLES * 2)).toBe(true);

    const streamed = frames.flatMap((f) => Array.from(f.pcm));
    expect(streamed).toEqual(Array.from(downsampleToInt16(signal, rate)));
  });

  it('keeps leftovers between pushes and never drifts at 44.1 kHz', () => {
    const rate = 44_100;
    const encoder = new PcmEncoder(rate);
    let total = 0;
    const block = sine(441, rate); // 10 ms blocks
    for (let i = 0; i < 300; i += 1) {
      total += encoder.push(block).length; // 3 s of audio
    }
    expect(total).toBeGreaterThanOrEqual(29);
    expect(total).toBeLessThanOrEqual(30);
  });

  it('reports the frame rms', () => {
    const encoder = new PcmEncoder(16_000);
    const [silence] = encoder.push(new Float32Array(FRAME_SAMPLES));
    const [loud] = encoder.push(new Float32Array(FRAME_SAMPLES).fill(0.5));
    expect(silence?.rms).toBe(0);
    expect(loud?.rms).toBeCloseTo(0.5, 3);
  });

  it('rejects invalid sample rates', () => {
    expect(() => new PcmEncoder(0)).toThrow();
  });
});

describe('meter helpers', () => {
  it('computes rms and maps it to a -60..0 dBFS meter', () => {
    expect(rmsInt16(new Int16Array(0))).toBe(0);
    expect(rmsInt16(new Int16Array([16384, -16384]))).toBeCloseTo(0.5, 5);
    expect(meterLevel(0)).toBe(0);
    expect(meterLevel(1)).toBe(1);
    expect(meterLevel(0.001)).toBeCloseTo(0, 5); // -60 dBFS
    expect(meterLevel(0.0316)).toBeCloseTo(0.5, 2); // ~-30 dBFS
  });
});
