/**
 * TimeoutException - Thrown when an operation times out
 *
 * HTTP Status: 504 Gateway Timeout
 * Code: TIMEOUT
 *
 * Example:
 * throw new TimeoutException('Grading engine took too long to respond')
 * throw new TimeoutException('File upload', 'Exceeded 30 second timeout')
 */

import { AppException } from './app.exception';

export class TimeoutException extends AppException {
  constructor(
    operationName: string = 'Operation',
    message?: string,
  ) {
    const defaultMessage = message
      ? message
      : `${operationName} exceeded timeout`;

    const details = {
      operation: operationName,
    };

    super(
      'TIMEOUT',
      defaultMessage,
      504,
      details,
    );

    Object.setPrototypeOf(this, TimeoutException.prototype);
  }
}
