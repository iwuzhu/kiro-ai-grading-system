/**
 * RateLimitException - Thrown when rate limit is exceeded
 *
 * HTTP Status: 429 Too Many Requests
 * Code: RATE_LIMIT_EXCEEDED
 *
 * Example:
 * throw new RateLimitException(60) // Retry after 60 seconds
 * throw new RateLimitException(30, 'API request limit exceeded')
 */

import { AppException } from './app.exception';

export class RateLimitException extends AppException {
  constructor(
    retryAfterSeconds: number,
    message: string = 'Rate limit exceeded',
  ) {
    const details = {
      retryAfter: retryAfterSeconds,
    };

    super(
      'RATE_LIMIT_EXCEEDED',
      message,
      429,
      details,
    );

    Object.setPrototypeOf(this, RateLimitException.prototype);
  }
}
