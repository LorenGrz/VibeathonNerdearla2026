import { concatBytes, pcmToWav, toBase64 } from './wav.js';

describe('wav', () => {
  it('writes a 16 kHz mono 16-bit PCM RIFF header', () => {
    const pcm = new Uint8Array([1, 2, 3, 4]);
    const wav = pcmToWav(pcm);
    const view = new DataView(wav.buffer);
    const ascii = (from: number) => Buffer.from(wav.subarray(from, from + 4)).toString('ascii');

    expect(wav.byteLength).toBe(48);
    expect([ascii(0), ascii(8), ascii(12), ascii(36)]).toEqual(['RIFF', 'WAVE', 'fmt ', 'data']);
    expect(view.getUint32(4, true)).toBe(40);
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint32(28, true)).toBe(32000); // byte rate
    expect(view.getUint16(32, true)).toBe(2); // block align
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(4);
    expect([...wav.subarray(44)]).toEqual([1, 2, 3, 4]);
  });

  it('concatenates chunks and encodes views (not the whole backing buffer) as base64', () => {
    const joined = concatBytes([new Uint8Array([1, 2]), new Uint8Array([3])]);
    expect([...joined]).toEqual([1, 2, 3]);

    const backing = new Uint8Array([9, 9, 1, 2, 9]);
    expect(toBase64(backing.subarray(2, 4))).toBe(Buffer.from([1, 2]).toString('base64'));
  });
});
