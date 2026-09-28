/**
 * ValidationException - Thrown when request validation fails
 *
 * HTTP Status: 400 Bad Request
 * Code: VALIDATION_ERROR
 *
 * Example:
 * throw new ValidationException([
 *   { field: 'email', issue: 'Invalid email format' },
 *   { field: 'password', issue: 'Password must be at least 8 characters' }
 * ])
 */

import { AppException } from './app.exception';

export class ValidationException extends AppException {
  constructor(
    message: string = 'Request validation failed',
    details?: Array<{ field?: string; issue?: string }>,
  ) {
    super(
      'VALIDATION_ERROR',
      message,
      400,
      details && details.length > 0
        ? details
        : { message: 'One or more validation errors occurred' },
    );

    Object.setPrototypeOf(this, ValidationException.prototype);
  }
}
