/**
 * AppException - Base exception class for all application exceptions
 *
 * This is the foundation of the application's error handling system.
 * All custom exceptions should extend this class.
 */
export class AppException extends Error {
  /**
   * Error code identifier (e.g., 'VALIDATION_ERROR', 'NOT_FOUND')
   * Used by clients to handle specific error types
   */
  public readonly code: string;

  /**
   * HTTP status code to return to the client
   */
  public readonly statusCode: number;

  /**
   * Additional error details (varies by exception type)
   * Examples: validation errors list, missing field name, etc.
   */
  public readonly details?: any;

  constructor(
    code: string,
    message: string,
    statusCode: number,
    details?: any,
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AppException.prototype);

    // Capture stack trace (excluding this constructor)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Get the response object for sending to clients
   * Never includes stack trace or internal details
   */
  getResponse(): {
    success: boolean;
    error: {
      code: string;
      message: string;
      details?: any;
    };
  } {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    };
  }

  /**
   * Get the HTTP status code for this exception
   */
  getStatus(): number {
    return this.statusCode;
  }
}
