/**
 * InternalServerException - Thrown for internal server errors
 *
 * HTTP Status: 500 Internal Server Error
 * Code: INTERNAL_SERVER_ERROR
 *
 * IMPORTANT: Never expose internal details (stack traces, file paths, SQL, API keys)
 * in the error message or details. Log these internally for debugging.
 *
 * Example:
 * throw new InternalServerException()
 * throw new InternalServerException('Failed to process request')
 */

import { AppException } from './app.exception';

export class InternalServerException extends AppException {
  constructor(message: string = 'An internal server error occurred') {
    // Never include details for 500 errors - they should be logged internally
    super(
      'INTERNAL_SERVER_ERROR',
      message,
      500,
      undefined, // No details to expose to client
    );

    Object.setPrototypeOf(this, InternalServerException.prototype);
  }
}
