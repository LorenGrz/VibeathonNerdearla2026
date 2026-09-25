'use client';

import type { LanguageCodeValue } from '@subs/domain';
import { buttonClassName } from '@/components/Button';
import { languageLabel } from '@/lib/api';

export interface LanguageSelectorProps {
  languages: LanguageCodeValue[];
  active: LanguageCodeValue;
  onChange: (language: LanguageCodeValue) => void;
}

export function LanguageSelector({ languages, active, onChange }: LanguageSelectorProps) {
  return (
    <div role="group" aria-label="Seleccionar idioma" className="flex flex-wrap gap-2">
      {languages.map((language) => (
        <button
          key={language}
          type="button"
          aria-pressed={language === active}
          onClick={() => onChange(language)}
          className={buttonClassName(language === active ? 'primary' : 'secondary', {
            active: language === active,
          })}
        >
          {languageLabel(language)}
        </button>
      ))}
    </div>
  );
}
