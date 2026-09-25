/**
 * Pure PCM helpers for the browser mic: Float32 (any rate) -> Int16 16 kHz mono in 100 ms frames.
 * Kept free of Web Audio APIs so it is unit-testable; the AudioWorklet only captures samples.
 */

export const TARGET_SAMPLE_RATE = 16_000;
export const FRAME_MS = 100;
export const FRAME_SAMPLES = (TARGET_SAMPLE_RATE * FRAME_MS) / 1000; // 1600 samples = 3200 bytes

/** Clamps a Float32 sample to [-1, 1] and scales it to Int16 (NaN -> 0). */
export function floatToInt16(sample: number): number {
  if (Number.isNaN(sample)) return 0;
  const clamped = Math.max(-1, Math.min(1, sample));
  return clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff);
}

/**
 * Resamples `input` starting at fractional read `position`, averaging every output window
 * (a box filter: cheap anti-aliasing, good enough for speech). Calls `emit` per output sample
 * and returns the read position of the next output sample that did not fit in `input`.
 */
function resample(
  input: Float32Array,
  ratio: number,
  position: number,
  emit: (sample: number) => void,
): number {
  let pos = position;
  while (true) {
    const start = Math.floor(pos);
    const end = Math.max(start + 1, Math.floor(pos + ratio));
    if (end > input.length) return pos;
    let sum = 0;
    for (let i = start; i < end; i += 1) sum += input[i] ?? 0;
    emit(sum / (end - start));
    pos += ratio;
  }
}

/** Stateless downsample of a whole buffer to `outputRate` Int16 (mono in, mono out). */
export function downsampleToInt16(
  input: Float32Array,
  inputRate: number,
  outputRate: number = TARGET_SAMPLE_RATE,
): Int16Array {
  const out: number[] = [];
  resample(input, inputRate / outputRate, 0, (sample) => out.push(floatToInt16(sample)));
  return Int16Array.from(out);
}

/** Root mean square of an Int16 frame, normalised to [0, 1]. */
export function rmsInt16(frame: Int16Array): number {
  if (frame.length === 0) return 0;
  let sum = 0;
  for (const sample of frame) {
    const normalised = sample / 0x8000;
    sum += normalised * normalised;
  }
  return Math.sqrt(sum / frame.length);
}

const METER_FLOOR_DB = -60;

/** Maps an RMS in [0, 1] to a VU meter position in [0, 1] on a -60..0 dBFS scale. */
export function meterLevel(rms: number): number {
  if (rms <= 0) return 0;
  const db = 20 * Math.log10(rms);
  return Math.max(0, Math.min(1, (db - METER_FLOOR_DB) / -METER_FLOOR_DB));
}

export interface PcmFrame {
  /** Exactly `FRAME_SAMPLES` Int16 samples; `pcm.buffer` is owned by this frame only. */
  pcm: Int16Array<ArrayBuffer>;
  /** Normalised RMS of the frame, [0, 1]. */
  rms: number;
}

/**
 * Streaming encoder: push Float32 mono blocks of any size at `inputSampleRate`, get complete
 * 100 ms Int16 16 kHz frames back. Carries the fractional read position across pushes so block
 * boundaries do not introduce drift or clicks.
 */
export class PcmEncoder {
  private readonly ratio: number;
  private pending: Float32Array = new Float32Array(0);
  private position = 0;
  private frame: Int16Array<ArrayBuffer>;
  private frameLength = 0;

  constructor(
    inputSampleRate: number,
    private readonly frameSamples: number = FRAME_SAMPLES,
    outputSampleRate: number = TARGET_SAMPLE_RATE,
  ) {
    if (!(inputSampleRate > 0) || !(outputSampleRate > 0)) {
      throw new Error('Sample rates must be positive');
    }
    this.ratio = inputSampleRate / outputSampleRate;
    this.frame = new Int16Array(frameSamples);
  }

  push(block: Float32Array): PcmFrame[] {
    const input = new Float32Array(this.pending.length + block.length);
    input.set(this.pending, 0);
    input.set(block, this.pending.length);

    const frames: PcmFrame[] = [];
    const next = resample(input, this.ratio, this.position, (sample) => {
      this.frame[this.frameLength] = floatToInt16(sample);
      this.frameLength += 1;
      if (this.frameLength === this.frameSamples) {
        frames.push({ pcm: this.frame, rms: rmsInt16(this.frame) });
        this.frame = new Int16Array(this.frameSamples);
        this.frameLength = 0;
      }
    });

    const consumed = Math.min(Math.floor(next), input.length);
    this.pending = input.slice(consumed);
    this.position = next - consumed;
    return frames;
  }
}
