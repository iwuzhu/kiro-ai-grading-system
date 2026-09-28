/**
 * UnauthorizedException - Thrown when user is not authenticated or token is invalid
 *
 * HTTP Status: 401 Unauthorized
 * Code: UNAUTHORIZED
 *
 * Example:
 * throw new UnauthorizedException('Missing authentication token')
 * throw new UnauthorizedException('Token expired')
 * throw new UnauthorizedException('Invalid credentials')
 */

import { AppException } from './app.exception';

export class UnauthorizedException extends AppException {
  constructor(
    message: string = 'Authentication required',
    reason?: string,
  ) {
    const details = reason ? { reason } : undefined;

    super(
      'UNAUTHORIZED',
      message,
      401,
      details,
    );

    Object.setPrototypeOf(this, UnauthorizedException.prototype);
  }
}
