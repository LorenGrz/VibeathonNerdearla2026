export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Resolves after `ms` or as soon as `signal` aborts, whichever comes first. Never rejects. */
export const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const done = (): void => {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done, { once: true });
  });

/** Waits for `promise` at most `ms`. Returns false on timeout. Never rejects. */
export const settleWithin = async (promise: Promise<unknown>, ms: number): Promise<boolean> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), ms);
  });
  try {
    return await Promise.race([promise.then(() => true).catch(() => true), timeout]);
  } finally {
    clearTimeout(timer);
  }
};
