'use client';

import { useCallback, useSyncExternalStore } from 'react';

export const FONT_SIZES = ['sm', 'md', 'lg', 'xl'] as const;
export type FontSize = (typeof FONT_SIZES)[number];

export interface CaptionPreferences {
  fontSize: FontSize;
  highContrast: boolean;
}

const DEFAULT_PREFERENCES: CaptionPreferences = { fontSize: 'md', highContrast: false };
const STORAGE_KEY = 'livesubs:captions:preferences';

function isFontSize(value: unknown): value is FontSize {
  return typeof value === 'string' && (FONT_SIZES as readonly string[]).includes(value);
}

function parsePreferences(raw: string | null): CaptionPreferences {
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_PREFERENCES;
    const candidate = parsed as Record<string, unknown>;
    return {
      fontSize: isFontSize(candidate.fontSize) ? candidate.fontSize : DEFAULT_PREFERENCES.fontSize,
      highContrast:
        typeof candidate.highContrast === 'boolean'
          ? candidate.highContrast
          : DEFAULT_PREFERENCES.highContrast,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

type Listener = () => void;

/**
 * Module-level store synced with `localStorage`, read through `useSyncExternalStore`.
 * This avoids hydrating preferences via `useState` + `useEffect` (server and first client
 * render both use `getServerSnapshot`, then React reconciles with the persisted value).
 */
function createPreferencesStore() {
  let value: CaptionPreferences | null = null;
  const listeners = new Set<Listener>();

  const getSnapshot = (): CaptionPreferences => {
    value ??= parsePreferences(window.localStorage.getItem(STORAGE_KEY));
    return value;
  };

  const getServerSnapshot = (): CaptionPreferences => DEFAULT_PREFERENCES;

  const subscribe = (listener: Listener): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const update = (updater: (prev: CaptionPreferences) => CaptionPreferences): void => {
    const next = updater(value ?? DEFAULT_PREFERENCES);
    value = next;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    listeners.forEach((listener) => listener());
  };

  return { getSnapshot, getServerSnapshot, subscribe, update };
}

const preferencesStore = createPreferencesStore();

export interface UseCaptionPreferencesResult {
  preferences: CaptionPreferences;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  toggleHighContrast: () => void;
}

export function useCaptionPreferences(): UseCaptionPreferencesResult {
  const preferences = useSyncExternalStore(
    preferencesStore.subscribe,
    preferencesStore.getSnapshot,
    preferencesStore.getServerSnapshot,
  );

  const increaseFontSize = useCallback(() => {
    preferencesStore.update((prev) => {
      const index = FONT_SIZES.indexOf(prev.fontSize);
      const next = FONT_SIZES[Math.min(index + 1, FONT_SIZES.length - 1)] ?? prev.fontSize;
      return { ...prev, fontSize: next };
    });
  }, []);

  const decreaseFontSize = useCallback(() => {
    preferencesStore.update((prev) => {
      const index = FONT_SIZES.indexOf(prev.fontSize);
      const next = FONT_SIZES[Math.max(index - 1, 0)] ?? prev.fontSize;
      return { ...prev, fontSize: next };
    });
  }, []);

  const toggleHighContrast = useCallback(() => {
    preferencesStore.update((prev) => ({ ...prev, highContrast: !prev.highContrast }));
  }, []);

  return { preferences, increaseFontSize, decreaseFontSize, toggleHighContrast };
}
