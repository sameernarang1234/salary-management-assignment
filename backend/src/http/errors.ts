import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ServiceError } from '../services/errors.js';

/** An error raised by the HTTP layer itself, e.g. a missing session. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

const STATUS_BY_SERVICE_CODE: Record<string, number> = {
  VALIDATION_FAILED: 400,
  INVALID_CREDENTIALS: 401,
  EMPLOYEE_NOT_FOUND: 404,
  EMAIL_IN_USE: 409,
  EMPLOYEE_LEFT: 409,
};

interface ErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}

/** Errors from Express's JSON body parser carry a `type` and an HTTP `status`. */
function isBodyParserError(error: unknown): error is { type: string; status: number } {
  return typeof error === 'object' && error !== null && 'type' in error && 'status' in error;
}

/** Turns any error into the one error format. Unexpected errors are logged, never sent. */
export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  let status = 500;
  let body: ErrorBody = { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } };

  if (error instanceof HttpError) {
    status = error.status;
    body = { error: { code: error.code, message: error.message } };
  } else if (error instanceof ServiceError) {
    status = STATUS_BY_SERVICE_CODE[error.code] ?? 500;
    const fields = 'fields' in error ? (error.fields as Record<string, string>) : undefined;
    body = { error: { code: error.code, message: error.message, ...(fields && { fields }) } };
  } else if (isBodyParserError(error) && error.type === 'entity.parse.failed') {
    status = 400;
    body = { error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } };
  } else if (isBodyParserError(error) && error.status >= 400 && error.status < 500) {
    status = error.status;
    body = { error: { code: 'BAD_REQUEST', message: 'The request could not be processed' } };
  } else {
    console.error(error);
  }

  response.status(status).json(body);
};

export const notFound: RequestHandler = (_request, response) => {
  response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
};
