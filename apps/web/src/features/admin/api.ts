import type { CreateSessionDto, ExportFormat, LanguageCodeValue, SessionDto } from '@subs/domain';

/** Base URL of the LiveSubs API (REST + Socket.IO). Not reachable while the panel is built. */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

interface ApiErrorBody {
  message?: string | string[];
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === 'object' && value !== null;
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (isApiErrorBody(body)) {
      if (Array.isArray(body.message)) return body.message.join(', ');
      if (typeof body.message === 'string') return body.message;
    }
  } catch {
    // response body was not JSON; fall back to the status text below
  }
  return response.statusText || `Error ${response.status}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  if (!response.ok) {
    throw new AdminApiError(await parseErrorMessage(response), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const fetchSessions = (): Promise<SessionDto[]> => request<SessionDto[]>('/sessions');

export const fetchSamples = (): Promise<string[]> => request<string[]>('/samples');

export const createSession = (dto: CreateSessionDto): Promise<SessionDto> =>
  request<SessionDto>('/sessions', { method: 'POST', body: JSON.stringify(dto) });

export const startSession = (id: string): Promise<SessionDto> =>
  request<SessionDto>(`/sessions/${id}/start`, { method: 'POST' });

export const stopSession = (id: string): Promise<SessionDto> =>
  request<SessionDto>(`/sessions/${id}/stop`, { method: 'POST' });

export const deleteSession = (id: string): Promise<void> =>
  request<void>(`/sessions/${id}`, { method: 'DELETE' });

export const exportUrl = (
  sessionId: string,
  lang: LanguageCodeValue,
  format: ExportFormat,
): string => `${API_BASE_URL}/api/sessions/${sessionId}/export?lang=${lang}&format=${format}`;
