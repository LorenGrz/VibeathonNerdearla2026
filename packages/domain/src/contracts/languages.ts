export const SUPPORTED_LANGUAGES = ['en', 'es', 'pt'] as const;
export type LanguageCodeValue = (typeof SUPPORTED_LANGUAGES)[number];

export const isSupportedLanguage = (value: string): value is LanguageCodeValue =>
  (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
