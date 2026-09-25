import { describe, expect, it } from 'vitest';
import { InvalidArgumentError } from '../shared/errors.js';
import { sequentialIdGenerator } from '../shared/id-generator.js';
import { SessionId } from './session-id.js';

describe('SessionId', () => {
  it('creates from a generator and compares by value', () => {
    const id = SessionId.create(sequentialIdGenerator('x'));
    expect(id.value).toBe('x-1');
    expect(id.equals(SessionId.of('x-1'))).toBe(true);
    expect(id.equals(SessionId.of('x-2'))).toBe(false);
  });

  it('rejects empty ids', () => {
    expect(() => SessionId.of(' ')).toThrow(InvalidArgumentError);
  });
});
