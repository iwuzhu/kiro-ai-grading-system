import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';

/**
 * CORS Middleware - Configures Cross-Origin Resource Sharing
 *
 * Features:
 * - Whitelist-based origin validation
 * - Support for multiple origins
 * - Credentials support (cookies, authorization headers)
 * - Method whitelisting
 * - Header whitelisting
 * - Preflight request handling
 * - Cache control for preflight
 *
 * Usage: app.use(CorsMiddleware) in AppModule
 */
@Injectable()
export class CorsMiddleware implements NestMiddleware {
  private readonly allowedOrigins: string[];
  private readonly allowedMethods: string[] = [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'HEAD',
    'OPTIONS',
  ];
  private readonly allowedHeaders: string[] = [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-API-Key',
    'X-Tenant-ID',
    'Accept',
    'Accept-Language',
    'Content-Language',
  ];
  private readonly exposedHeaders: string[] = [
    'X-Total-Count',
    'X-Page-Number',
    'X-Page-Size',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'Content-Range',
    'X-Request-Id',
  ];
  private readonly maxAge: number = 86400; // 24 hours

  constructor(private configService: ConfigService) {
    // Load allowed origins from environment
    const corsOrigin = this.configService.get<string>(
      'CORS_ORIGIN',
      'http://localhost:3001',
    );
    this.allowedOrigins = corsOrigin.split(',').map((origin) => origin.trim());
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const origin = req.headers.origin;

    // Check if origin is allowed
    if (origin && this.isOriginAllowed(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // Set allowed methods
    res.setHeader('Access-Control-Allow-Methods', this.allowedMethods.join(', '));

    // Set allowed headers
    res.setHeader(
      'Access-Control-Allow-Headers',
      this.allowedHeaders.join(', '),
    );

    // Set exposed headers (accessible by client JavaScript)
    res.setHeader(
      'Access-Control-Expose-Headers',
      this.exposedHeaders.join(', '),
    );

    // Set max age for preflight caching (in seconds)
    res.setHeader('Access-Control-Max-Age', this.maxAge);

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }

    next();
  }

  /**
   * Check if origin is in whitelist
   */
  private isOriginAllowed(origin: string): boolean {
    // Allow exact matches
    if (this.allowedOrigins.includes(origin)) {
      return true;
    }

    // Allow wildcard patterns (e.g., *.example.com)
    for (const allowed of this.allowedOrigins) {
      if (allowed.includes('*')) {
        const pattern = allowed
          .replace(/\./g, '\\.')
          .replace(/\*/g, '.*');
        if (new RegExp(`^${pattern}$`).test(origin)) {
          return true;
        }
      }
    }

    return false;
  }
}
