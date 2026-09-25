import { createSessionSchema } from './create-session.dto.js';

describe('createSessionSchema', () => {
  it('accepts a minimal valid payload and defaults targetLanguages', () => {
    const result = createSessionSchema.parse({
      title: 'Keynote',
      stage: 'Main',
      sourceLanguage: 'en',
      source: { kind: 'mic' },
    });
    expect(result.targetLanguages).toEqual([]);
  });

  it('rejects an empty title', () => {
    expect(() =>
      createSessionSchema.parse({
        title: '',
        stage: 'Main',
        sourceLanguage: 'en',
        source: { kind: 'mic' },
      }),
    ).toThrow();
  });

  it('rejects an audio source with an unknown kind', () => {
    expect(() =>
      createSessionSchema.parse({
        title: 'Keynote',
        stage: 'Main',
        sourceLanguage: 'en',
        source: { kind: 'rtmp' },
      }),
    ).toThrow();
  });

  it('accepts a file source and a glossary', () => {
    const result = createSessionSchema.parse({
      title: 'Keynote',
      stage: 'Main',
      sourceLanguage: 'en',
      targetLanguages: ['es'],
      source: { kind: 'file', path: 'samples/demo.mp3' },
      glossary: [{ source: 'Nerdearla', translations: { es: 'Nerdearla' } }],
    });
    expect(result.source).toEqual({ kind: 'file', path: 'samples/demo.mp3' });
    expect(result.glossary).toEqual([{ source: 'Nerdearla', translations: { es: 'Nerdearla' } }]);
  });
});
