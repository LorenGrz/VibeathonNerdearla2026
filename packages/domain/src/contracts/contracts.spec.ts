import { describe, expect, it } from 'vitest';
import * as contracts from './index.js';
import { AUDIO_FORMAT } from '../ports/index.js';

describe('contracts', () => {
  it('exposes the WS constants and room naming', () => {
    expect(contracts.WS_NAMESPACE_CAPTIONS).toBe('/captions');
    expect(contracts.WS_NAMESPACE_ADMIN).toBe('/admin');
    expect(contracts.WS_NAMESPACE_MIC).toBe('/mic');
    expect(contracts.captionRoom('abc', 'es')).toBe('session:abc:es');
    expect(contracts.SUPPORTED_LANGUAGES).toEqual(['en', 'es', 'pt']);
    expect(AUDIO_FORMAT).toEqual({ sampleRate: 16000, channels: 1, encoding: 's16le' });
  });

  it('contains no classes (browser-safe)', () => {
    for (const value of Object.values(contracts)) {
      if (typeof value === 'function') {
        expect(value.toString().startsWith('class')).toBe(false);
      }
    }
  });
});
