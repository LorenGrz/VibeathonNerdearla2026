import { validateEnv } from './env.js';

describe('validateEnv', () => {
  it('defaults to mock mode without a Gemini key', () => {
    const env = validateEnv({});
    expect(env.TRANSCRIBER).toBe('mock');
    expect(env.PORT).toBe(4000);
  });

  it('requires a Gemini key for live transcription', () => {
    expect(() => validateEnv({ TRANSCRIBER: 'live' })).toThrow(/GEMINI_API_KEY/);
  });
});
