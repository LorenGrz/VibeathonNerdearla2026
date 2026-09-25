/**
 * AudioWorklet for /admin/mic/[id]: mixes the input to mono and posts Float32 blocks of
 * BLOCK_SAMPLES to the main thread (transferring the buffer). Resampling to 16 kHz Int16 and
 * 100 ms framing happen in `src/features/mic/pcm.ts` (PcmEncoder), which is unit-tested.
 * Plain JS on purpose: worklet modules are loaded by URL and are not bundled.
 */
const BLOCK_SAMPLES = 2048; // ~43 ms at 48 kHz

class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.block = new Float32Array(BLOCK_SAMPLES);
    this.length = 0;
  }

  process(inputs) {
    const channels = inputs[0];
    if (channels && channels.length > 0) {
      const frames = channels[0].length;
      for (let i = 0; i < frames; i += 1) {
        let sum = 0;
        for (let c = 0; c < channels.length; c += 1) sum += channels[c][i];
        this.block[this.length] = sum / channels.length;
        this.length += 1;
        if (this.length === BLOCK_SAMPLES) this.flush();
      }
    }
    return true; // keep the processor alive while the mic is open
  }

  flush() {
    this.port.postMessage(this.block, [this.block.buffer]);
    this.block = new Float32Array(BLOCK_SAMPLES);
    this.length = 0;
  }
}

registerProcessor('pcm-capture', PcmCaptureProcessor);
