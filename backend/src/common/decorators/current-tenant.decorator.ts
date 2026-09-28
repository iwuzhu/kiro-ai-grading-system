/**
 * Current Tenant Decorator
 *
 * Injects the tenant_id from the authenticated user's JWT claims.
 * Provides a convenient way to access tenant context in handlers.
 *
 * This decorator requires JwtAuthGuard to be applied at controller level
 * or route level to ensure tenant context is available.
 *
 * Usage:
 * @UseGuards(JwtAuthGuard)
 * @Get('courses')
 * async getCourses(@CurrentTenant() tenantId: string) {
 *   // tenantId extracted from req.user.tenant_id
 * }
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../../infrastructure/auth/types';

export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;

    if (!user || !user.tenant_id) {
      throw new Error('Tenant context not available. Is JwtAuthGuard applied?');
    }

    return user.tenant_id;
  },
);
