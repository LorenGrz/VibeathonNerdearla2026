const pad = (value: number, size = 2): string =>
  Math.max(0, Math.floor(value)).toString().padStart(size, '0');

const parts = (ms: number): { hours: number; minutes: number; seconds: number; millis: number } => {
  const clamped = Math.max(0, ms);
  const hours = Math.floor(clamped / 3_600_000);
  const minutes = Math.floor((clamped % 3_600_000) / 60_000);
  const seconds = Math.floor((clamped % 60_000) / 1000);
  const millis = Math.floor(clamped % 1000);
  return { hours, minutes, seconds, millis };
};

/** `HH:MM:SS,mmm` as used by SRT. */
export const toSrtTimestamp = (ms: number): string => {
  const { hours, minutes, seconds, millis } = parts(ms);
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(millis, 3)}`;
};

/** `HH:MM:SS.mmm` as used by WebVTT. */
export const toVttTimestamp = (ms: number): string => {
  const { hours, minutes, seconds, millis } = parts(ms);
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(millis, 3)}`;
};
