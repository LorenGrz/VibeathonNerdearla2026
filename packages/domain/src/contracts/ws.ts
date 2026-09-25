import type { CaptionDto, SessionDto } from './dto.js';
import type { LanguageCodeValue } from './languages.js';

export const WS_NAMESPACE_CAPTIONS = '/captions';
export const WS_NAMESPACE_ADMIN = '/admin';
export const WS_NAMESPACE_MIC = '/mic';

export interface CaptionsClientEvents {
  'captions:join': { sessionId: string; language: LanguageCodeValue };
  'captions:leave': { sessionId: string; language: LanguageCodeValue };
}

export interface CaptionsServerEvents {
  caption: CaptionDto;
  'session:status': Pick<SessionDto, 'id' | 'status'>;
  /** Last 20 final captions, sent on join. */
  'captions:history': CaptionDto[];
}

/** Emitted every 1 s. */
export interface AdminServerEvents {
  'sessions:snapshot': SessionDto[];
}

export interface MicClientEvents {
  'mic:start': { sessionId: string };
  'mic:chunk': ArrayBuffer;
  'mic:stop': { sessionId: string };
}

export const captionRoom = (sessionId: string, lang: LanguageCodeValue): string =>
  `session:${sessionId}:${lang}`;
