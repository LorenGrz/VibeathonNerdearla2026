import { GeminiTranslator } from './gemini-translator.js';
import { MockTranslator } from './mock-translator.js';
import { createTranslator } from './translation.module.js';

describe('createTranslator', () => {
  it('returns a MockTranslator when TRANSLATOR=mock', () => {
    const translator = createTranslator({
      translator: 'mock',
      geminiApiKey: undefined,
      geminiTextModel: 'gemini-2.5-flash',
    });

    expect(translator).toBeInstanceOf(MockTranslator);
  });

  it('returns a GeminiTranslator when TRANSLATOR=gemini and an API key is set', () => {
    const translator = createTranslator({
      translator: 'gemini',
      geminiApiKey: 'test-key',
      geminiTextModel: 'gemini-2.5-flash',
    });

    expect(translator).toBeInstanceOf(GeminiTranslator);
  });

  it('throws when TRANSLATOR=gemini without a GEMINI_API_KEY', () => {
    expect(() =>
      createTranslator({
        translator: 'gemini',
        geminiApiKey: undefined,
        geminiTextModel: 'gemini-2.5-flash',
      }),
    ).toThrow(/GEMINI_API_KEY/);
  });
});
