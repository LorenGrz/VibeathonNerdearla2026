export interface IdGenerator {
  next(): string;
}

interface CryptoLike {
  randomUUID(): string;
}

export const randomIdGenerator: IdGenerator = {
  next: () => {
    const crypto = (globalThis as { crypto?: CryptoLike }).crypto;
    if (!crypto?.randomUUID) {
      throw new Error('globalThis.crypto.randomUUID is not available in this runtime');
    }
    return crypto.randomUUID();
  },
};

/** Deterministic generator: `${prefix}-1`, `${prefix}-2`, ... Useful in tests. */
export const sequentialIdGenerator = (prefix = 'id'): IdGenerator => {
  let n = 0;
  return { next: () => `${prefix}-${++n}` };
};
