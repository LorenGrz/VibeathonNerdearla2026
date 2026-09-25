export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: string = 'DOMAIN_ERROR',
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidLanguageError extends DomainError {
  constructor(value: string) {
    super(`Unsupported language "${value}"`, 'INVALID_LANGUAGE');
  }
}

export class InvalidSessionTransitionError extends DomainError {
  constructor(
    readonly from: string,
    readonly action: string,
  ) {
    super(`Cannot ${action} a session in status "${from}"`, 'INVALID_SESSION_TRANSITION');
  }
}

export class InvalidArgumentError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_ARGUMENT');
  }
}
