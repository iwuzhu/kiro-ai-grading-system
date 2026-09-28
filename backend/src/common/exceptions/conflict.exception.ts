/**
 * ConflictException - Thrown when request conflicts with current state
 *
 * HTTP Status: 409 Conflict
 * Code: CONFLICT
 *
 * Example:
 * throw new ConflictException('Email already registered')
 * throw new ConflictException('Course code must be unique within institution')
 * throw new ConflictException('Duplicate key violation', { field: 'email' })
 */

import { AppException } from './app.exception';

export class ConflictException extends AppException {
  constructor(
    message: string = 'Conflict with current state',
    details?: any,
  ) {
    super(
      'CONFLICT',
      message,
      409,
      details,
    );

    Object.setPrototypeOf(this, ConflictException.prototype);
  }
}
