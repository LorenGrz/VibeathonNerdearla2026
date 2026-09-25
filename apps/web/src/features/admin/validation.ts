import type { LanguageCodeValue } from '@subs/domain';

export type SourceKind = 'file' | 'url' | 'mic';

export interface SessionFormValues {
  title: string;
  stage: string;
  sourceLanguage: LanguageCodeValue | '';
  targetLanguages: LanguageCodeValue[];
  sourceKind: SourceKind;
  sourceFile: string;
  sourceUrl: string;
}

export type SessionFormErrors = Partial<Record<keyof SessionFormValues, string>>;

export function validateSessionForm(values: SessionFormValues): SessionFormErrors {
  const errors: SessionFormErrors = {};

  if (!values.title.trim()) {
    errors.title = 'El título es obligatorio.';
  }

  if (!values.stage.trim()) {
    errors.stage = 'El escenario es obligatorio.';
  }

  if (!values.sourceLanguage) {
    errors.sourceLanguage = 'Elegí el idioma original.';
  }

  if (values.targetLanguages.length === 0) {
    errors.targetLanguages = 'Elegí al menos un idioma destino.';
  } else if (values.sourceLanguage && values.targetLanguages.includes(values.sourceLanguage)) {
    errors.targetLanguages = 'El idioma destino no puede repetir el idioma original.';
  }

  if (values.sourceKind === 'file' && !values.sourceFile.trim()) {
    errors.sourceFile = 'Elegí un archivo de muestra.';
  }

  if (values.sourceKind === 'url' && !values.sourceUrl.trim()) {
    errors.sourceUrl = 'Ingresá una URL válida.';
  }

  return errors;
}
