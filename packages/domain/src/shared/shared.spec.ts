import { describe, expect, it } from 'vitest';
import { err, ok } from './result.js';
import { fixedClock } from './clock.js';
import { randomIdGenerator, sequentialIdGenerator } from './id-generator.js';
import { DomainError, InvalidSessionTransitionError } from './errors.js';

describe('shared', () => {
  it('Result helpers', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
    expect(err('x')).toEqual({ ok: false, error: 'x' });
  });

  it('fixedClock returns defensive copies', () => {
    const clock = fixedClock(0);
    clock.now().setTime(999);
    expect(clock.now().getTime()).toBe(0);
  });

  it('id generators', () => {
    const seq = sequentialIdGenerator('a');
    expect([seq.next(), seq.next()]).toEqual(['a-1', 'a-2']);
    expect(randomIdGenerator.next()).not.toBe(randomIdGenerator.next());
  });

  it('errors carry name and code', () => {
    const e = new InvalidSessionTransitionError('idle', 'stop');
    expect(e).toBeInstanceOf(DomainError);
    expect(e.name).toBe('InvalidSessionTransitionError');
    expect(e.code).toBe('INVALID_SESSION_TRANSITION');
    expect(e.message).toBe('Cannot stop a session in status "idle"');
  });
});
