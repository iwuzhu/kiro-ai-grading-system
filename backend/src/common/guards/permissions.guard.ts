/**
 * Permissions Guard
 *
 * Checks if authenticated user has required granular permissions.
 * Must be used with @Permissions() decorator to specify required permissions.
 *
 * Permissions are strings like 'grades:read', 'grades:write', 'users:manage'
 * and are assigned to users based on their role.
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, PermissionsGuard)
 * @Permissions('grades:write')
 * @Post('grades')
 * async createGrade(@Body() dto: CreateGradeDto) {
 *   // Only users with 'grades:write' permission can access
 * }
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser } from '../../infrastructure/auth/types';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required permissions from @Permissions() decorator
    const requiredPermissions = this.reflector.get<string[]>(
      'permissions',
      context.getHandler(),
    );

    // If no permissions specified, allow access (no permission restriction)
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // Get user from request
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    // User must be authenticated
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check if user has all required permissions
    const hasAllPermissions = requiredPermissions.every((permission) =>
      user.permissions.includes(permission),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException(
        `User lacks required permissions. Required: ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
