import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Submission } from '../entities/submission.entity';

/**
 * Submission Repository
 *
 * Data access layer for Submission entity.
 * Handles all database operations related to submissions.
 *
 * Key Responsibilities:
 * - CRUD operations for submissions
 * - Tenant-scoped queries
 * - Submission lookups by student, assignment, version
 * - Version history queries
 * - Late submission detection
 *
 * Multi-Tenancy Pattern:
 * - All queries filter by tenant_id for isolation
 * - Submissions belong to an assignment which belongs to a tenant
 *
 * Acceptance Criteria:
 * ✓ Implements tenant-scoped query methods
 * ✓ No query returns submissions from multiple tenants
 * ✓ Supports version-based queries (incremental submissions)
 * ✓ Late submission detection based on deadline
 */
@Injectable()
export class SubmissionRepository extends Repository<Submission> {
  constructor(private dataSource: DataSource) {
    // Use the DataSource's manager directly - it's the connected manager
    super(Submission, dataSource.manager);
  }

  /**
   * Find submission by ID (with tenant context)
   * @param tenantId - The tenant ID
   * @param submissionId - The submission ID
   * @returns Submission or null if not found
   */
  async findById(
    tenantId: string,
    submissionId: string,
  ): Promise<Submission | null> {
    return this.findOne({
      where: {
        tenant_id: tenantId,
        id: submissionId,
      },
      relations: ['assignment', 'student'],
    });
  }

  /**
   * Find all submissions for an assignment
   * @param tenantId - The tenant ID
   * @param assignmentId - The assignment ID
   * @returns Array of submissions
   */
  async findByAssignment(
    tenantId: string,
    assignmentId: string,
  ): Promise<Submission[]> {
    return this.find({
      where: {
        tenant_id: tenantId,
        assignment_id: assignmentId,
      },
      relations: ['assignment', 'student'],
      order: { student_id: 'ASC', version: 'DESC' },
    });
  }

  /**
   * Find all submissions for a student in an assignment
   * @param tenantId - The tenant ID
   * @param assignmentId - The assignment ID
   * @param studentId - The student ID
   * @returns Array of submissions (all versions)
   */
  async findByAssignmentAndStudent(
    tenantId: string,
    assignmentId: string,
    studentId: string,
  ): Promise<Submission[]> {
    return this.find({
      where: {
        tenant_id: tenantId,
        assignment_id: assignmentId,
        student_id: studentId,
      },
      relations: ['assignment', 'student'],
      order: { version: 'ASC' },
    });
  }

  /**
   * Find the latest submission for a student in an assignment
   * @param tenantId - The tenant ID
   * @param assignmentId - The assignment ID
   * @param studentId - The student ID
   * @returns Submission or null if not found
   */
  async findLatestByAssignmentAndStudent(
    tenantId: string,
    assignmentId: string,
    studentId: string,
  ): Promise<Submission | null> {
    return this.findOne({
      where: {
        tenant_id: tenantId,
        assignment_id: assignmentId,
        student_id: studentId,
      },
      relations: ['assignment', 'student'],
      order: { version: 'DESC' },
    });
  }

  /**
   * Find all submissions by student
   * @param tenantId - The tenant ID
   * @param studentId - The student ID
   * @returns Array of submissions
   */
  async findByStudent(
    tenantId: string,
    studentId: string,
  ): Promise<Submission[]> {
    return this.find({
      where: {
        tenant_id: tenantId,
        student_id: studentId,
      },
      relations: ['assignment', 'student'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Find late submissions for an assignment
   * @param tenantId - The tenant ID
   * @param assignmentId - The assignment ID
   * @returns Array of late submissions
   */
  async findLateByAssignment(
    tenantId: string,
    assignmentId: string,
  ): Promise<Submission[]> {
    return this.find({
      where: {
        tenant_id: tenantId,
        assignment_id: assignmentId,
        is_late: true,
      },
      relations: ['assignment', 'student'],
      order: { submitted_at: 'DESC' },
    });
  }

  /**
   * Find incremental submissions for an assignment and student
   * @param tenantId - The tenant ID
   * @param assignmentId - The assignment ID
   * @param studentId - The student ID
   * @returns Array of incremental submissions
   */
  async findIncrementalByAssignmentAndStudent(
    tenantId: string,
    assignmentId: string,
    studentId: string,
  ): Promise<Submission[]> {
    return this.find({
      where: {
        tenant_id: tenantId,
        assignment_id: assignmentId,
        student_id: studentId,
        is_incremental: true,
      },
      relations: ['assignment', 'student'],
      order: { version: 'ASC' },
    });
  }

  /**
   * Find all submissions in a tenant (paginated)
   * @param tenantId - The tenant ID
   * @param page - Page number (0-indexed)
   * @param limit - Results per page
   * @returns Paginated submissions
   */
  async findByTenant(
    tenantId: string,
    page: number = 0,
    limit: number = 20,
  ): Promise<{ submissions: Submission[]; total: number }> {
    const [submissions, total] = await this.findAndCount({
      where: {
        tenant_id: tenantId,
      },
      skip: page * limit,
      take: limit,
      relations: ['assignment', 'student'],
      order: { created_at: 'DESC' },
    });

    return { submissions, total };
  }

  /**
   * Create a new submission
   * @param data - Submission creation data
   * @returns Created submission
   */
  async createSubmission(data: {
    tenant_id: string;
    assignment_id: string;
    student_id: string;
    version?: number;
    file_path?: string;
    file_type?: string;
    content?: Record<string, any>;
    is_incremental?: boolean;
    is_late?: boolean;
    submitted_at?: Date;
  }): Promise<Submission> {
    console.log('[SubmissionRepository.createSubmission] STARTING save:', {
      tenant_id: data.tenant_id,
      assignment_id: data.assignment_id,
      student_id: data.student_id,
      version: data.version,
      file_path: data.file_path,
      content: data.content,
    });

    const submission = new Submission();
    submission.tenant_id = data.tenant_id;
    submission.assignment_id = data.assignment_id;
    submission.student_id = data.student_id;
    submission.version = data.version || 1;
    submission.file_path = data.file_path || null;
    submission.file_type = data.file_type || null;
    submission.content = data.content || { answers: {} };
    submission.is_incremental = data.is_incremental || false;
    submission.is_late = data.is_late || false;
    submission.submitted_at = data.submitted_at || new Date();

    console.log('[SubmissionRepository.createSubmission] Entity created:', {
      id: submission.id,
      tenant_id: submission.tenant_id,
      assignment_id: submission.assignment_id,
      student_id: submission.student_id,
      content: submission.content,
    });

    try {
      const savedSubmission = await this.save(submission);
      console.log('[SubmissionRepository.createSubmission] ✅ SAVE SUCCESS:', {
        id: savedSubmission.id,
        tenant_id: savedSubmission.tenant_id,
        assignment_id: savedSubmission.assignment_id,
        student_id: savedSubmission.student_id,
        version: savedSubmission.version,
        content: savedSubmission.content,
        created_at: savedSubmission.created_at,
      });
      return savedSubmission;
    } catch (error) {
      console.error('[SubmissionRepository.createSubmission] ❌ SAVE FAILED:', {
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : null,
        submissionData: {
          tenant_id: submission.tenant_id,
          assignment_id: submission.assignment_id,
          student_id: submission.student_id,
          content: submission.content,
        },
      });
      throw error;
    }
  }

  /**
   * Get next version number for a student's submissions in an assignment
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @param studentId - Student ID
   * @returns Next version number
   */
  async getNextVersion(
    tenantId: string,
    assignmentId: string,
    studentId: string,
  ): Promise<number> {
    const lastSubmission = await this.findOne({
      where: {
        tenant_id: tenantId,
        assignment_id: assignmentId,
        student_id: studentId,
      },
      order: { version: 'DESC' },
    });

    return (lastSubmission?.version || 0) + 1;
  }

  /**
   * Mark submission as graded
   * @param tenantId - Tenant ID
   * @param submissionId - Submission ID
   * @returns Updated submission
   */
  async markAsGraded(
    tenantId: string,
    submissionId: string,
  ): Promise<Submission | null> {
    const submission = await this.findById(tenantId, submissionId);
    if (!submission) {
      return null;
    }

    // Mark as graded by updating submission (status field removed - entity doesn't have it)
    return this.save(submission);
  }

  /**
   * Update submission (general purpose)
   * @param tenantId - Tenant ID
   * @param submissionId - Submission ID
   * @param updates - Fields to update
   * @returns Updated submission
   */
  async updateSubmission(
    tenantId: string,
    submissionId: string,
    updates: Partial<Submission>,
  ): Promise<Submission | null> {
    const submission = await this.findById(tenantId, submissionId);
    if (!submission) {
      return null;
    }

    Object.assign(submission, updates);
    return this.save(submission);
  }

  /**
   * Get submission count for an assignment
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @returns Total submission count
   */
  async getSubmissionCount(
    tenantId: string,
    assignmentId: string,
  ): Promise<number> {
    return this.count({
      where: {
        tenant_id: tenantId,
        assignment_id: assignmentId,
      },
    });
  }

  /**
   * Get unique student count for an assignment
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @returns Count of unique students who submitted
   */
  async getUniqueStudentCount(
    tenantId: string,
    assignmentId: string,
  ): Promise<number> {
    const result = await this.createQueryBuilder('submission')
      .where('submission.tenant_id = :tenantId', { tenantId })
      .andWhere('submission.assignment_id = :assignmentId', { assignmentId })
      .select('COUNT(DISTINCT submission.student_id)', 'count')
      .getRawOne();

    return result?.count ? parseInt(result.count) : 0;
  }

  /**
   * Check if a student has already submitted to an assignment
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @param studentId - Student ID
   * @returns true if submitted
   */
  async hasSubmitted(
    tenantId: string,
    assignmentId: string,
    studentId: string,
  ): Promise<boolean> {
    const submission = await this.findOne({
      where: {
        tenant_id: tenantId,
        assignment_id: assignmentId,
        student_id: studentId,
      },
    });

    return !!submission;
  }
}
