/**
 * Roles Decorator
 *
 * Specifies required roles for a route handler.
 * Must be used with RolesGuard to enforce role validation.
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
 * @Post('courses')
 * async createCourse(@Body() dto: CreateCourseDto) {
 *   // Only ADMIN and INSTRUCTOR can access
 * }
 */

import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../infrastructure/auth/types';

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
