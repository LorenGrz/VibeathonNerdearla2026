'use client';

import { useState, type FormEvent } from 'react';
import {
  SUPPORTED_LANGUAGES,
  type AudioSourceSpec,
  type CreateSessionDto,
  type LanguageCodeValue,
} from '@subs/domain';
import { parseGlossary, toGlossaryDto } from '../glossary';
import {
  validateSessionForm,
  type SessionFormErrors,
  type SessionFormValues,
  type SourceKind,
} from '../validation';

const LANGUAGE_LABEL: Record<LanguageCodeValue, string> = {
  en: 'Inglés',
  es: 'Español',
  pt: 'Portugués',
};

const SOURCE_KIND_LABEL: Record<SourceKind, string> = {
  file: 'Archivo',
  url: 'URL',
  mic: 'Micrófono',
};

const EMPTY_VALUES: SessionFormValues = {
  title: '',
  stage: '',
  sourceLanguage: '',
  targetLanguages: [],
  sourceKind: 'file',
  sourceFile: '',
  sourceUrl: '',
};

interface NewSessionFormProps {
  samples: string[];
  samplesError: string | null;
  onCreate: (dto: CreateSessionDto) => Promise<void>;
}

export function NewSessionForm({ samples, samplesError, onCreate }: NewSessionFormProps) {
  const [values, setValues] = useState<SessionFormValues>(EMPTY_VALUES);
  const [glossaryText, setGlossaryText] = useState('');
  const [errors, setErrors] = useState<SessionFormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const toggleTargetLanguage = (lang: LanguageCodeValue) => {
    setValues((prev) => ({
      ...prev,
      targetLanguages: prev.targetLanguages.includes(lang)
        ? prev.targetLanguages.filter((value) => value !== lang)
        : [...prev.targetLanguages, lang],
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const fieldErrors = validateSessionForm(values);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0 || values.sourceLanguage === '') {
      return;
    }

    const source: AudioSourceSpec =
      values.sourceKind === 'file'
        ? { kind: 'file', path: values.sourceFile }
        : values.sourceKind === 'url'
          ? { kind: 'url', url: values.sourceUrl }
          : { kind: 'mic' };

    const glossaryLines = parseGlossary(glossaryText);

    const dto: CreateSessionDto = {
      title: values.title.trim(),
      stage: values.stage.trim(),
      sourceLanguage: values.sourceLanguage,
      targetLanguages: values.targetLanguages,
      source,
      glossary:
        glossaryLines.length > 0 ? toGlossaryDto(glossaryLines, values.targetLanguages) : undefined,
    };

    setSubmitting(true);
    try {
      await onCreate(dto);
      setValues(EMPTY_VALUES);
      setGlossaryText('');
    } catch {
      // el error de la API se muestra en el panel superior del dashboard
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-cta border border-line bg-surface-2 p-6"
    >
      <h2 className="font-display text-xl uppercase">Nueva sesión</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Título
          <input
            type="text"
            value={values.title}
            onChange={(event) => setValues((prev) => ({ ...prev, title: event.target.value }))}
            className="rounded-btn border border-line-strong bg-surface px-3 py-2"
          />
          {errors.title ? <span className="text-xs text-brand-soft">{errors.title}</span> : null}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Escenario
          <input
            type="text"
            value={values.stage}
            onChange={(event) => setValues((prev) => ({ ...prev, stage: event.target.value }))}
            className="rounded-btn border border-line-strong bg-surface px-3 py-2"
          />
          {errors.stage ? <span className="text-xs text-brand-soft">{errors.stage}</span> : null}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Idioma original
          <select
            value={values.sourceLanguage}
            onChange={(event) =>
              setValues((prev) => ({
                ...prev,
                sourceLanguage: event.target.value as LanguageCodeValue | '',
              }))
            }
            className="rounded-btn border border-line-strong bg-surface px-3 py-2"
          >
            <option value="">Elegir…</option>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {LANGUAGE_LABEL[lang]}
              </option>
            ))}
          </select>
          {errors.sourceLanguage ? (
            <span className="text-xs text-brand-soft">{errors.sourceLanguage}</span>
          ) : null}
        </label>

        <fieldset className="flex flex-col gap-1 text-sm">
          <legend>Idiomas destino</legend>
          <div className="flex flex-wrap gap-3">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <label key={lang} className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={values.targetLanguages.includes(lang)}
                  onChange={() => toggleTargetLanguage(lang)}
                />
                {LANGUAGE_LABEL[lang]}
              </label>
            ))}
          </div>
          {errors.targetLanguages ? (
            <span className="text-xs text-brand-soft">{errors.targetLanguages}</span>
          ) : null}
        </fieldset>

        <fieldset className="flex flex-col gap-2 text-sm sm:col-span-2">
          <legend>Fuente de audio</legend>
          <div className="flex gap-3 text-xs">
            {(Object.keys(SOURCE_KIND_LABEL) as SourceKind[]).map((kind) => (
              <label key={kind} className="flex items-center gap-1">
                <input
                  type="radio"
                  name="sourceKind"
                  checked={values.sourceKind === kind}
                  onChange={() => setValues((prev) => ({ ...prev, sourceKind: kind }))}
                />
                {SOURCE_KIND_LABEL[kind]}
              </label>
            ))}
          </div>

          {values.sourceKind === 'file' ? (
            <div className="flex flex-col gap-1">
              <select
                value={values.sourceFile}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, sourceFile: event.target.value }))
                }
                className="rounded-btn border border-line-strong bg-surface px-3 py-2"
              >
                <option value="">Elegir sample…</option>
                {samples.map((sample) => (
                  <option key={sample} value={sample}>
                    {sample}
                  </option>
                ))}
              </select>
              {samplesError ? (
                <span className="text-xs text-brand-soft">{samplesError}</span>
              ) : null}
              {errors.sourceFile ? (
                <span className="text-xs text-brand-soft">{errors.sourceFile}</span>
              ) : null}
            </div>
          ) : null}

          {values.sourceKind === 'url' ? (
            <div className="flex flex-col gap-1">
              <input
                type="text"
                placeholder="https://…"
                value={values.sourceUrl}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, sourceUrl: event.target.value }))
                }
                className="rounded-btn border border-line-strong bg-surface px-3 py-2"
              />
              {errors.sourceUrl ? (
                <span className="text-xs text-brand-soft">{errors.sourceUrl}</span>
              ) : null}
            </div>
          ) : null}
        </fieldset>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span>
            Glosario (opcional, una línea por término: <code>término = traducción</code>)
          </span>
          <textarea
            rows={4}
            value={glossaryText}
            onChange={(event) => setGlossaryText(event.target.value)}
            className="rounded-btn border border-line-strong bg-surface px-3 py-2 font-mono text-xs"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-cta bg-brand px-5 py-2 font-display font-semibold text-white disabled:opacity-50"
      >
        {submitting ? 'Creando…' : 'Crear sesión'}
      </button>
    </form>
  );
}
