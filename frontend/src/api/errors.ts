import type { ApiErrorBody } from './types';

function errorBody(error: unknown): ApiErrorBody['error'] | undefined {
  if (typeof error !== 'object' || error === null || !('data' in error)) {
    return undefined;
  }
  const data = (error as { data: unknown }).data;
  if (typeof data === 'object' && data !== null && 'error' in data) {
    return (data as ApiErrorBody).error;
  }
  return undefined;
}

/** A message to show for a failed request: the server's message, or a generic one. */
export function errorMessage(error: unknown): string {
  return errorBody(error)?.message ?? 'Something went wrong. Please try again.';
}

/** Field errors from a 400 or 409 response, keyed by field path (e.g. "email"). */
export function fieldErrors(error: unknown): Record<string, string> {
  return errorBody(error)?.fields ?? {};
}
