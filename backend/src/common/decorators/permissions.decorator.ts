/**
 * Permissions Decorator
 *
 * Specifies required granular permissions for a route handler.
 * Must be used with PermissionsGuard to enforce permission validation.
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, PermissionsGuard)
 * @Permissions('grades:write', 'submissions:view')
 * @Post('grades')
 * async createGrade(@Body() dto: CreateGradeDto) {
 *   // Only users with both 'grades:write' AND 'submissions:view' can access
 * }
 */

import { SetMetadata } from '@nestjs/common';

export const Permissions = (...permissions: string[]) =>
  SetMetadata('permissions', permissions);
