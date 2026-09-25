import { isSupportedLanguage } from '@subs/domain';
import type { LanguageCodeValue } from '@subs/domain';
import { OverlayClient } from '@/features/captions/OverlayClient';

const DEFAULT_LANGUAGE: LanguageCodeValue = 'es';
const DEFAULT_LINES = 2;
const MAX_LINES = 6;

function parseLanguage(value: string | string[] | undefined): LanguageCodeValue {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && isSupportedLanguage(candidate) ? candidate : DEFAULT_LANGUAGE;
}

function parseLines(value: string | string[] | undefined): number {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = candidate ? Number.parseInt(candidate, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, MAX_LINES) : DEFAULT_LINES;
}

export default async function OverlayPage(props: PageProps<'/overlay/[id]'>) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;

  const language = parseLanguage(searchParams.lang);
  const lines = parseLines(searchParams.lines);

  return <OverlayClient sessionId={id} language={language} lines={lines} />;
}
