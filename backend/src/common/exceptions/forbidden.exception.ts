/**
 * ForbiddenException - Thrown when user lacks permissions or role to access resource
 *
 * HTTP Status: 403 Forbidden
 * Code: FORBIDDEN
 *
 * Differences from UnauthorizedException (401):
 * - 401: User not authenticated (missing or invalid credentials)
 * - 403: User authenticated but lacks permission (insufficient privileges)
 *
 * Example:
 * throw new ForbiddenException('Students cannot create assignments')
 * throw new ForbiddenException('Missing permission: grades:override')
 * throw new ForbiddenException('Resource access denied', { requiredRole: 'INSTRUCTOR' })
 */

import { AppException } from './app.exception';

export class ForbiddenException extends AppException {
  constructor(
    message: string = 'Access denied',
    reason?: string,
  ) {
    const details = reason ? { reason } : undefined;

    super(
      'FORBIDDEN',
      message,
      403,
      details,
    );

    Object.setPrototypeOf(this, ForbiddenException.prototype);
  }
}
