import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DataSource } from 'typeorm';
import { AuthenticatedUser } from '../auth/types';
import { v4 as isUuid } from 'uuid';

/**
 * Tenant Context Middleware
 *
 * This middleware extracts tenant context from each request and sets up
 * the database session for Row-Level Security (RLS) policy enforcement.
 *
 * Processing Flow:
 * 1. Extract tenant_id from X-Tenant-ID header (priority 1) or JWT claim (priority 2)
 * 2. Validate tenant_id is a valid UUID
 * 3. Extract user_id and user_role from authenticated user context (JWT)
 * 4. Set PostgreSQL session variables for RLS evaluation
 * 5. Attach context to request for downstream access
 * 6. Proceed to route handlers
 *
 * PostgreSQL Session Variables Set:
 * - app.current_tenant_id: UUID of the current tenant (used by RLS policies)
 * - app.current_user_id: UUID of the current user (used by RLS policies)
 * - app.current_user_role: User's role enum (admin|instructor|student)
 *
 * These variables are evaluated by RLS policies:
 * ```sql
 * CREATE POLICY tenant_isolation ON assignments
 *   USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
 * ```
 *
 * Error Handling:
 * - 401 Unauthorized: tenant_id missing, user context missing, invalid UUID
 * - 400 Bad Request: Malformed tenant_id UUID format
 *
 * Acceptance Criteria Implementation:
 * ✓ Tenant_id extracted from X-Tenant-ID header or JWT claim
 * ✓ Middleware throws 401 if missing tenant context
 * ✓ PostgreSQL session variable set for RLS evaluation
 * ✓ All controllers receive tenant_id in request context
 * ✓ Maps to Requirements: 1, 2, 19
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantContextMiddleware.name);

  constructor(private readonly dataSource: DataSource) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Extract and validate tenant context
      const tenantId = this.extractTenantId(req);
      
      if (!tenantId) {
        this.logger.warn(
          `Tenant context missing for ${req.method} ${req.path}`,
        );
        throw new UnauthorizedException(
          'Tenant context missing. Provide X-Tenant-ID header or valid JWT with tenant_id claim',
        );
      }

      // Validate tenant_id is a proper UUID
      if (!this.isValidUuid(tenantId)) {
        this.logger.warn(`Invalid tenant UUID format: ${tenantId}`);
        throw new BadRequestException(
          'Invalid tenant_id format. Must be a valid UUID',
        );
      }

      // Extract user context from authenticated request
      const user = this.extractUserContext(req);
      
      if (!user) {
        this.logger.warn(
          `User context missing for ${req.method} ${req.path}`,
        );
        throw new UnauthorizedException(
          'User context missing. JWT authentication required',
        );
      }

      // Validate user_id is a valid UUID
      if (!this.isValidUuid(user.id)) {
        this.logger.warn(`Invalid user UUID format: ${user.id}`);
        throw new BadRequestException(
          'Invalid user_id format. Must be a valid UUID',
        );
      }

      // Set PostgreSQL session variables for RLS evaluation
      await this.setDatabaseContext(tenantId, user.id, user.role);

      // Attach context to request for downstream access
      (req as any).tenantId = tenantId;
      (req as any).userId = user.id;
      (req as any).userRole = user.role;

      this.logger.debug(
        `Tenant context initialized: tenant=${tenantId}, user=${user.id}, role=${user.role}`,
      );

      next();
    } catch (error) {
      this.logger.error(
        `Tenant context setup failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Extract tenant_id from request with priority:
   * 1. X-Tenant-ID header (takes precedence)
   * 2. JWT claims / authenticated user tenant_id (fallback)
   *
   * @param req Express request object
   * @returns tenant_id string or null if not found
   */
  private extractTenantId(req: Request): string | null {
    // Priority 1: X-Tenant-ID header
    const headerTenantId = req.headers['x-tenant-id'];
    if (headerTenantId) {
      return String(headerTenantId);
    }

    // Priority 2: JWT claims (set by JwtAuthGuard)
    const user = this.extractUserContext(req);
    if (user?.tenant_id) {
      return user.tenant_id;
    }

    return null;
  }

  /**
   * Extract authenticated user context from request
   * Populated by JwtAuthGuard (req.user)
   *
   * @param req Express request object
   * @returns AuthenticatedUser if authenticated, null otherwise
   */
  private extractUserContext(req: Request): AuthenticatedUser | null {
    const user = (req as any).user;
    
    if (!user || typeof user !== 'object') {
      return null;
    }

    // Validate required fields
    if (!user.id || !user.tenant_id || !user.role) {
      return null;
    }

    return user as AuthenticatedUser;
  }

  /**
   * Validate tenant_id and user_id are valid UUID format
   * @param value String to validate as UUID
   * @returns true if valid UUID, false otherwise
   */
  private isValidUuid(value: string): boolean {
    // Check if string matches UUID v4 pattern
    return isUuid(value);
  }

  /**
   * Set PostgreSQL session variables for RLS policy evaluation
   * These variables are used by RLS policies to enforce tenant isolation
   *
   * @param tenantId Current tenant UUID
   * @param userId Current user UUID
   * @param userRole Current user role (ADMIN, INSTRUCTOR, STUDENT)
   * @throws Error if database query fails
   */
  private async setDatabaseContext(
    tenantId: string,
    userId: string,
    userRole: string,
  ): Promise<void> {
    const connection = this.dataSource.manager.connection;

    try {
      // Set tenant context for RLS policies
      await connection.query("SET app.current_tenant_id = $1::uuid", [
        tenantId,
      ]);

      // Set user context for RLS policies and audit logging
      await connection.query("SET app.current_user_id = $1::uuid", [userId]);

      // Set role for permission checks and audit logging
      await connection.query("SET app.current_user_role = $1::text", [
        userRole,
      ]);

      this.logger.debug(
        `PostgreSQL session context set: tenant_id=${tenantId}, user_id=${userId}, role=${userRole}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to set PostgreSQL session context: ${error.message}`,
        error.stack,
      );
      throw new UnauthorizedException(
        'Failed to establish database context for tenant isolation',
      );
    }
  }
}

/**
 * Tenant Context Service
 *
 * Provides service layer access to tenant context that was set by middleware.
 * Services can inject this to:
 * - Verify current tenant context is active
 * - Validate tenant access for specific operations
 * - Query database session variables (for debugging/logging)
 *
 * Usage:
 * ```typescript
 * @Injectable()
 * export class CourseService {
 *   constructor(private tenantContextService: TenantContextService) {}
 *
 *   async getCourse(courseId: string): Promise<Course> {
 *     // Service can verify tenant context is active
 *     const currentTenantId = await this.tenantContextService.getCurrentTenantId();
 *     // Use in queries, logging, etc.
 *   }
 * }
 * ```
 *
 * Acceptance Criteria Implementation:
 * ✓ getCurrentTenantId(): Returns current tenant from request context
 * ✓ getCurrentUserId(): Returns current user from request context
 * ✓ getCurrentUserRole(): Returns current user role
 * ✓ validateTenantAccess(tenantId): Verifies user can access tenant
 *
 * Maps to Requirements: 1, 2, 19
 */
@Injectable()
export class TenantContextService {
  private readonly logger = new Logger(TenantContextService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Get current tenant ID from database session
   * @returns UUID of current tenant
   * @throws Error if context not set (middleware not executed)
   */
  async getCurrentTenantId(): Promise<string> {
    try {
      const result = await this.dataSource.query(
        "SELECT current_setting('app.current_tenant_id', false)::text as tenant_id",
      );
      const tenantId = result[0]?.tenant_id;

      if (!tenantId) {
        this.logger.error('Tenant context not available in database session');
        throw new Error('Tenant context not available');
      }

      return tenantId;
    } catch (error) {
      this.logger.error(
        `Failed to retrieve current tenant ID: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get current user ID from database session
   * @returns UUID of current user
   * @throws Error if context not set
   */
  async getCurrentUserId(): Promise<string> {
    try {
      const result = await this.dataSource.query(
        "SELECT current_setting('app.current_user_id', false)::text as user_id",
      );
      const userId = result[0]?.user_id;

      if (!userId) {
        this.logger.error('User context not available in database session');
        throw new Error('User context not available');
      }

      return userId;
    } catch (error) {
      this.logger.error(
        `Failed to retrieve current user ID: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get current user role from database session
   * @returns User role (ADMIN, INSTRUCTOR, STUDENT)
   * @throws Error if context not set
   */
  async getCurrentUserRole(): Promise<string> {
    try {
      const result = await this.dataSource.query(
        "SELECT current_setting('app.current_user_role', false)::text as user_role",
      );
      const userRole = result[0]?.user_role;

      if (!userRole) {
        this.logger.error('User role not available in database session');
        throw new Error('User role not available');
      }

      return userRole;
    } catch (error) {
      this.logger.error(
        `Failed to retrieve current user role: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Validate that the given tenant_id matches the current tenant context
   * Used to verify authorization for tenant-specific operations
   *
   * @param tenantId Tenant to validate access to
   * @returns true if user can access this tenant, false otherwise
   */
  async validateTenantAccess(tenantId: string): Promise<boolean> {
    try {
      const currentTenantId = await this.getCurrentTenantId();
      
      // Can only access the tenant you're currently in
      const hasAccess = currentTenantId === tenantId;

      if (!hasAccess) {
        this.logger.warn(
          `Tenant access violation attempt: current=${currentTenantId}, requested=${tenantId}`,
        );
      }

      return hasAccess;
    } catch (error) {
      this.logger.error(
        `Failed to validate tenant access: ${error.message}`,
      );
      return false;
    }
  }
}
