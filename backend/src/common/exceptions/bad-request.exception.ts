/**
 * BadRequestException - Thrown when request is malformed or invalid
 *
 * HTTP Status: 400 Bad Request
 * Code: BAD_REQUEST
 *
 * Example:
 * throw new BadRequestException('Invalid JSON in request body')
 * throw new BadRequestException('Missing required field', { field: 'email' })
 * throw new BadRequestException('Invalid request format', { issue: 'Malformed UUID' })
 */

import { AppException } from './app.exception';

export class BadRequestException extends AppException {
  constructor(
    message: string = 'Bad request',
    details?: any,
  ) {
    super(
      'BAD_REQUEST',
      message,
      400,
      details,
    );

    Object.setPrototypeOf(this, BadRequestException.prototype);
  }
}
