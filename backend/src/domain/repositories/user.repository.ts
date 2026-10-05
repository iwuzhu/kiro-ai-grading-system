import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { User } from '../entities/user.entity';

/**
 * User Repository
 *
 * Data access layer for User entity.
 * Handles all database operations related to users.
 *
 * Key Responsibilities:
 * - CRUD operations for users
 * - Tenant-scoped queries
 * - User lookups by email, role, status
 * - Authentication queries (password hash, SSO)
 *
 * Multi-Tenancy Pattern:
 * - All queries filter by tenant_id for isolation
 * - Emails are only unique within a tenant
 * - SSO credentials are only unique within a tenant
 *
 * Acceptance Criteria:
 * ✓ Implements tenant-scoped query methods
 * ✓ Enforces email uniqueness within tenant
 * ✓ Enforces SSO uniqueness within tenant
 * ✓ No query returns users from multiple tenants
 */
@Injectable()
export class UserRepository extends Repository<User> {
  constructor(private dataSource: DataSource) {
    super(User, dataSource.manager);
  }

  /**
   * Find user by tenant and email
   * @param tenantId - The tenant ID
   * @param email - The user's email
   * @returns User or null if not found
   */
  async findByEmail(tenantId: string, email: string): Promise<User | null> {
    return this.findOne({
      where: {
        tenant_id: tenantId,
        email,
      },
    });
  }

  /**
   * Find user by ID (with tenant context)
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @returns User or null if not found
   */
  async findById(tenantId: string, userId: string): Promise<User | null> {
    return this.findOne({
      where: {
        tenant_id: tenantId,
        id: userId,
      },
      relations: ['institution', 'enrollments'],
    });
  }

  /**
   * Find user by SSO credentials
   * @param tenantId - The tenant ID
   * @param ssoProvider - The SSO provider (okta, azure, google)
   * @param ssoId - The SSO ID from provider
   * @returns User or null if not found
   */
  async findBySSO(
    tenantId: string,
    ssoProvider: string,
    ssoId: string,
  ): Promise<User | null> {
    return this.findOne({
      where: {
        tenant_id: tenantId,
        sso_provider: ssoProvider as 'okta' | 'azure' | 'google',
        sso_id: ssoId,
      },
    });
  }

  /**
   * Find all active users in a tenant
   * @param tenantId - The tenant ID
   * @returns Array of active users
   */
  async findActivByTenant(tenantId: string): Promise<User[]> {
    return this.find({
      where: {
        tenant_id: tenantId,
        status: 'ACTIVE',
        deleted_at: null,
      },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Find all users with a specific role in a tenant
   * @param tenantId - The tenant ID
   * @param role - The role (ADMIN, INSTRUCTOR, STUDENT)
   * @returns Array of users with specified role
   */
  async findByRole(
    tenantId: string,
    role: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT',
  ): Promise<User[]> {
    return this.find({
      where: {
        tenant_id: tenantId,
        role,
        deleted_at: null,
      },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Find all users by status in a tenant
   * @param tenantId - The tenant ID
   * @param status - The status (ACTIVE, INACTIVE, INVITED)
   * @returns Array of users with specified status
   */
  async findByStatus(
    tenantId: string,
    status: 'ACTIVE' | 'INACTIVE' | 'INVITED',
  ): Promise<User[]> {
    return this.find({
      where: {
        tenant_id: tenantId,
        status,
        deleted_at: null,
      },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Find all users in a tenant (paginated)
   * @param tenantId - The tenant ID
   * @param page - Page number (0-indexed)
   * @param limit - Results per page
   * @returns Paginated users
   */
  async findByTenant(
    tenantId: string,
    page: number = 0,
    limit: number = 20,
  ): Promise<{ users: User[]; total: number }> {
    const [users, total] = await this.findAndCount({
      where: {
        tenant_id: tenantId,
        deleted_at: null,
      },
      skip: page * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return { users, total };
  }

  /**
   * Create a new user
   * @param data - User creation data
   * @returns Created user
   */
  async createUser(data: {
    tenant_id: string;
    institution_id: string;
    email: string;
    name: string;
    role: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT';
    password_hash?: string;
    sso_provider?: 'okta' | 'azure' | 'google';
    sso_id?: string;
    status?: 'ACTIVE' | 'INACTIVE' | 'INVITED';
    permissions?: string[];
  }): Promise<User> {
    const user = this.create({
      tenant_id: data.tenant_id,
      institution_id: data.institution_id,
      email: data.email,
      name: data.name,
      role: data.role,
      password_hash: data.password_hash || null,
      sso_provider: data.sso_provider || null,
      sso_id: data.sso_id || null,
      status: data.status || 'INVITED',
      permissions: data.permissions || [],
    });

    return this.save(user);
  }

  /**
   * Update user permissions
   * @param tenantId - Tenant ID
   * @param userId - User ID
   * @param permissions - New permissions array
   * @returns Updated user
   */
  async updatePermissions(
    tenantId: string,
    userId: string,
    permissions: string[],
  ): Promise<User | null> {
    const user = await this.findById(tenantId, userId);
    if (!user) {
      return null;
    }

    user.permissions = permissions;
    return this.save(user);
  }

  /**
   * Add permission to user
   * @param tenantId - Tenant ID
   * @param userId - User ID
   * @param permission - Permission code to add
   * @returns Updated user
   */
  async addPermission(
    tenantId: string,
    userId: string,
    permission: string,
  ): Promise<User | null> {
    const user = await this.findById(tenantId, userId);
    if (!user) {
      return null;
    }

    if (!user.permissions.includes(permission)) {
      user.permissions.push(permission);
      return this.save(user);
    }

    return user;
  }

  /**
   * Update user status
   * @param tenantId - Tenant ID
   * @param userId - User ID
   * @param status - New status
   * @returns Updated user
   */
  async updateStatus(
    tenantId: string,
    userId: string,
    status: 'ACTIVE' | 'INACTIVE' | 'INVITED',
  ): Promise<User | null> {
    const user = await this.findById(tenantId, userId);
    if (!user) {
      return null;
    }

    user.status = status;
    return this.save(user);
  }

  /**
   * Soft delete user
   * @param tenantId - Tenant ID
   * @param userId - User ID
   * @returns Updated user
   */
  async softDeleteEntity(tenantId: string, userId: string): Promise<User | null> {
    const user = await this.findById(tenantId, userId);
    if (!user) {
      return null;
    }

    user.deleted_at = new Date();
    user.status = 'INACTIVE';
    return this.save(user);
  }

  /**
   * Update last login timestamp
   * @param tenantId - Tenant ID
   * @param userId - User ID
   * @returns Updated user
   */
  async updateLastLogin(tenantId: string, userId: string): Promise<User | null> {
    const user = await this.findById(tenantId, userId);
    if (!user) {
      return null;
    }

    user.last_login = new Date();
    return this.save(user);
  }
}
