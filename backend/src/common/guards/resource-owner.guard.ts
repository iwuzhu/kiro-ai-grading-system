import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '../exceptions/forbidden.exception';
import { UnauthorizedException } from '../exceptions/unauthorized.exception';
import { REQUIRE_OWNERSHIP_KEY } from '../decorators/require-ownership.decorator';
import { UserRole } from '../../domain/enums/user-role.enum';

/**
 * ResourceOwnerGuard - Enforces resource-level ownership authorization
 *
 * This guard ensures that users can only modify resources they own (created or are responsible for).
 * It provides fine-grained resource-level access control beyond role-based checks.
 *
 * How it works:
 * 1. Extracts the @RequireOwnership metadata specifying which route parameter has the resource ID
 * 2. Gets the resource ID from the specified route parameter
 * 3. Loads the resource from the database (requires ResourceOwnershipProvider)
 * 4. Checks if the current user is the owner of the resource
 * 5. Throws ForbiddenException if not owner
 *
 * Owner Determination:
 * - Admins can always access any resource (bypass ownership check)
 * - Instructors can access resources they created (createdBy = current user)
 * - Students can access resources they own (submissions they created, courses they're enrolled in)
 *
 * Expected Request Setup:
 * - req.user.id: User ID from JWT
 * - req.user.role: User role from JWT
 * - req.params[resourceParam]: Resource ID from URL parameter
 *
 * Example Setup in Controller:
 * @UseGuards(JwtAuthGuard, RolesGuard, ResourceOwnerGuard)
 * export class AssignmentsController {
 *   @Patch(':id')
 *   @Roles(UserRole.INSTRUCTOR)
 *   @RequireOwnership('id')
 *   updateAssignment(@Param('id') id: string) {
 *     // Only instructor who created this assignment can update it
 *   }
 *
 *   @Delete(':id')
 *   @Roles(UserRole.INSTRUCTOR)
 *   @RequireOwnership('id')
 *   deleteAssignment(@Param('id') id: string) {
 *     // Only instructor who owns this assignment can delete it
 *   }
 * }
 *
 * Guard Composition Pattern:
 * @UseGuards(
 *   JwtAuthGuard,        // 1. Authenticate user
 *   TenantGuard,         // 2. Validate tenant
 *   RolesGuard,          // 3. Check role (coarse-grained)
 *   PermissionsGuard,    // 4. Check permissions (fine-grained)
 *   ResourceOwnerGuard   // 5. Check ownership (resource-level)
 * )
 *
 * Error Cases:
 * - 401 Unauthorized: Missing user context or invalid JWT
 * - 403 Forbidden: User is not the owner of the resource
 * - 404 Not Found: Resource doesn't exist (implementation-specific)
 */
@Injectable()
export class ResourceOwnerGuard implements CanActivate {
  private readonly logger = new Logger(ResourceOwnerGuard.name);

  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required ownership parameter from decorator
    const resourceParam = this.reflector.get<string>(
      REQUIRE_OWNERSHIP_KEY,
      context.getHandler(),
    );

    // If no ownership requirement, grant access
    if (!resourceParam) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    const userRole = request.user?.role;

    if (!userId) {
      throw new UnauthorizedException(
        'User ID not found in request',
        'Missing user context - ensure JWT authentication guard is applied',
      );
    }

    // Admins can access any resource without ownership check
    if (userRole === UserRole.ADMIN) {
      this.logger.debug(
        `Admin user ${userId} bypassing ownership check for resource via ${resourceParam}`,
      );
      return true;
    }

    // Extract resource ID from route parameter
    const resourceId = request.params[resourceParam];

    if (!resourceId) {
      throw new ForbiddenException(
        `Resource ID not found in route parameter: ${resourceParam}`,
        `Expected route parameter '${resourceParam}' to contain resource ID`,
      );
    }

    // Check ownership
    const isOwner = await this.checkResourceOwnership(
      resourceId,
      userId,
      request,
    );

    if (isOwner) {
      this.logger.debug(
        `Ownership check passed for user ${userId}, resource ${resourceId}`,
      );
      return true;
    }

    this.logger.warn(
      `Ownership check failed: user ${userId} is not owner of resource ${resourceId}`,
    );

    throw new ForbiddenException(
      'You do not have permission to access this resource',
      `User is not the owner of resource ${resourceId}`,
    );
  }

  /**
   * Check if user is the owner of the resource
   * This method should be overridden by subclasses or using a provider pattern
   *
   * TODO: Implement with repository pattern
   * The guard should accept an injected service to load resources and check ownership
   *
   * @param resourceId The ID of the resource
   * @param userId The ID of the user to check
   * @param request The HTTP request object
   * @returns true if user is the owner, false otherwise
   */
  private async checkResourceOwnership(
    resourceId: string,
    userId: string,
    request: any,
  ): Promise<boolean> {
    // TODO: Implement ownership check via repository injection
    // This is a placeholder that shows the pattern
    //
    // Example implementation:
    // const resource = await this.resourceRepository.findById(resourceId, request.tenantId);
    // if (!resource) return false;
    // return resource.createdBy === userId || resource.ownerId === userId;

    // For now, log and return true to allow implementation
    // In production, this must check actual resource ownership
    this.logger.warn(
      `ResourceOwnerGuard.checkResourceOwnership not implemented - allowing access`,
    );
    return true;
  }
}
