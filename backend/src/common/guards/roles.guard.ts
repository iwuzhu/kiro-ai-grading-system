/**
 * Roles Guard
 *
 * Checks if authenticated user has one of the required roles.
 * Must be used with @Roles() decorator to specify allowed roles.
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
 * @Post('courses')
 * async createCourse(@Body() dto: CreateCourseDto) {
 *   // Only ADMIN and INSTRUCTOR can access
 * }
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser, UserRole } from '../../infrastructure/auth/types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required roles from @Roles() decorator
    const requiredRoles = this.reflector.get<UserRole[]>(
      'roles',
      context.getHandler(),
    );

    // If no roles specified, allow access (no role restriction)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Get user from request
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    // User must be authenticated
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check if user's role is in allowed roles
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `User role "${user.role}" is not authorized for this resource. Required roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
