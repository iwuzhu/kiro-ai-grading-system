import {
  Injectable,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

/**
 * Throttle Guard - Implements API rate limiting
 *
 * Features:
 * - Rate limit by IP address
 * - Configurable window and max requests
 * - Tracking of requests in memory (can be extended to Redis)
 * - X-RateLimit-* headers in response
 * - 429 Too Many Requests on limit exceeded
 *
 * Usage: @UseGuards(ThrottleGuard)
 */
@Injectable()
export class ThrottleGuard {
  // In-memory store for request tracking
  // In production, use Redis for distributed rate limiting
  private requestMap: Map<
    string,
    { count: number; resetTime: number; firstRequestTime: number }
  > = new Map();

  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly skipSuccessfulRequests: boolean;
  private readonly skipFailedRequests: boolean;

  constructor(private configService: ConfigService) {
    this.windowMs = this.configService.get<number>(
      'RATE_LIMIT_WINDOW_MS',
      60000,
    ); // 1 minute default
    this.maxRequests = this.configService.get<number>(
      'RATE_LIMIT_MAX_REQUESTS',
      100,
    );
    this.skipSuccessfulRequests = this.configService.get<boolean>(
      'RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS',
      false,
    );
    this.skipFailedRequests = this.configService.get<boolean>(
      'RATE_LIMIT_SKIP_FAILED_REQUESTS',
      false,
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Extract client IP (respect X-Forwarded-For for proxied requests)
    const clientIp = this.getClientIp(request);

    // Get or create rate limit info
    const now = Date.now();
    let rateLimitInfo = this.requestMap.get(clientIp);

    if (!rateLimitInfo) {
      // First request from this IP
      rateLimitInfo = {
        count: 1,
        resetTime: now + this.windowMs,
        firstRequestTime: now,
      };
      this.requestMap.set(clientIp, rateLimitInfo);
    } else if (now > rateLimitInfo.resetTime) {
      // Window has expired, reset
      rateLimitInfo.count = 1;
      rateLimitInfo.resetTime = now + this.windowMs;
      rateLimitInfo.firstRequestTime = now;
    } else {
      // Within window, increment counter
      rateLimitInfo.count++;
    }

    // Calculate remaining requests
    const remaining = Math.max(0, this.maxRequests - rateLimitInfo.count);
    const resetTime = Math.ceil(rateLimitInfo.resetTime / 1000);

    // Set rate limit headers
    response.setHeader('X-RateLimit-Limit', this.maxRequests);
    response.setHeader('X-RateLimit-Remaining', remaining);
    response.setHeader('X-RateLimit-Reset', resetTime);
    response.setHeader(
      'Retry-After',
      Math.ceil((rateLimitInfo.resetTime - now) / 1000),
    );

    // Check if limit exceeded
    if (rateLimitInfo.count > this.maxRequests) {
      response.status(HttpStatus.TOO_MANY_REQUESTS).send({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Too Many Requests',
        error: 'Rate limit exceeded. Please retry after ' + resetTime,
        retryAfter: resetTime,
      });
      return false;
    }

    return true;
  }

  /**
   * Extract client IP address from request
   * Respects X-Forwarded-For header for proxied requests
   */
  private getClientIp(request: Request): string {
    // Check X-Forwarded-For header (for proxied requests)
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      // If multiple IPs, take the first one
      const forwardedArray = Array.isArray(forwarded)
        ? forwarded[0]
        : forwarded;
      return forwardedArray.split(',')[0].trim();
    }

    // Check X-Client-IP header
    const clientIp = request.headers['x-client-ip'];
    if (clientIp) {
      return Array.isArray(clientIp) ? clientIp[0] : clientIp;
    }

    // Fall back to socket remote address
    return (
      request.socket?.remoteAddress ||
      request.connection?.remoteAddress ||
      '127.0.0.1'
    );
  }

  /**
   * Clean up old entries periodically
   * Call this from a scheduled task to prevent memory leaks
   */
  cleanupExpiredEntries(): void {
    const now = Date.now();
    for (const [ip, info] of this.requestMap.entries()) {
      if (now > info.resetTime + this.windowMs) {
        this.requestMap.delete(ip);
      }
    }
  }

  /**
   * Get rate limit statistics for monitoring
   */
  getStats(): {
    trackedIps: number;
    totalRequests: number;
  } {
    let totalRequests = 0;
    for (const info of this.requestMap.values()) {
      totalRequests += info.count;
    }
    return {
      trackedIps: this.requestMap.size,
      totalRequests,
    };
  }
}
