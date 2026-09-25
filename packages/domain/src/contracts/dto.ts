import type { LanguageCodeValue } from './languages.js';

export type SessionStatus = 'idle' | 'starting' | 'live' | 'stopped' | 'error';

export type SegmentKind = 'original' | 'translation';

export type AudioSourceSpec =
  | { kind: 'file'; path: string } // relative to samples/ or absolute
  | { kind: 'url'; url: string } // HLS/RTMP/Icecast/YouTube (yt-dlp)
  | { kind: 'mic' }; // PCM over WS from the browser

export interface SessionMetricsDto {
  chunksIn: number;
  bytesIn: number;
  latencyP50Ms: number | null;
  latencyP95Ms: number | null;
  errors: number;
  lastError: string | null;
  lastActivityAt: string | null;
}

export interface SessionDto {
  id: string;
  title: string;
  stage: string;
  sourceLanguage: LanguageCodeValue;
  targetLanguages: LanguageCodeValue[];
  source: AudioSourceSpec;
  status: SessionStatus;
  metrics: SessionMetricsDto;
}

export interface CaptionDto {
  id: string;
  sessionId: string;
  language: LanguageCodeValue;
  text: string;
  startMs: number;
  endMs: number;
  isFinal: boolean;
  kind: SegmentKind;
  sourceSegmentId?: string;
}

export interface GlossaryTermDto {
  source: string;
  translations: Partial<Record<LanguageCodeValue, string>>;
}

export interface CreateSessionDto {
  title: string;
  stage: string;
  sourceLanguage: LanguageCodeValue;
  targetLanguages: LanguageCodeValue[];
  source: AudioSourceSpec;
  glossary?: GlossaryTermDto[];
}

export type ExportFormat = 'srt' | 'vtt' | 'txt';
