import { SetMetadata } from '@nestjs/common';

/**
 * @RequireOwnership Decorator
 *
 * Specifies that the resource must be owned by the authenticated user.
 * Used in combination with ResourceOwnerGuard to enforce resource-level authorization.
 *
 * The decorator parameter specifies which route parameter contains the resource ID.
 * The guard then verifies that the authenticated user is the owner of that resource.
 *
 * Ownership is typically determined by:
 * - The resource's createdBy or ownerId field matches the current user
 * - For courses: instructor created the course
 * - For assignments: instructor owns the parent course or created the assignment
 * - For submissions: student created the submission or is enrolled in the course
 *
 * Usage:
 * @Patch('/assignments/:id')
 * @Roles(UserRole.INSTRUCTOR)
 * @RequireOwnership('id')
 * async updateAssignment(@Param('id') id: string) { }
 *
 * @Delete('/courses/:courseId')
 * @RequireOwnership('courseId')
 * async deleteCourse(@Param('courseId') courseId: string) { }
 *
 * The guard will:
 * 1. Extract the resource ID from the specified route parameter
 * 2. Load the resource from the database
 * 3. Check if the current user is the owner
 * 4. Throw ForbiddenException if not owner
 */
export const REQUIRE_OWNERSHIP_KEY = 'require_ownership';

/**
 * Decorator to require resource ownership for the operation
 * @param resourceParam The route parameter name containing the resource ID (e.g., 'id', 'courseId')
 */
export function RequireOwnership(resourceParam: string): MethodDecorator {
  return SetMetadata(REQUIRE_OWNERSHIP_KEY, resourceParam);
}
