import type { ArgumentsHost } from '@nestjs/common';
import {
  InvalidArgumentError,
  InvalidLanguageError,
  InvalidSessionTransitionError,
} from '@subs/domain';
import { DomainExceptionFilter } from './domain-exception.filter.js';

const createHost = () => {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const response = { status };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('DomainExceptionFilter', () => {
  it('maps InvalidSessionTransitionError to 409', () => {
    const filter = new DomainExceptionFilter();
    const { host, status, json } = createHost();
    const error = new InvalidSessionTransitionError('live', 'start');

    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      statusCode: 409,
      error: 'INVALID_SESSION_TRANSITION',
      message: error.message,
    });
  });

  it('maps InvalidLanguageError to 400', () => {
    const filter = new DomainExceptionFilter();
    const { host, status, json } = createHost();
    const error = new InvalidLanguageError('xx');

    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      error: 'INVALID_LANGUAGE',
      message: error.message,
    });
  });

  it('maps InvalidArgumentError to 400', () => {
    const filter = new DomainExceptionFilter();
    const { host, status, json } = createHost();
    const error = new InvalidArgumentError('bad input');

    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      error: 'INVALID_ARGUMENT',
      message: 'bad input',
    });
  });
});
