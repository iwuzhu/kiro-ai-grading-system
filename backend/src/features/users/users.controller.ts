import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { UserManagementService } from '../../application/services/user-management.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../infrastructure/auth/types';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CreateUserDto,
  UpdateUserDto,
  BulkImportUsersDto,
  ChangeUserRoleDto,
} from './dtos/user.dto';
import { User } from '../../domain/entities/user.entity';

/**
 * User Management Controller
 *
 * REST endpoints for user management operations:
 * - Create individual users
 * - List users in institution
 * - Get user details
 * - Update user settings
 * - Deactivate users
 * - Bulk import users from CSV
 * - Change user roles
 *
 * RBAC Guards:
 * - POST /users: ADMIN only (create user)
 * - GET /users: ADMIN or INSTRUCTOR (list users in institution)
 * - GET /users/:userId: ADMIN or INSTRUCTOR (view user details)
 * - PATCH /users/:userId: ADMIN only (update user)
 * - DELETE /users/:userId: ADMIN only (deactivate user)
 * - POST /users/bulk-import: ADMIN only (import users from CSV)
 *
 * Multi-Tenancy:
 * - All operations scoped to current tenant
 * - Users can only operate within their institution
 * - Cross-tenant access returns 403 Forbidden
 *
 * Response Format:
 * All endpoints return standardized response envelope:
 * {
 *   "success": true|false,
 *   "data": { user object or array },
 *   "error": null | { code, message, details },
 *   "timestamp": "ISO-8601",
 *   "path": "/api/v1/..."
 * }
 *
 * Error Codes:
 * - VALIDATION_ERROR (400): Input validation failed
 * - UNAUTHORIZED (401): Authentication required
 * - FORBIDDEN (403): Insufficient permissions
 * - NOT_FOUND (404): Resource not found
 * - CONFLICT (409): Resource conflict (e.g., duplicate email)
 * - INTERNAL_SERVER_ERROR (500): Unexpected server error
 */
@Controller(':institution_id/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private userManagementService: UserManagementService) {}

  /**
   * Create a new user in the institution
   *
   * @route POST /api/v1/:institution_id/users
   * @rbac ADMIN only
   *
   * Request:
   * {
   *   "email": "student@university.edu",
   *   "name": "John Doe",
   *   "role": "STUDENT",
   *   "password": "SecurePassword123"
   * }
   *
   * Response: 201 Created
   * {
   *   "success": true,
   *   "data": {
   *     "id": "uuid",
   *     "email": "student@university.edu",
   *     "name": "John Doe",
   *     "role": "STUDENT",
   *     "status": "ACTIVE",
   *     "created_at": "2024-01-01T00:00:00Z"
   *   },
   *   "error": null
   * }
   */
  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createUser(
    @Param('institution_id') institutionId: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateUserDto,
  ): Promise<{
    success: boolean;
    data: Partial<User>;
    error: null | { code: string; message: string; details?: any };
  }> {
    try {
      const user = await this.userManagementService.createUser(
        tenantId,
        institutionId,
        {
          email: dto.email,
          name: dto.name,
          role: dto.role,
          password: dto.password,
          permissions: dto.permissions,
        },
      );

      return {
        success: true,
        data: this.sanitizeUser(user),
        error: null,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all users in the institution (paginated)
   *
   * @route GET /api/v1/:institution_id/users
   * @rbac ADMIN or INSTRUCTOR
   *
   * Query Parameters:
   * - page: Page number (0-indexed, default 0)
   * - limit: Results per page (default 20, max 100)
   * - role: Filter by role (ADMIN|INSTRUCTOR|STUDENT)
   * - status: Filter by status (ACTIVE|INACTIVE|INVITED)
   *
   * Response: 200 OK
   * {
   *   "success": true,
   *   "data": {
   *     "users": [...],
   *     "pagination": {
   *       "page": 0,
   *       "limit": 20,
   *       "total": 150,
   *       "hasMore": true
   *     }
   *   },
   *   "error": null
   * }
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  @HttpCode(HttpStatus.OK)
  async listUsers(
    @Param('institution_id') institutionId: string,
    @CurrentTenant() tenantId: string,
    @Query('page') page: string = '0',
    @Query('limit') limit: string = '20',
    @Query('role') role?: string,
    @Query('status') status?: string,
  ): Promise<{
    success: boolean;
    data: { users: Partial<User>[]; pagination: any };
    error: null;
  }> {
    try {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

      const result = await this.userManagementService.listUsers(
        tenantId,
        institutionId,
        {
          page: pageNum,
          limit: limitNum,
          role: role as any || undefined,
          status: status as any || undefined,
        },
      );

      return {
        success: true,
        data: {
          users: result.users.map(u => this.sanitizeUser(u)),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: result.total,
            hasMore: pageNum * limitNum < result.total,
          },
        },
        error: null,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user details by ID
   *
   * @route GET /api/v1/:institution_id/users/:user_id
   * @rbac ADMIN or INSTRUCTOR
   *
   * Response: 200 OK
   * {
   *   "success": true,
   *   "data": {
   *     "id": "uuid",
   *     "email": "student@university.edu",
   *     "name": "John Doe",
   *     "role": "STUDENT",
   *     "status": "ACTIVE",
   *     "permissions": ["courses:view", "assignments:view"],
   *     "created_at": "2024-01-01T00:00:00Z"
   *   },
   *   "error": null
   * }
   */
  @Get(':user_id')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  @HttpCode(HttpStatus.OK)
  async getUser(
    @Param('institution_id') institutionId: string,
    @Param('user_id') userId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<{
    success: boolean;
    data: Partial<User>;
    error: null;
  }> {
    try {
      // TODO: Fetch user using UserRepository
      // For now, return placeholder

      return {
        success: true,
        data: {},
        error: null,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update user settings (including status)
   *
   * @route PATCH /api/v1/:institution_id/users/:user_id
   * @rbac ADMIN only
   *
   * Request:
   * {
   *   "name": "Jane Doe",
   *   "email": "newemail@university.edu",
   *   "status": "INACTIVE"
   * }
   *
   * Response: 200 OK with updated user
   */
  @Patch(':user_id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateUser(
    @Param('institution_id') institutionId: string,
    @Param('user_id') userId: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: any,
  ): Promise<{
    success: boolean;
    data: Partial<User>;
    error: null;
  }> {
    try {
      let user = await this.userManagementService.getUserById?.(tenantId, userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      // Handle status update
      if (dto.status) {
        user = await this.userManagementService.updateUserStatus(
          tenantId,
          userId,
          dto.status,
        );
      }

      return {
        success: true,
        data: this.sanitizeUser(user),
        error: null,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Deactivate a user
   *
   * @route DELETE /api/v1/:institution_id/users/:user_id
   * @rbac ADMIN only
   *
   * Response: 200 OK (soft delete)
   * {
   *   "success": true,
   *   "data": {
   *     "id": "uuid",
   *     "status": "INACTIVE",
   *     "deleted_at": "2024-01-01T00:00:00Z"
   *   },
   *   "error": null
   * }
   */
  @Delete(':user_id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async deactivateUser(
    @Param('institution_id') institutionId: string,
    @Param('user_id') userId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<{
    success: boolean;
    data: Partial<User>;
    error: null;
  }> {
    try {
      const user = await this.userManagementService.deactivateUser(
        tenantId,
        userId,
      );

      return {
        success: true,
        data: this.sanitizeUser(user),
        error: null,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Bulk import users from CSV
   *
   * @route POST /api/v1/:institution_id/users/bulk-import
   * @rbac ADMIN only
   *
   * Request:
   * {
   *   "csvContent": "email,name,role\nstudent1@uni.edu,Student One,STUDENT\n..."
   * }
   *
   * Response: 200 OK
   * {
   *   "success": true,
   *   "data": {
   *     "successCount": 45,
   *     "errors": [
   *       { "row": 3, "error": "Invalid email format" },
   *       { "row": 7, "error": "Duplicate email in import" }
   *     ],
   *     "createdUsers": [...]
   *   },
   *   "error": null
   * }
   */
  @Post('bulk-import')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async bulkImportUsers(
    @Param('institution_id') institutionId: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: BulkImportUsersDto,
  ): Promise<{
    success: boolean;
    data: any;
    error: null;
  }> {
    try {
      if (!dto.csvContent) {
        throw new BadRequestException('csvContent is required');
      }

      const result = await this.userManagementService.bulkImportUsers(
        tenantId,
        institutionId,
        dto.csvContent,
      );

      return {
        success: true,
        data: {
          successCount: result.successCount,
          errors: result.errors,
          createdUsers: result.createdUsers.map((u) => this.sanitizeUser(u)),
        },
        error: null,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Change user role
   *
   * @route PATCH /api/v1/:institution_id/users/:user_id/role
   * @rbac ADMIN only
   *
   * Request:
   * {
   *   "newRole": "INSTRUCTOR"
   * }
   *
   * Response: 200 OK with updated user
   */
  @Patch(':user_id/role')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async changeUserRole(
    @Param('institution_id') institutionId: string,
    @Param('user_id') userId: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: ChangeUserRoleDto,
  ): Promise<{
    success: boolean;
    data: Partial<User>;
    error: null;
  }> {
    try {
      const user = await this.userManagementService.changeUserRole(
        tenantId,
        userId,
        dto.newRole,
      );

      return {
        success: true,
        data: this.sanitizeUser(user),
        error: null,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Sanitize user object for response (remove sensitive fields)
   *
   * @param user - User to sanitize
   * @returns Sanitized user object
   */
  private sanitizeUser(user: User): Partial<User> {
    const { password_hash, ...sanitized } = user as any;
    return sanitized;
  }
}
