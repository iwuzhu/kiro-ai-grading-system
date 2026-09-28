/**
 * Global Exception Filter - Catches all exceptions and returns standardized responses
 *
 * This filter:
 * 1. Intercepts all exceptions thrown in the application
 * 2. Transforms them into standardized JSON responses
 * 3. Logs exceptions with appropriate level based on HTTP status
 * 4. Never exposes stack traces or internal details to clients
 * 5. Handles both custom AppExceptions and built-in NestJS exceptions
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppException } from '../exceptions/app.exception';

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
  path: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An internal server error occurred';
    let details: any = undefined;

    // Handle custom AppException
    if (exception instanceof AppException) {
      statusCode = exception.getStatus();
      code = exception.code;
      message = exception.message;
      details = exception.details;

      this.logException(request, statusCode, code, message, exception);
    }
    // Handle built-in NestJS HttpException
    else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();

      // Extract message from NestJS exception response
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'object') {
        const errorObj = exceptionResponse as any;
        message = errorObj.message || exception.message;
        code = this.getNestJSExceptionCode(statusCode);
        details = this.extractNestJSDetails(errorObj);
      } else {
        message = exceptionResponse.toString();
        code = this.getNestJSExceptionCode(statusCode);
      }

      this.logException(request, statusCode, code, message, exception);
    }
    // Handle generic Error
    else if (exception instanceof Error) {
      message = exception.message || 'An unexpected error occurred';
      code = 'INTERNAL_SERVER_ERROR';
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;

      this.logException(request, statusCode, code, message, exception);
    }
    // Handle unknown exception
    else {
      message = 'An unexpected error occurred';
      code = 'INTERNAL_SERVER_ERROR';
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;

      this.logger.error(
        `Unknown exception type: ${typeof exception}`,
        {
          path: request.path,
          method: request.method,
          exception,
        },
      );
    }

    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code,
        message,
        ...(details && { details }),
      },
      timestamp: new Date().toISOString(),
      path: request.path,
    };

    response.status(statusCode).json(errorResponse);
  }

  /**
   * Map HTTP status codes to appropriate error codes for NestJS exceptions
   */
  private getNestJSExceptionCode(statusCode: number): string {
    const codeMap: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'VALIDATION_ERROR',
      [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMIT_EXCEEDED',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
      [HttpStatus.GATEWAY_TIMEOUT]: 'TIMEOUT',
    };

    return codeMap[statusCode] || 'INTERNAL_SERVER_ERROR';
  }

  /**
   * Extract details from NestJS exception responses
   * Filter out sensitive information
   */
  private extractNestJSDetails(errorObj: any): any {
    // Return validation errors if present
    if (Array.isArray(errorObj.message)) {
      return {
        errors: errorObj.message.map((err: any) => {
          if (typeof err === 'string') {
            return { issue: err };
          }
          return err;
        }),
      };
    }

    // Return null/error from error object if safe
    if (errorObj.error && typeof errorObj.error === 'string') {
      return undefined; // Don't expose generic error strings
    }

    return undefined; // Default: no details for NestJS exceptions
  }

  /**
   * Log exception with appropriate level based on status code
   */
  private logException(
    request: Request,
    statusCode: number,
    code: string,
    message: string,
    exception: unknown,
  ): void {
    const logContext = {
      path: request.path,
      method: request.method,
      statusCode,
      code,
      message,
      // Extract user context if available (from request)
      userId: (request as any).user?.sub,
      tenantId: (request as any).user?.tenant_id,
      ip: request.ip,
    };

    // Log errors (5xx) as errors
    if (statusCode >= 500) {
      this.logger.error(
        `[${code}] ${message}`,
        exception instanceof Error ? exception.stack : undefined,
        logContext,
      );
    }
    // Log client errors (4xx) as warnings
    else if (statusCode >= 400) {
      this.logger.warn(
        `[${code}] ${message}`,
        logContext,
      );
    }
    // Log success-ish responses (2xx/3xx) as debug
    else {
      this.logger.debug(
        `[${code}] ${message}`,
        logContext,
      );
    }
  }
}
