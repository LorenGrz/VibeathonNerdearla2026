import { describe, expect, it } from 'vitest';
import { validateSessionForm, type SessionFormValues } from './validation';

const baseValues: SessionFormValues = {
  title: 'Keynote',
  stage: 'Main',
  sourceLanguage: 'en',
  targetLanguages: ['es'],
  sourceKind: 'file',
  sourceFile: 'en-nerdearla.mp3',
  sourceUrl: '',
};

describe('validateSessionForm', () => {
  it('accepts a fully filled form', () => {
    expect(validateSessionForm(baseValues)).toEqual({});
  });

  it('requires title and stage', () => {
    const errors = validateSessionForm({ ...baseValues, title: '  ', stage: '' });
    expect(errors.title).toBeDefined();
    expect(errors.stage).toBeDefined();
  });

  it('requires a source language', () => {
    const errors = validateSessionForm({ ...baseValues, sourceLanguage: '' });
    expect(errors.sourceLanguage).toBeDefined();
  });

  it('requires at least one target language', () => {
    const errors = validateSessionForm({ ...baseValues, targetLanguages: [] });
    expect(errors.targetLanguages).toBeDefined();
  });

  it('rejects a target language equal to the source language', () => {
    const errors = validateSessionForm({ ...baseValues, targetLanguages: ['en'] });
    expect(errors.targetLanguages).toBeDefined();
  });

  it('requires a sample file when the source kind is "file"', () => {
    const errors = validateSessionForm({ ...baseValues, sourceFile: '' });
    expect(errors.sourceFile).toBeDefined();
  });

  it('requires a URL when the source kind is "url"', () => {
    const errors = validateSessionForm({ ...baseValues, sourceKind: 'url', sourceUrl: '' });
    expect(errors.sourceUrl).toBeDefined();
  });

  it('does not require a file or URL when the source kind is "mic"', () => {
    const errors = validateSessionForm({
      ...baseValues,
      sourceKind: 'mic',
      sourceFile: '',
      sourceUrl: '',
    });
    expect(errors.sourceFile).toBeUndefined();
    expect(errors.sourceUrl).toBeUndefined();
  });
});
