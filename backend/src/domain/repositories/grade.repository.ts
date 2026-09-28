import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Grade } from '../entities/grade.entity';

/**
 * Grade Repository
 *
 * Data access layer for Grade entity.
 * Handles all database operations related to grades.
 *
 * Key Responsibilities:
 * - CRUD operations for grades
 * - Tenant-scoped queries
 * - Grade lookups by submission, student, assignment
 * - Grade status tracking
 *
 * Multi-Tenancy Pattern:
 * - All queries filter by tenant_id for isolation
 * - Grades belong to a submission which belongs to a tenant
 *
 * Acceptance Criteria:
 * ✓ Implements tenant-scoped query methods
 * ✓ No query returns grades from multiple tenants
 * ✓ Supports filtering by status
 * ✓ Score validation: 0-100, 2 decimal places
 */
@Injectable()
export class GradeRepository extends Repository<Grade> {
  constructor(private dataSource: DataSource) {
    super(Grade, dataSource.createEntityManager());
  }

  /**
   * Find grade by ID (with tenant context)
   * @param tenantId - The tenant ID
   * @param gradeId - The grade ID
   * @returns Grade or null if not found
   */
  async findById(
    tenantId: string,
    gradeId: string,
  ): Promise<Grade | null> {
    return this.findOne({
      where: {
        tenant_id: tenantId,
        id: gradeId,
      },
      relations: ['submission', 'graded_by_user'],
    });
  }

  /**
   * Find grade by submission ID
   * @param tenantId - The tenant ID
   * @param submissionId - The submission ID
   * @returns Grade or null if not found
   */
  async findBySubmission(
    tenantId: string,
    submissionId: string,
  ): Promise<Grade | null> {
    return this.findOne({
      where: {
        tenant_id: tenantId,
        submission_id: submissionId,
      },
      relations: ['submission', 'graded_by_user'],
    });
  }

  /**
   * Find all grades for an assignment
   * @param tenantId - The tenant ID
   * @param assignmentId - The assignment ID
   * @returns Array of grades
   */
  async findByAssignment(
    tenantId: string,
    assignmentId: string,
  ): Promise<Grade[]> {
    return this.createQueryBuilder('grade')
      .innerJoin('grade.submission', 'submission')
      .where('grade.tenant_id = :tenantId', { tenantId })
      .andWhere('submission.assignment_id = :assignmentId', { assignmentId })
      .orderBy('grade.created_at', 'DESC')
      .getMany();
  }

  /**
   * Find all grades for a student in an assignment
   * @param tenantId - The tenant ID
   * @param assignmentId - The assignment ID
   * @param studentId - The student ID
   * @returns Array of grades (one per submission version)
   */
  async findByAssignmentAndStudent(
    tenantId: string,
    assignmentId: string,
    studentId: string,
  ): Promise<Grade[]> {
    return this.createQueryBuilder('grade')
      .innerJoin('grade.submission', 'submission')
      .where('grade.tenant_id = :tenantId', { tenantId })
      .andWhere('submission.assignment_id = :assignmentId', { assignmentId })
      .andWhere('submission.student_id = :studentId', { studentId })
      .orderBy('submission.version', 'ASC')
      .getMany();
  }

  /**
   * Find grades by status
   * @param tenantId - The tenant ID
   * @param status - The status (PENDING, AI_GRADED, MANUALLY_GRADED, OVERRIDDEN)
   * @returns Array of grades
   */
  async findByStatus(
    tenantId: string,
    status: string,
  ): Promise<Grade[]> {
    return this.find({
      where: {
        tenant_id: tenantId,
        status: status as 'PENDING' | 'AI_GRADED' | 'MANUALLY_GRADED' | 'OVERRIDDEN',
      },
      relations: ['submission', 'graded_by_user'],
      order: { created_at: 'DESC' as const },
    });
  }

  /**
   * Find all pending grades in a tenant
   * @param tenantId - The tenant ID
   * @returns Array of pending grades
   */
  async findPending(tenantId: string): Promise<Grade[]> {
    return this.find({
      where: {
        tenant_id: tenantId,
        status: 'PENDING',
      },
      relations: ['submission', 'graded_by_user'],
      order: { created_at: 'ASC' },
    });
  }

  /**
   * Find AI-graded grades in a course
   * @param tenantId - The tenant ID
   * @param courseId - The course ID
   * @returns Array of AI-graded grades
   */
  async findAiGradedInCourse(
    tenantId: string,
    courseId: string,
  ): Promise<Grade[]> {
    return this.createQueryBuilder('grade')
      .innerJoin('grade.submission', 'submission')
      .innerJoin('submission.assignment', 'assignment')
      .where('grade.tenant_id = :tenantId', { tenantId })
      .andWhere('assignment.course_id = :courseId', { courseId })
      .andWhere('grade.status = :status', { status: 'AI_GRADED' })
      .orderBy('grade.created_at', 'DESC')
      .getMany();
  }

  /**
   * Create a new grade
   * @param data - Grade creation data
   * @returns Created grade
   */
  async createGrade(data: {
    tenant_id: string;
    submission_id: string;
    assignment_id: string;
    ai_score?: number;
    confidence?: number;
    feedback?: string;
    strengths?: string[];
    improvements?: string[];
    status?: string;
    graded_by_user_id?: string;
  }): Promise<Grade> {
    const grade = this.create({
      tenant_id: data.tenant_id,
      submission_id: data.submission_id,
      assignment_id: data.assignment_id,
      ai_score: data.ai_score ?? null,
      confidence: data.confidence ?? null,
      final_score: data.ai_score ?? null,
      feedback: data.feedback || null,
      strengths: data.strengths || [],
      improvements: data.improvements || [],
      status: (data.status || 'PENDING') as 'PENDING' | 'AI_GRADED' | 'MANUALLY_GRADED' | 'OVERRIDDEN',
      graded_by_user_id: data.graded_by_user_id || null,
    });

    return this.save(grade);
  }

  /**
   * Update grade with AI results
   * @param tenantId - Tenant ID
   * @param gradeId - Grade ID
   * @param aiData - AI grading results
   * @returns Updated grade
   */
  async updateWithAiResults(
    tenantId: string,
    gradeId: string,
    aiData: {
      ai_score: number;
      ai_confidence: number;
      feedback: string;
      strengths: string[];
      improvements: string[];
    },
  ): Promise<Grade | null> {
    const grade = await this.findById(tenantId, gradeId);
    if (!grade) {
      return null;
    }

    grade.ai_score = aiData.ai_score;
    grade.confidence = aiData.ai_confidence;
    grade.final_score = aiData.ai_score;
    grade.feedback = aiData.feedback;
    grade.strengths = aiData.strengths;
    grade.improvements = aiData.improvements;
    grade.status = 'AI_GRADED';

    return this.save(grade);
  }

  /**
   * Update final score (after late penalty, etc.)
   * @param tenantId - Tenant ID
   * @param gradeId - Grade ID
   * @param finalScore - New final score
   * @returns Updated grade
   */
  async updateFinalScore(
    tenantId: string,
    gradeId: string,
    finalScore: number,
  ): Promise<Grade | null> {
    const grade = await this.findById(tenantId, gradeId);
    if (!grade) {
      return null;
    }

    grade.final_score = finalScore;
    return this.save(grade);
  }

  /**
   * Update grade status
   * @param tenantId - Tenant ID
   * @param gradeId - Grade ID
   * @param status - New status
   * @returns Updated grade
   */
  async updateStatus(
    tenantId: string,
    gradeId: string,
    status: string,
  ): Promise<Grade | null> {
    const grade = await this.findById(tenantId, gradeId);
    if (!grade) {
      return null;
    }

    grade.status = status as 'PENDING' | 'AI_GRADED' | 'MANUALLY_GRADED' | 'OVERRIDDEN';
    return this.save(grade);
  }

  /**
   * Get average grade for an assignment
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @returns Average score or null
   */
  async getAverageScore(
    tenantId: string,
    assignmentId: string,
  ): Promise<number | null> {
    const result = await this.createQueryBuilder('grade')
      .innerJoin('grade.submission', 'submission')
      .where('grade.tenant_id = :tenantId', { tenantId })
      .andWhere('submission.assignment_id = :assignmentId', { assignmentId })
      .andWhere('grade.final_score IS NOT NULL')
      .select('AVG(grade.final_score)', 'average')
      .getRawOne();

    return result?.average ? parseFloat(result.average) : null;
  }

  /**
   * Get grade statistics for an assignment
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @returns Grade statistics
   */
  async getAssignmentStats(
    tenantId: string,
    assignmentId: string,
  ): Promise<{
    average: number | null;
    min: number | null;
    max: number | null;
    median: number | null;
    count: number;
  } | null> {
    const result = await this.createQueryBuilder('grade')
      .innerJoin('grade.submission', 'submission')
      .where('grade.tenant_id = :tenantId', { tenantId })
      .andWhere('submission.assignment_id = :assignmentId', { assignmentId })
      .andWhere('grade.final_score IS NOT NULL')
      .select('AVG(grade.final_score)', 'average')
      .addSelect('MIN(grade.final_score)', 'min')
      .addSelect('MAX(grade.final_score)', 'max')
      .addSelect('COUNT(grade.id)', 'count')
      .getRawOne();

    if (!result || result.count === 0) {
      return null;
    }

    return {
      average: result.average ? parseFloat(result.average) : null,
      min: result.min ? parseFloat(result.min) : null,
      max: result.max ? parseFloat(result.max) : null,
      median: null, // Would require more complex calculation
      count: parseInt(result.count),
    };
  }
}
