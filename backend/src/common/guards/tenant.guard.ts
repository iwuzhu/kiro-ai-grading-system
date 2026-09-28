/**
 * Tenant Guard
 *
 * Validates that authenticated user belongs to the tenant referenced in the request.
 * This provides defense-in-depth against multi-tenant data leakage.
 *
 * Even though PostgreSQL RLS policies enforce tenant isolation at the database level,
 * this guard provides application-level validation.
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, TenantGuard)
 * @Get('institutions/:institution_id/courses')
 * async getCourses(
 *   @Param('institution_id') institutionId: string,
 *   @CurrentUser() user: AuthenticatedUser,
 * ) {
 *   // Guard ensures user.tenant_id matches institutionId
 * }
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../infrastructure/auth/types';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    // User must be authenticated
    if (!user || !user.tenant_id) {
      throw new ForbiddenException('User not authenticated or missing tenant context');
    }

    // Extract tenant_id from URL param (most common case)
    let requestTenantId = request.params?.institution_id ||
      request.params?.tenant_id ||
      request.params?.org_id;

    // Fallback: try from query params
    if (!requestTenantId) {
      requestTenantId = request.query?.institution_id ||
        request.query?.tenant_id ||
        request.query?.org_id;
    }

    // Fallback: try from request body
    if (!requestTenantId && request.body) {
      requestTenantId = request.body.institution_id ||
        request.body.tenant_id ||
        request.body.org_id;
    }

    // If tenant_id is in request, validate it matches user's tenant
    if (requestTenantId && requestTenantId !== user.tenant_id) {
      throw new ForbiddenException(
        `User tenant_id (${user.tenant_id}) does not match request tenant (${requestTenantId})`,
      );
    }

    return true;
  }
}
