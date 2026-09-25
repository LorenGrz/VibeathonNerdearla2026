import { InvalidArgumentError } from '../shared/errors.js';
import { randomIdGenerator, type IdGenerator } from '../shared/id-generator.js';

export class SessionId {
  private constructor(readonly value: string) {
    Object.freeze(this);
  }

  static create(ids: IdGenerator = randomIdGenerator): SessionId {
    return SessionId.of(ids.next());
  }

  static of(value: string): SessionId {
    const trimmed = value.trim();
    if (!trimmed) throw new InvalidArgumentError('SessionId cannot be empty');
    return new SessionId(trimmed);
  }

  equals(other: SessionId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
