import type { GlossaryTermDto, LanguageCodeValue } from '../contracts/index.js';
import type { LanguageCode } from '../language/language-code.js';

export class GlossaryTerm {
  constructor(
    readonly source: string,
    readonly translations: Partial<Record<LanguageCodeValue, string>>,
    readonly note?: string,
  ) {
    this.translations = Object.freeze({ ...translations });
    Object.freeze(this);
  }

  translationFor(target: LanguageCode): string | undefined {
    return this.translations[target.value];
  }

  equals(other: GlossaryTerm): boolean {
    const keys = new Set([...Object.keys(this.translations), ...Object.keys(other.translations)]);
    return (
      this.source === other.source &&
      this.note === other.note &&
      [...keys].every(
        (k) =>
          this.translations[k as LanguageCodeValue] === other.translations[k as LanguageCodeValue],
      )
    );
  }
}

export class Glossary {
  private readonly _terms: readonly GlossaryTerm[];

  constructor(terms: GlossaryTerm[]) {
    this._terms = Object.freeze([...terms]);
  }

  static empty(): Glossary {
    return new Glossary([]);
  }

  static fromDto(terms: readonly GlossaryTermDto[] = []): Glossary {
    return new Glossary(terms.map((t) => new GlossaryTerm(t.source, t.translations)));
  }

  terms(): readonly GlossaryTerm[] {
    return this._terms;
  }

  /**
   * Prompt block for an LLM translating into `target`. Terms without a translation for
   * `target` are listed as "keep as-is". Returns '' for an empty glossary.
   */
  toPromptSection(target: LanguageCode): string {
    if (this._terms.length === 0) return '';
    const lines = this._terms.map((term) => {
      const translation = term.translationFor(target);
      const rendered =
        translation === undefined
          ? `"${term.source}" (keep as-is)`
          : `"${term.source}" -> "${translation}"`;
      return term.note ? `- ${rendered} — ${term.note}` : `- ${rendered}`;
    });
    return [`Glossary (${target.value}). Use these exact renderings:`, ...lines].join('\n');
  }
}
