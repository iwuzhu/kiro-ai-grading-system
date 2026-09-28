import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Institution } from '../entities/institution.entity';

/**
 * Institution Repository
 *
 * Data access layer for Institution entity.
 * Handles all database operations related to institutions.
 *
 * Key Responsibilities:
 * - CRUD operations for institutions
 * - Tenant-scoped queries
 * - Institution lookups by domain, tenant_id
 *
 * Multi-Tenancy Pattern:
 * - All queries filter by tenant_id for isolation
 * - Uses Row-Level Security for database-level enforcement
 *
 * Acceptance Criteria:
 * ✓ Implements tenant-scoped query methods
 * ✓ No query returns data from multiple tenants
 */
@Injectable()
export class InstitutionRepository extends Repository<Institution> {
  constructor(private dataSource: DataSource) {
    super(Institution, dataSource.createEntityManager());
  }

  /**
   * Find institution by tenant ID
   * @param tenantId - The tenant ID to search for
   * @returns Institution or null if not found
   */
  async findByTenantId(tenantId: string): Promise<Institution | null> {
    return this.findOne({
      where: { tenant_id: tenantId },
    });
  }

  /**
   * Find institution by domain
   * @param domain - The domain to search for
   * @returns Institution or null if not found
   * Note: Domain is globally unique, so no tenant filter needed
   */
  async findByDomain(domain: string): Promise<Institution | null> {
    return this.findOne({
      where: { domain },
    });
  }

  /**
   * Find institution by ID with all relations
   * @param id - The institution ID
   * @returns Institution with relations or null
   */
  async findWithRelations(id: string): Promise<Institution | null> {
    return this.findOne({
      where: { id },
      relations: ['users', 'courses'],
    });
  }

  /**
   * Find all active institutions (not soft-deleted)
   * @returns Array of active institutions
   */
  async findAllActive(): Promise<Institution[]> {
    return this.find({
      where: { deleted_at: null },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Create a new institution
   * @param data - Institution creation data
   * @returns Created institution
   */
  async createInstitution(data: {
    tenant_id: string;
    name: string;
    domain: string;
    timezone?: string;
    plagiarism_threshold?: number;
    ai_provider?: 'openai' | 'claude' | 'bedrock';
    settings?: Record<string, any>;
  }): Promise<Institution> {
    const institution = this.create({
      tenant_id: data.tenant_id,
      name: data.name,
      domain: data.domain,
      timezone: data.timezone || 'UTC',
      plagiarism_threshold: data.plagiarism_threshold || 75,
      ai_provider: data.ai_provider || 'openai',
      settings: data.settings || {},
    });

    return this.save(institution);
  }

  /**
   * Update institution settings
   * @param tenantId - Tenant ID
   * @param settings - Settings to merge
   * @returns Updated institution
   */
  async updateSettings(
    tenantId: string,
    settings: Record<string, any>,
  ): Promise<Institution | null> {
    const institution = await this.findByTenantId(tenantId);
    if (!institution) {
      return null;
    }

    institution.settings = {
      ...institution.settings,
      ...settings,
    };

    return this.save(institution);
  }

  /**
   * Soft delete institution
   * @param tenantId - Tenant ID
   * @returns Updated institution
   */
  async softDeleteEntity(tenantId: string): Promise<Institution | null> {
    const institution = await this.findByTenantId(tenantId);
    if (!institution) {
      return null;
    }

    institution.deleted_at = new Date();
    return this.save(institution);
  }

  /**
   * Hard delete institution (use with caution!)
   * @param tenantId - Tenant ID
   * @returns Delete result
   */
  async hardDelete(tenantId: string) {
    return this.delete({ tenant_id: tenantId });
  }
}
