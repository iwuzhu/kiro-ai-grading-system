/**
 * Current User Decorator
 *
 * Injects the authenticated user from JWT token into route handler.
 * Automatically extracts user context from request.user set by JwtAuthGuard.
 *
 * Usage:
 * @UseGuards(JwtAuthGuard)
 * @Get('profile')
 * async getProfile(@CurrentUser() user: AuthenticatedUser) {
 *   return user; // { id, email, tenant_id, role, permissions }
 * }
 *
 * With parameter extraction:
 * @Get('profile')
 * async getProfile(@CurrentUser('id') userId: string) {
 *   // Extracts just the 'id' field: userId = 'uuid-xxx'
 * }
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../../infrastructure/auth/types';

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;

    // If no specific field requested, return entire user object
    if (!data) {
      return user;
    }

    // Return specific field if requested
    return user ? user[data] : null;
  },
);
