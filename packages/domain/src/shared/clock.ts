export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** Clock that always returns the same instant (or a mutable one via `set`). Useful in tests. */
export const fixedClock = (initial: Date | string | number): Clock & { set(d: Date): void } => {
  let current = new Date(initial);
  return {
    now: () => new Date(current.getTime()),
    set: (d: Date) => {
      current = new Date(d.getTime());
    },
  };
};
