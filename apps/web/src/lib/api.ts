import { isSupportedLanguage } from '@subs/domain';
import type {
  AudioSourceSpec,
  CaptionDto,
  LanguageCodeValue,
  SegmentKind,
  SessionDto,
  SessionMetricsDto,
  SessionStatus,
} from '@subs/domain';

const DEFAULT_API_BASE_URL = 'http://localhost:4000';

export const getApiBaseUrl = (): string => process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_BASE_URL;

export const LANGUAGE_LABELS: Record<LanguageCodeValue, string> = {
  en: 'Inglés',
  es: 'Español',
  pt: 'Portugués',
};

export const languageLabel = (code: string): string =>
  isSupportedLanguage(code) ? LANGUAGE_LABELS[code] : code.toUpperCase();

export function sessionLanguages(session: SessionDto): LanguageCodeValue[] {
  return Array.from(new Set([session.sourceLanguage, ...session.targetLanguages]));
}

const SESSION_STATUSES: readonly SessionStatus[] = ['idle', 'starting', 'live', 'stopped', 'error'];
const SEGMENT_KINDS: readonly SegmentKind[] = ['original', 'translation'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAudioSourceSpec(value: unknown): value is AudioSourceSpec {
  if (!isRecord(value)) return false;
  if (value.kind === 'file') return typeof value.path === 'string';
  if (value.kind === 'url') return typeof value.url === 'string';
  if (value.kind === 'mic') return true;
  return false;
}

function isSessionMetricsDto(value: unknown): value is SessionMetricsDto {
  if (!isRecord(value)) return false;
  return (
    typeof value.chunksIn === 'number' &&
    typeof value.bytesIn === 'number' &&
    (typeof value.latencyP50Ms === 'number' || value.latencyP50Ms === null) &&
    (typeof value.latencyP95Ms === 'number' || value.latencyP95Ms === null) &&
    typeof value.errors === 'number' &&
    (typeof value.lastError === 'string' || value.lastError === null) &&
    (typeof value.lastActivityAt === 'string' || value.lastActivityAt === null)
  );
}

export function isSessionDto(value: unknown): value is SessionDto {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.stage === 'string' &&
    typeof value.sourceLanguage === 'string' &&
    isSupportedLanguage(value.sourceLanguage) &&
    Array.isArray(value.targetLanguages) &&
    value.targetLanguages.every(
      (lang): lang is LanguageCodeValue => typeof lang === 'string' && isSupportedLanguage(lang),
    ) &&
    isAudioSourceSpec(value.source) &&
    typeof value.status === 'string' &&
    SESSION_STATUSES.includes(value.status as SessionStatus) &&
    isSessionMetricsDto(value.metrics)
  );
}

export function isCaptionDto(value: unknown): value is CaptionDto {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.sessionId === 'string' &&
    typeof value.language === 'string' &&
    isSupportedLanguage(value.language) &&
    typeof value.text === 'string' &&
    typeof value.startMs === 'number' &&
    typeof value.endMs === 'number' &&
    typeof value.isFinal === 'boolean' &&
    typeof value.kind === 'string' &&
    SEGMENT_KINDS.includes(value.kind as SegmentKind) &&
    (value.sourceSegmentId === undefined || typeof value.sourceSegmentId === 'string')
  );
}

export type SessionsResult =
  { status: 'ok'; sessions: SessionDto[] } | { status: 'error'; message: string };

export async function fetchSessions(): Promise<SessionsResult> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/sessions`, { cache: 'no-store' });
    if (!response.ok) {
      return { status: 'error', message: `La API respondió ${response.status}` };
    }
    const data: unknown = await response.json();
    if (!Array.isArray(data)) {
      return { status: 'error', message: 'Respuesta inválida de la API' };
    }
    return { status: 'ok', sessions: data.filter(isSessionDto) };
  } catch {
    return { status: 'error', message: 'No se pudo conectar con la API' };
  }
}

export type SessionResult =
  | { status: 'ok'; session: SessionDto }
  | { status: 'not-found' }
  | { status: 'error'; message: string };

export async function fetchSession(id: string): Promise<SessionResult> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/sessions/${encodeURIComponent(id)}`, {
      cache: 'no-store',
    });
    if (response.status === 404) {
      return { status: 'not-found' };
    }
    if (!response.ok) {
      return { status: 'error', message: `La API respondió ${response.status}` };
    }
    const data: unknown = await response.json();
    if (!isSessionDto(data)) {
      return { status: 'error', message: 'Respuesta inválida de la API' };
    }
    return { status: 'ok', session: data };
  } catch {
    return { status: 'error', message: 'No se pudo conectar con la API' };
  }
}
