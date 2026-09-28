/**
 * JWT Authentication Guard
 *
 * Verifies that requests include a valid JWT access token.
 * Extracts JWT from Authorization header, validates signature and expiration,
 * and attaches user context to request.
 *
 * Usage:
 * @UseGuards(JwtAuthGuard)
 * @Get('profile')
 * async getProfile(@CurrentUser() user: AuthenticatedUser) {
 *   return user;
 * }
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    // Call parent's canActivate which uses JWT strategy
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    // Handle errors from JWT strategy validation
    if (err || !user) {
      let message = 'Unauthorized';

      if (info?.message) {
        message = info.message;
      } else if (err?.message) {
        message = err.message;
      }

      throw new UnauthorizedException(message);
    }

    return user;
  }
}
