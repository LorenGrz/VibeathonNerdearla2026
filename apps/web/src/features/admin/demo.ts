import type { AudioSourceSpec, CreateSessionDto, LanguageCodeValue } from '@subs/domain';

const PREFERRED_DEMO_FILES: Record<'en' | 'es', string> = {
  en: 'en-nerdearla.mp3',
  es: 'es-nerdearla.mp3',
};

/** Picks `preferred` if present and unused, otherwise the first unused sample. */
function pickDemoFile(
  preferred: string,
  samples: string[],
  used: ReadonlySet<string>,
): string | null {
  if (samples.includes(preferred) && !used.has(preferred)) return preferred;
  return samples.find((sample) => !used.has(sample)) ?? null;
}

/**
 * Builds the two demo sessions (EN source -> ES target, ES source -> EN target).
 * Falls back to the first available samples when `en-nerdearla.mp3` / `es-nerdearla.mp3` are missing.
 * Returns `null` when fewer than two samples are available.
 */
export function buildDemoSessions(samples: string[]): [CreateSessionDto, CreateSessionDto] | null {
  const used = new Set<string>();

  const enFile = pickDemoFile(PREFERRED_DEMO_FILES.en, samples, used);
  if (!enFile) return null;
  used.add(enFile);

  const esFile = pickDemoFile(PREFERRED_DEMO_FILES.es, samples, used);
  if (!esFile) return null;
  used.add(esFile);

  const fileSource = (path: string): AudioSourceSpec => ({ kind: 'file', path });
  const esTarget: LanguageCodeValue = 'es';
  const enTarget: LanguageCodeValue = 'en';

  return [
    {
      title: 'Demo EN → ES',
      stage: 'Demo',
      sourceLanguage: 'en',
      targetLanguages: [esTarget],
      source: fileSource(enFile),
    },
    {
      title: 'Demo ES → EN',
      stage: 'Demo',
      sourceLanguage: 'es',
      targetLanguages: [enTarget],
      source: fileSource(esFile),
    },
  ];
}
