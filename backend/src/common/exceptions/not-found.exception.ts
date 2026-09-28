/**
 * NotFoundException - Thrown when a requested resource is not found
 *
 * HTTP Status: 404 Not Found
 * Code: NOT_FOUND
 *
 * Example:
 * throw new NotFoundException('User', userId)
 * throw new NotFoundException('Course', courseId)
 */

import { AppException } from './app.exception';

export class NotFoundException extends AppException {
  constructor(
    resourceType: string,
    resourceId?: string | number,
    message?: string,
  ) {
    const defaultMessage = message
      ? message
      : `${resourceType} not found`;

    const details = {
      resourceType,
      ...(resourceId && { resourceId: String(resourceId) }),
    };

    super(
      'NOT_FOUND',
      defaultMessage,
      404,
      details,
    );

    Object.setPrototypeOf(this, NotFoundException.prototype);
  }
}
