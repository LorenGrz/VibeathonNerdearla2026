import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { DomainError } from '@subs/domain';
import type { Response } from 'express';

/**
 * Maps `@subs/domain` errors to HTTP status codes.
 * `NotFoundException` is not a domain concern: services throw Nest's own
 * `NotFoundException`, which Nest's default exception layer already handles.
 */
const STATUS_BY_CODE: Record<string, number> = {
  INVALID_SESSION_TRANSITION: HttpStatus.CONFLICT,
  INVALID_LANGUAGE: HttpStatus.BAD_REQUEST,
  INVALID_ARGUMENT: HttpStatus.BAD_REQUEST,
};

@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const statusCode = STATUS_BY_CODE[exception.code] ?? HttpStatus.BAD_REQUEST;
    response.status(statusCode).json({
      statusCode,
      error: exception.code,
      message: exception.message,
    });
  }
}
