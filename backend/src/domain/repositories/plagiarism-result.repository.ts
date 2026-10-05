import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { PlagiarismResult } from '../entities/plagiarism-result.entity';

/**
 * Plagiarism Result Repository
 *
 * Data access layer for PlagiarismResult entity.
 * Handles all database operations related to plagiarism scan results.
 *
 * Key Responsibilities:
 * - CRUD operations for plagiarism results
 * - Tenant-scoped queries ensuring multi-tenancy isolation
 * - Plagiarism lookups by submission, assignment, status
 * - Score-based filtering (threshold queries)
 * - External scan ID tracking (Turnitin, local corpus, AI detection)
 *
 * Multi-Tenancy Pattern:
 * - All queries filter by tenant_id for isolation
 * - Results belong to a submission which belongs to an assignment which belongs to a tenant
 *
 * Acceptance Criteria:
 * ✓ Implements tenant-scoped query methods
 * ✓ No query returns results from multiple tenants
 * ✓ Supports score-based filtering (above/below threshold)
 * ✓ Tracks plagiarism_score, ai_generation_score, source_matches
 * ✓ Status tracking: PENDING, COMPLETED, FAILED
 * ✓ External scan ID (turnitin_scan_id) support
 *
 * Requirement 9: Plagiarism Detection
 */
@Injectable()
export class PlagiarismResultRepository extends Repository<PlagiarismResult> {
  constructor(private dataSource: DataSource) {
    super(PlagiarismResult, dataSource.manager);
  }

  /**
   * Find plagiarism result by ID (with tenant context)
   * @param tenantId - The tenant ID
   * @param resultId - The plagiarism result ID
   * @returns PlagiarismResult or null if not found
   */
  async findById(
    tenantId: string,
    resultId: string,
  ): Promise<PlagiarismResult | null> {
    return this.findOne({
      where: {
        tenant_id: tenantId,
        id: resultId,
      },
      relations: ['submission', 'assignment', 'institution', 'plagiarism_flags'],
    });
  }

  /**
   * Find plagiarism result by submission ID
   * @param tenantId - The tenant ID
   * @param submissionId - The submission ID
   * @returns Most recent plagiarism result for submission
   */
  async findBySubmissionId(
    tenantId: string,
    submissionId: string,
  ): Promise<PlagiarismResult | null> {
    return this.findOne({
      where: {
        tenant_id: tenantId,
        submission_id: submissionId,
      },
      order: { created_at: 'DESC' },
      relations: ['submission', 'assignment', 'institution'],
    });
  }

  /**
   * Find completed plagiarism result by submission ID
   * Returns only COMPLETED results
   * @param tenantId - The tenant ID
   * @param submissionId - The submission ID
   * @returns PlagiarismResult or null if not found or not completed
   */
  async findCompletedBySubmissionId(
    tenantId: string,
    submissionId: string,
  ): Promise<PlagiarismResult | null> {
    return this.findOne({
      where: {
        tenant_id: tenantId,
        submission_id: submissionId,
        status: 'COMPLETED',
      },
      relations: ['submission', 'assignment', 'institution'],
    });
  }

  /**
   * Find all plagiarism results for an assignment
   * @param tenantId - The tenant ID
   * @param assignmentId - The assignment ID
   * @returns Array of plagiarism results
   */
  async findByAssignmentId(
    tenantId: string,
    assignmentId: string,
  ): Promise<PlagiarismResult[]> {
    return this.find({
      where: {
        tenant_id: tenantId,
        assignment_id: assignmentId,
      },
      order: { created_at: 'DESC' },
      relations: ['submission', 'assignment'],
    });
  }

  /**
   * Find plagiarism results by assignment and above threshold score
   * @param tenantId - The tenant ID
   * @param assignmentId - The assignment ID
   * @param threshold - Plagiarism score threshold (0-100)
   * @returns Array of results above threshold
   */
  async findAboveThresholdByAssignment(
    tenantId: string,
    assignmentId: string,
    threshold: number,
  ): Promise<PlagiarismResult[]> {
    return this.find({
      where: {
        tenant_id: tenantId,
        assignment_id: assignmentId,
        status: 'COMPLETED',
      },
      relations: ['submission', 'assignment'],
      order: { overall_score: 'DESC', created_at: 'DESC' },
    }).then((results) =>
      results.filter((r) => parseFloat(r.overall_score.toString()) >= threshold),
    );
  }

  /**
   * Find plagiarism results by assignment and AI generation score threshold
   * @param tenantId - The tenant ID
   * @param assignmentId - The assignment ID
   * @param threshold - AI generation score threshold (0-100)
   * @returns Array of results above threshold
   */
  async findAboveAIThresholdByAssignment(
    tenantId: string,
    assignmentId: string,
    threshold: number,
  ): Promise<PlagiarismResult[]> {
    return this.find({
      where: {
        tenant_id: tenantId,
        assignment_id: assignmentId,
        status: 'COMPLETED',
      },
      relations: ['submission', 'assignment'],
      order: { ai_generation_score: 'DESC', created_at: 'DESC' },
    }).then((results) =>
      results.filter(
        (r) => parseFloat(r.ai_generation_score.toString()) >= threshold,
      ),
    );
  }

  /**
   * Find pending plagiarism scans
   * @param tenantId - The tenant ID
   * @param limit - Maximum results to return
   * @returns Array of pending results
   */
  async findPending(tenantId: string, limit: number = 50): Promise<PlagiarismResult[]> {
    return this.find({
      where: {
        tenant_id: tenantId,
        status: 'PENDING',
      },
      order: { created_at: 'ASC' },
      take: limit,
      relations: ['submission', 'assignment'],
    });
  }

  /**
   * Find failed plagiarism scans
   * @param tenantId - The tenant ID
   * @param limit - Maximum results to return
   * @returns Array of failed results
   */
  async findFailed(tenantId: string, limit: number = 50): Promise<PlagiarismResult[]> {
    return this.find({
      where: {
        tenant_id: tenantId,
        status: 'FAILED',
      },
      order: { created_at: 'DESC' },
      take: limit,
      relations: ['submission', 'assignment'],
    });
  }

  /**
   * Find all plagiarism results in a tenant (paginated)
   * @param tenantId - The tenant ID
   * @param page - Page number (0-indexed)
   * @param limit - Results per page
   * @returns Paginated results
   */
  async findByTenant(
    tenantId: string,
    page: number = 0,
    limit: number = 20,
  ): Promise<{ results: PlagiarismResult[]; total: number }> {
    const [results, total] = await this.findAndCount({
      where: {
        tenant_id: tenantId,
      },
      skip: page * limit,
      take: limit,
      order: { created_at: 'DESC' },
      relations: ['submission', 'assignment'],
    });

    return { results, total };
  }

  /**
   * Create a new plagiarism result
   * @param data - Result creation data
   * @returns Created plagiarism result
   */
  async createResult(data: {
    tenant_id: string;
    institution_id: string;
    submission_id: string;
    assignment_id: string;
    overall_score?: number;
    ai_generation_score?: number;
    turnitin_scan_id?: string;
    source_matches?: any[];
    status?: 'PENDING' | 'COMPLETED' | 'FAILED';
  }): Promise<PlagiarismResult> {
    const result = this.create({
      tenant_id: data.tenant_id,
      institution_id: data.institution_id,
      submission_id: data.submission_id,
      assignment_id: data.assignment_id,
      overall_score: data.overall_score ?? 0,
      ai_generation_score: data.ai_generation_score ?? 0,
      turnitin_scan_id: data.turnitin_scan_id || null,
      source_matches: data.source_matches || [],
      status: data.status || 'PENDING',
      scanned_at: null,
    });

    return this.save(result);
  }

  /**
   * Update plagiarism result status and scores
   * @param tenantId - Tenant ID
   * @param resultId - Result ID
   * @param updates - Fields to update
   * @returns Updated result
   */
  async updateResult(
    tenantId: string,
    resultId: string,
    updates: {
      overall_score?: number;
      ai_generation_score?: number;
      status?: 'PENDING' | 'COMPLETED' | 'FAILED';
      source_matches?: any[];
      turnitin_scan_id?: string;
      scanned_at?: Date;
    },
  ): Promise<PlagiarismResult | null> {
    const result = await this.findById(tenantId, resultId);
    if (!result) {
      return null;
    }

    Object.assign(result, updates);
    return this.save(result);
  }

  /**
   * Mark result as completed with scores
   * @param tenantId - Tenant ID
   * @param resultId - Result ID
   * @param overallScore - Plagiarism score (0-100)
   * @param aiScore - AI generation score (0-100)
   * @param sourceMatches - Array of source matches
   * @param turnitinScanId - External scan ID (optional)
   * @returns Updated result
   */
  async markAsCompleted(
    tenantId: string,
    resultId: string,
    overallScore: number,
    aiScore: number,
    sourceMatches: any[] = [],
    turnitinScanId?: string,
  ): Promise<PlagiarismResult | null> {
    return this.updateResult(tenantId, resultId, {
      overall_score: Math.min(100, Math.max(0, overallScore)),
      ai_generation_score: Math.min(100, Math.max(0, aiScore)),
      source_matches: sourceMatches,
      status: 'COMPLETED',
      scanned_at: new Date(),
      turnitin_scan_id: turnitinScanId,
    });
  }

  /**
   * Mark result as failed
   * @param tenantId - Tenant ID
   * @param resultId - Result ID
   * @returns Updated result
   */
  async markAsFailed(
    tenantId: string,
    resultId: string,
  ): Promise<PlagiarismResult | null> {
    return this.updateResult(tenantId, resultId, {
      status: 'FAILED',
      scanned_at: new Date(),
    });
  }

  /**
   * Get plagiarism statistics for an assignment
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @returns Statistics object
   */
  async getStatsByAssignment(
    tenantId: string,
    assignmentId: string,
  ): Promise<{
    totalScanned: number;
    avgPlagiarismScore: number;
    avgAiScore: number;
    maxPlagiarismScore: number;
    maxAiScore: number;
  }> {
    const results = await this.find({
      where: {
        tenant_id: tenantId,
        assignment_id: assignmentId,
        status: 'COMPLETED',
      },
    });

    if (results.length === 0) {
      return {
        totalScanned: 0,
        avgPlagiarismScore: 0,
        avgAiScore: 0,
        maxPlagiarismScore: 0,
        maxAiScore: 0,
      };
    }

    const plagiarismScores = results.map((r) =>
      parseFloat(r.overall_score.toString()),
    );
    const aiScores = results.map((r) => parseFloat(r.ai_generation_score.toString()));

    return {
      totalScanned: results.length,
      avgPlagiarismScore:
        plagiarismScores.reduce((a, b) => a + b, 0) / results.length,
      avgAiScore: aiScores.reduce((a, b) => a + b, 0) / results.length,
      maxPlagiarismScore: Math.max(...plagiarismScores),
      maxAiScore: Math.max(...aiScores),
    };
  }

  /**
   * Delete old plagiarism results (for cleanup)
   * @param tenantId - Tenant ID
   * @param olderThanDays - Delete results older than this many days
   * @returns Number of deleted results
   */
  async deleteOlderThan(
    tenantId: string,
    olderThanDays: number = 90,
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.delete({
      tenant_id: tenantId,
      created_at: LessThan(cutoffDate),
    } as any);

    return result.affected || 0;
  }
}

// Import LessThan for date comparison
import { LessThan } from 'typeorm';
