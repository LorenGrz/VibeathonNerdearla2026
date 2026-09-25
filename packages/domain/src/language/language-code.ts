import { isSupportedLanguage, type LanguageCodeValue } from '../contracts/languages.js';
import { InvalidLanguageError } from '../shared/errors.js';

export { SUPPORTED_LANGUAGES, type LanguageCodeValue } from '../contracts/languages.js';

export class LanguageCode {
  private constructor(readonly value: LanguageCodeValue) {
    Object.freeze(this);
  }

  /** Accepts case/whitespace variations ("ES", " es "). Throws InvalidLanguageError otherwise. */
  static of(value: string): LanguageCode {
    const normalized = value.trim().toLowerCase();
    if (!isSupportedLanguage(normalized)) throw new InvalidLanguageError(value);
    return new LanguageCode(normalized);
  }

  static isSupported(value: string): value is LanguageCodeValue {
    return isSupportedLanguage(value);
  }

  equals(other: LanguageCode): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
