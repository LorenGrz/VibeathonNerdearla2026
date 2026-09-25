import { describe, expect, it } from 'vitest';
import { DOMAIN_VERSION } from './index.js';

describe('domain package', () => {
  it('exposes its version', () => {
    expect(DOMAIN_VERSION).toBe('0.1.0');
  });
});
