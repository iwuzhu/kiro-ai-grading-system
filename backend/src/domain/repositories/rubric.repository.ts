import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Rubric } from '../entities/rubric.entity';

/**
 * Rubric Repository
 *
 * Data access layer for Rubric entity.
 * Handles all database operations related to rubrics.
 *
 * Key Responsibilities:
 * - CRUD operations for rubrics
 * - Tenant-scoped queries
 * - Rubric lookups by ID, name, template status
 * - Template rubric queries for reusable rubrics
 *
 * Multi-Tenancy Pattern:
 * - All queries filter by tenant_id for isolation
 * - Rubrics belong to a tenant directly
 *
 * Acceptance Criteria:
 * ✓ Implements tenant-scoped query methods
 * ✓ No query returns rubrics from multiple tenants
 * ✓ Supports filtering by template status
 * ✓ JSON serialization/deserialization of criteria
 */
@Injectable()
export class RubricRepository extends Repository<Rubric> {
  constructor(private dataSource: DataSource) {
    super(Rubric, dataSource.manager);
  }

  /**
   * Find rubric by ID (with tenant context)
   * @param tenantId - The tenant ID
   * @param rubricId - The rubric ID
   * @returns Rubric or null if not found
   */
  async findById(
    tenantId: string,
    rubricId: string,
  ): Promise<Rubric | null> {
    return this.findOne({
      where: {
        tenant_id: tenantId,
        id: rubricId,
      },
      relations: ['created_by_user'],
    });
  }

  /**
   * Find rubric by name within tenant
   * @param tenantId - The tenant ID
   * @param name - The rubric name
   * @returns Rubric or null if not found
   */
  async findByName(
    tenantId: string,
    name: string,
  ): Promise<Rubric | null> {
    return this.findOne({
      where: {
        tenant_id: tenantId,
        name,
      },
      relations: ['created_by_user'],
    });
  }

  /**
   * Find all template rubrics in a tenant
   * @param tenantId - The tenant ID
   * @returns Array of template rubrics
   */
  async findTemplates(tenantId: string): Promise<Rubric[]> {
    return this.find({
      where: {
        tenant_id: tenantId,
        is_template: true,
        deleted_at: null,
      },
      relations: ['created_by_user'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Find all rubrics in a tenant
   * @param tenantId - The tenant ID
   * @returns Array of rubrics
   */
  async findByTenant(tenantId: string): Promise<Rubric[]> {
    return this.find({
      where: {
        tenant_id: tenantId,
        deleted_at: null,
      },
      relations: ['created_by_user'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Find all rubrics in a tenant (paginated)
   * @param tenantId - The tenant ID
   * @param page - Page number (0-indexed)
   * @param limit - Results per page
   * @returns Paginated rubrics
   */
  async findByTenantPaginated(
    tenantId: string,
    page: number = 0,
    limit: number = 20,
  ): Promise<{ rubrics: Rubric[]; total: number }> {
    const [rubrics, total] = await this.findAndCount({
      where: {
        tenant_id: tenantId,
        deleted_at: null,
      },
      skip: page * limit,
      take: limit,
      relations: ['created_by_user'],
      order: { created_at: 'DESC' },
    });

    return { rubrics, total };
  }

  /**
   * Find rubrics created by a specific user
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @returns Array of rubrics
   */
  async findByCreatedBy(
    tenantId: string,
    userId: string,
  ): Promise<Rubric[]> {
    return this.find({
      where: {
        tenant_id: tenantId,
        created_by_user_id: userId,
        deleted_at: null,
      },
      relations: ['created_by_user'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Create a new rubric
   * @param data - Rubric creation data
   * @returns Created rubric
   */
  async createRubric(data: {
    tenant_id: string;
    name: string;
    description?: string;
    criteria: any; // JSONB criteria structure
    created_by_user_id?: string;
    is_template?: boolean;
  }): Promise<Rubric> {
    const rubric = this.create({
      tenant_id: data.tenant_id,
      name: data.name,
      description: data.description || null,
      criteria: data.criteria,
      created_by_user_id: data.created_by_user_id || null,
      is_template: data.is_template || false,
    });

    return this.save(rubric);
  }

  /**
   * Update rubric criteria
   * @param tenantId - Tenant ID
   * @param rubricId - Rubric ID
   * @param criteria - New criteria (JSONB)
   * @returns Updated rubric
   */
  async updateCriteria(
    tenantId: string,
    rubricId: string,
    criteria: any,
  ): Promise<Rubric | null> {
    const rubric = await this.findById(tenantId, rubricId);
    if (!rubric) {
      return null;
    }

    rubric.criteria = criteria;
    return this.save(rubric);
  }

  /**
   * Mark rubric as template
   * @param tenantId - Tenant ID
   * @param rubricId - Rubric ID
   * @returns Updated rubric
   */
  async markAsTemplate(
    tenantId: string,
    rubricId: string,
  ): Promise<Rubric | null> {
    const rubric = await this.findById(tenantId, rubricId);
    if (!rubric) {
      return null;
    }

    rubric.is_template = true;
    return this.save(rubric);
  }

  /**
   * Soft delete rubric
   * @param tenantId - Tenant ID
   * @param rubricId - Rubric ID
   * @returns Updated rubric
   */
  async softDeleteEntity(
    tenantId: string,
    rubricId: string,
  ): Promise<Rubric | null> {
    const rubric = await this.findById(tenantId, rubricId);
    if (!rubric) {
      return null;
    }

    rubric.deleted_at = new Date();
    return this.save(rubric);
  }

  /**
   * Check if rubric is in use by any assignments
   * Note: This is a helper that would require additional query
   * In practice, this might be done via a JOIN query in an assignment service
   * @param tenantId - Tenant ID
   * @param rubricId - Rubric ID
   * @returns true if rubric is referenced by assignments
   */
  async isInUse(tenantId: string, rubricId: string): Promise<boolean> {
    // This would require a more complex query joining with assignments
    // For now, we'll return a placeholder
    // In practice, implement this via a service or custom query
    return false;
  }
}
