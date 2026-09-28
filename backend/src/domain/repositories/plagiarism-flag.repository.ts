import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { PlagiarismFlag } from '../entities/plagiarism-flag.entity';

/**
 * Plagiarism Flag Repository
 *
 * Data access layer for PlagiarismFlag entity.
 * Handles all database operations related to plagiarism investigation flags.
 *
 * Key Responsibilities:
 * - CRUD operations for plagiarism flags
 * - Tenant-scoped queries ensuring multi-tenancy isolation
 * - Flag lookups by submission, plagiarism result, status
 * - Investigation workflow tracking
 * - Audit trail preservation
 *
 * Multi-Tenancy Pattern:
 * - All queries filter by tenant_id for isolation
 * - Flags belong to a submission which belongs to an assignment which belongs to a tenant
 *
 * Acceptance Criteria:
 * ✓ Implements tenant-scoped query methods
 * ✓ No query returns flags from multiple tenants
 * ✓ Supports status-based filtering (FLAGGED, INVESTIGATING, RESOLVED, FALSE_POSITIVE)
 * ✓ Tracks investigation workflow (flagged → investigating → resolved)
 * ✓ Preserves investigation notes and actions taken
 * ✓ Records who flagged and timestamps
 *
 * Requirement 9: Plagiarism Detection & Investigation Workflow
 */
@Injectable()
export class PlagiarismFlagRepository extends Repository<PlagiarismFlag> {
  constructor(private dataSource: DataSource) {
    super(PlagiarismFlag, dataSource.createEntityManager());
  }

  /**
   * Find plagiarism flag by ID (with tenant context)
   * @param tenantId - The tenant ID
   * @param flagId - The plagiarism flag ID
   * @returns PlagiarismFlag or null if not found
   */
  async findById(
    tenantId: string,
    flagId: string,
  ): Promise<PlagiarismFlag | null> {
    return this.findOne({
      where: {
        tenant_id: tenantId,
        id: flagId,
      },
      relations: [
        'submission',
        'plagiarism_result',
        'flagged_by_user',
        'institution',
      ],
    });
  }

  /**
   * Find all flags for a submission
   * @param tenantId - The tenant ID
   * @param submissionId - The submission ID
   * @returns Array of flags for this submission
   */
  async findBySubmissionId(
    tenantId: string,
    submissionId: string,
  ): Promise<PlagiarismFlag[]> {
    return this.find({
      where: {
        tenant_id: tenantId,
        submission_id: submissionId,
      },
      order: { flagged_at: 'DESC' },
      relations: [
        'submission',
        'plagiarism_result',
        'flagged_by_user',
        'institution',
      ],
    });
  }

  /**
   * Find flag by plagiarism result ID
   * @param tenantId - The tenant ID
   * @param plagiarismResultId - The plagiarism result ID
   * @returns PlagiarismFlag or null if not found
   */
  async findByPlagiarismResultId(
    tenantId: string,
    plagiarismResultId: string,
  ): Promise<PlagiarismFlag | null> {
    return this.findOne({
      where: {
        tenant_id: tenantId,
        plagiarism_result_id: plagiarismResultId,
      },
      relations: [
        'submission',
        'plagiarism_result',
        'flagged_by_user',
        'institution',
      ],
    });
  }

  /**
   * Find all flags in FLAGGED status (pending investigation)
   * @param tenantId - The tenant ID
   * @returns Array of pending flags
   */
  async findPendingFlags(tenantId: string): Promise<PlagiarismFlag[]> {
    return this.find({
      where: {
        tenant_id: tenantId,
        status: 'FLAGGED',
      },
      order: { flagged_at: 'ASC' },
      relations: [
        'submission',
        'plagiarism_result',
        'flagged_by_user',
        'institution',
      ],
    });
  }

  /**
   * Find all flags in INVESTIGATING status
   * @param tenantId - The tenant ID
   * @returns Array of investigating flags
   */
  async findInvestigatingFlags(tenantId: string): Promise<PlagiarismFlag[]> {
    return this.find({
      where: {
        tenant_id: tenantId,
        status: 'INVESTIGATING',
      },
      order: { flagged_at: 'ASC' },
      relations: [
        'submission',
        'plagiarism_result',
        'flagged_by_user',
        'institution',
      ],
    });
  }

  /**
   * Find all flags in RESOLVED status
   * @param tenantId - The tenant ID
   * @param limit - Maximum results
   * @returns Array of resolved flags
   */
  async findResolvedFlags(
    tenantId: string,
    limit: number = 100,
  ): Promise<PlagiarismFlag[]> {
    return this.find({
      where: {
        tenant_id: tenantId,
        status: 'RESOLVED',
      },
      order: { resolved_at: 'DESC' },
      take: limit,
      relations: [
        'submission',
        'plagiarism_result',
        'flagged_by_user',
        'institution',
      ],
    });
  }

  /**
   * Find flags by status
   * @param tenantId - The tenant ID
   * @param status - Flag status
   * @returns Array of flags with this status
   */
  async findByStatus(
    tenantId: string,
    status: 'FLAGGED' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE',
  ): Promise<PlagiarismFlag[]> {
    return this.find({
      where: {
        tenant_id: tenantId,
        status,
      },
      order: { flagged_at: 'DESC' },
      relations: [
        'submission',
        'plagiarism_result',
        'flagged_by_user',
        'institution',
      ],
    });
  }

  /**
   * Find all flags in a tenant (paginated)
   * @param tenantId - The tenant ID
   * @param page - Page number (0-indexed)
   * @param limit - Results per page
   * @returns Paginated flags
   */
  async findByTenant(
    tenantId: string,
    page: number = 0,
    limit: number = 20,
  ): Promise<{ flags: PlagiarismFlag[]; total: number }> {
    const [flags, total] = await this.findAndCount({
      where: {
        tenant_id: tenantId,
      },
      skip: page * limit,
      take: limit,
      order: { flagged_at: 'DESC' },
      relations: [
        'submission',
        'plagiarism_result',
        'flagged_by_user',
        'institution',
      ],
    });

    return { flags, total };
  }

  /**
   * Create a new plagiarism flag
   * @param data - Flag creation data
   * @returns Created plagiarism flag
   */
  async createFlag(data: {
    tenant_id: string;
    institution_id: string;
    submission_id: string;
    plagiarism_result_id: string;
    flagged_by_user_id: string;
    status?: 'FLAGGED' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE';
    action?: string;
    investigation_notes?: string;
  }): Promise<PlagiarismFlag> {
    const flag = this.create({
      tenant_id: data.tenant_id,
      institution_id: data.institution_id,
      submission_id: data.submission_id,
      plagiarism_result_id: data.plagiarism_result_id,
      flagged_by_user_id: data.flagged_by_user_id,
      status: data.status || 'FLAGGED',
      action: data.action || null,
      investigation_notes: data.investigation_notes || null,
      flagged_at: new Date(),
      resolved_at: null,
    });

    return this.save(flag);
  }

  /**
   * Update flag status
   * @param tenantId - Tenant ID
   * @param flagId - Flag ID
   * @param status - New status
   * @returns Updated flag
   */
  async updateStatus(
    tenantId: string,
    flagId: string,
    status: 'FLAGGED' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE',
  ): Promise<PlagiarismFlag | null> {
    const flag = await this.findById(tenantId, flagId);
    if (!flag) {
      return null;
    }

    flag.status = status;

    // Set resolved_at if moving to a terminal state
    if (status === 'RESOLVED' || status === 'FALSE_POSITIVE') {
      flag.resolved_at = new Date();
    }

    return this.save(flag);
  }

  /**
   * Update investigation notes and action
   * @param tenantId - Tenant ID
   * @param flagId - Flag ID
   * @param notes - Investigation notes
   * @param action - Action taken
   * @returns Updated flag
   */
  async updateInvestigation(
    tenantId: string,
    flagId: string,
    notes: string,
    action: string,
  ): Promise<PlagiarismFlag | null> {
    const flag = await this.findById(tenantId, flagId);
    if (!flag) {
      return null;
    }

    flag.investigation_notes = notes;
    flag.action = action;

    return this.save(flag);
  }

  /**
   * Resolve flag with final action
   * @param tenantId - Tenant ID
   * @param flagId - Flag ID
   * @param action - Final action taken
   * @param notes - Investigation notes
   * @returns Updated flag
   */
  async resolveFlag(
    tenantId: string,
    flagId: string,
    action: string,
    notes: string,
  ): Promise<PlagiarismFlag | null> {
    const flag = await this.findById(tenantId, flagId);
    if (!flag) {
      return null;
    }

    flag.status = 'RESOLVED';
    flag.action = action;
    flag.investigation_notes = notes;
    flag.resolved_at = new Date();

    return this.save(flag);
  }

  /**
   * Dismiss flag as false positive
   * @param tenantId - Tenant ID
   * @param flagId - Flag ID
   * @param notes - Reason for dismissal
   * @returns Updated flag
   */
  async dismissFlag(
    tenantId: string,
    flagId: string,
    notes: string,
  ): Promise<PlagiarismFlag | null> {
    const flag = await this.findById(tenantId, flagId);
    if (!flag) {
      return null;
    }

    flag.status = 'FALSE_POSITIVE';
    flag.action = 'Dismissed as false positive';
    flag.investigation_notes = notes;
    flag.resolved_at = new Date();

    return this.save(flag);
  }

  /**
   * Count flags by status
   * @param tenantId - Tenant ID
   * @returns Object with counts by status
   */
  async countByStatus(tenantId: string): Promise<{
    flagged: number;
    investigating: number;
    resolved: number;
    falsePositive: number;
  }> {
    const [flagged, investigating, resolved, falsePositive] = await Promise.all([
      this.count({
        where: {
          tenant_id: tenantId,
          status: 'FLAGGED',
        },
      }),
      this.count({
        where: {
          tenant_id: tenantId,
          status: 'INVESTIGATING',
        },
      }),
      this.count({
        where: {
          tenant_id: tenantId,
          status: 'RESOLVED',
        },
      }),
      this.count({
        where: {
          tenant_id: tenantId,
          status: 'FALSE_POSITIVE',
        },
      }),
    ]);

    return { flagged, investigating, resolved, falsePositive };
  }

  /**
   * Get flags awaiting resolution (FLAGGED or INVESTIGATING)
   * @param tenantId - Tenant ID
   * @returns Array of unresolved flags
   */
  async findUnresolved(tenantId: string): Promise<PlagiarismFlag[]> {
    return this.find({
      where: [
        { tenant_id: tenantId, status: 'FLAGGED' },
        { tenant_id: tenantId, status: 'INVESTIGATING' },
      ],
      order: { flagged_at: 'ASC' },
      relations: [
        'submission',
        'plagiarism_result',
        'flagged_by_user',
        'institution',
      ],
    });
  }

  /**
   * Find flags flagged by a specific user
   * @param tenantId - Tenant ID
   * @param userId - User ID (who flagged)
   * @returns Array of flags flagged by this user
   */
  async findByFlaggedByUserId(
    tenantId: string,
    userId: string,
  ): Promise<PlagiarismFlag[]> {
    return this.find({
      where: {
        tenant_id: tenantId,
        flagged_by_user_id: userId,
      },
      order: { flagged_at: 'DESC' },
      relations: [
        'submission',
        'plagiarism_result',
        'flagged_by_user',
        'institution',
      ],
    });
  }

  /**
   * Get flag statistics
   * @param tenantId - Tenant ID
   * @returns Statistics object
   */
  async getStats(tenantId: string): Promise<{
    totalFlags: number;
    unresolvedCount: number;
    resolutionRate: number; // percentage
    avgResolutionTime: number; // in hours
  }> {
    const flags = await this.find({
      where: {
        tenant_id: tenantId,
      },
    });

    if (flags.length === 0) {
      return {
        totalFlags: 0,
        unresolvedCount: 0,
        resolutionRate: 0,
        avgResolutionTime: 0,
      };
    }

    const unresolvedCount = flags.filter(
      (f) => f.status === 'FLAGGED' || f.status === 'INVESTIGATING',
    ).length;

    const resolvedFlags = flags.filter(
      (f) => f.status === 'RESOLVED' || f.status === 'FALSE_POSITIVE',
    );

    const resolutionRate = (resolvedFlags.length / flags.length) * 100;

    let avgResolutionTime = 0;
    if (resolvedFlags.length > 0) {
      const totalResolutionTime = resolvedFlags.reduce((sum, flag) => {
        if (flag.resolved_at) {
          const hours =
            (flag.resolved_at.getTime() - flag.flagged_at.getTime()) /
            (1000 * 60 * 60);
          return sum + hours;
        }
        return sum;
      }, 0);
      avgResolutionTime = totalResolutionTime / resolvedFlags.length;
    }

    return {
      totalFlags: flags.length,
      unresolvedCount,
      resolutionRate,
      avgResolutionTime,
    };
  }
}
