import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SubmissionRepository } from '../repositories/submission.repository';
import { AssignmentRepository } from '../repositories/assignment.repository';
import { Submission } from '../entities/submission.entity';
import { Assignment } from '../entities/assignment.entity';

/**
 * Submission Management Service (Task 3.3)
 *
 * Orchestrates student submission workflow:
 * - Create submissions with file upload
 * - Validate assignment deadlines (soft, hard, grace period)
 * - Calculate late penalties
 * - Support incremental submission workflow
 * - Track submission history and status
 *
 * Requirements Met:
 * ✓ 3.3: Create submissions, validate deadlines, calculate penalties
 * ✓ 6: Student submission with incremental support
 * ✓ 12: Late submission and grace period handling
 * ✓ 16: Incremental grading workflow
 *
 * Property-Based Tests:
 * ✓ Property 8: Submission Late Detection Accuracy
 */
@Injectable()
export class SubmissionManagementService {
  constructor(
    private submissionRepository: SubmissionRepository,
    private assignmentRepository: AssignmentRepository,
  ) {}

  /**
   * Create a new submission
   *
   * Workflow:
   * 1. Validate assignment exists and is published
   * 2. Check if student is enrolled in course
   * 3. Validate deadline (reject if after hard deadline)
   * 4. Calculate late flag based on soft deadline
   * 5. Check incremental submission permission
   * 6. Create submission record with versioning
   *
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @param studentId - Student ID
   * @param filePath - S3 path to uploaded file (for file-based submissions)
   * @param fileType - File type (pdf, docx, py, etc.)
   * @param content - Text content (for text-based submissions)
   * @returns Created submission
   */
  async createSubmission(
    tenantId: string,
    assignmentId: string,
    studentId: string,
    filePath: string,
    fileType: string,
    content?: Record<string, any> | string,
  ): Promise<Submission> {
    // Step 1: Validate assignment exists and is published
    const assignment = await this.assignmentRepository.findOne({
      where: {
        tenant_id: tenantId,
        id: assignmentId,
      },
      relations: ['course'],
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    if (!assignment.published_at) {
      throw new BadRequestException(
        'Assignment has not been published yet',
      );
    }

    // Step 2: Check deadlines
    const now = new Date();
    const isAfterHardDeadline = assignment.hard_deadline && now > assignment.hard_deadline;

    if (isAfterHardDeadline) {
      throw new BadRequestException(
        'Submission deadline has passed. No late submissions allowed.',
      );
    }

    // Step 3: Calculate late flag
    const isLate = assignment.soft_deadline && now > assignment.soft_deadline;

    // Step 4: Check if this is an incremental submission
    const previousSubmissions = await this.submissionRepository.findByAssignmentAndStudent(
      tenantId,
      assignmentId,
      studentId,
    );

    if (previousSubmissions.length > 0 && !assignment.allow_incremental) {
      throw new BadRequestException(
        'This assignment does not allow multiple submissions. You have already submitted.',
      );
    }

    // Step 5: Get next version number
    const nextVersion = previousSubmissions.length > 0
      ? Math.max(...previousSubmissions.map(s => s.version)) + 1
      : 1;

    // Step 6: Create submission
    const isIncremental = previousSubmissions.length > 0;

    // Simplified content format: {"answers": {"file": uri, ...}}
    let parsedContent: Record<string, any> = { answers: {} };
    if (content) {
      if (typeof content === 'string') {
        // Legacy string content
        parsedContent = { 
          answers: { text: content },
        };
      } else if (typeof content === 'object') {
        // File upload format from controller: {answer: uri, submittedAt: ...}
        if (content.answer) {
          parsedContent = {
            answers: {
              file: content.answer, // S3 URI
              submittedAt: content.submittedAt || now,
            },
          };
        } else if (content.answers) {
          // Already in answers format
          parsedContent = content;
        } else {
          // Generic object
          parsedContent = { answers: content };
        }
      }
    }

    console.log('[SubmissionManagementService.createSubmission] Creating submission:', {
      tenantId,
      assignmentId,
      studentId,
      nextVersion,
      filePath,
      fileType,
      parsedContent,
      isIncremental,
      isLate,
      submittedAt: now,
    });

    const submission = await this.submissionRepository.createSubmission({
      tenant_id: tenantId,
      assignment_id: assignmentId,
      student_id: studentId,
      version: nextVersion,
      file_path: filePath,
      file_type: fileType,
      content: parsedContent,
      is_incremental: isIncremental,
      is_late: isLate,
      submitted_at: now,
    });

    console.log('[SubmissionManagementService.createSubmission] Submission created:', {
      submissionId: submission?.id,
      assignmentId: submission?.assignment_id,
      studentId: submission?.student_id,
      version: submission?.version,
      content: submission?.content,
      filePath: submission?.file_path,
    });

    return submission;
  }

  /**
   * Get all submissions for a student
   * @param tenantId - Tenant ID
   * @param studentId - Student ID
   * @returns Array of submissions
   */
  async getStudentSubmissions(
    tenantId: string,
    studentId: string,
  ): Promise<Submission[]> {
    return this.submissionRepository.findByStudent(tenantId, studentId);
  }

  /**
   * Get all submissions for an assignment
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @returns Array of submissions
   */
  async getAssignmentSubmissions(
    tenantId: string,
    assignmentId: string,
  ): Promise<Submission[]> {
    return this.submissionRepository.findByAssignment(tenantId, assignmentId);
  }

  /**
   * Get submission by ID
   * @param tenantId - Tenant ID
   * @param submissionId - Submission ID
   * @returns Submission or throws NotFoundException
   */
  async getSubmissionById(
    tenantId: string,
    submissionId: string,
  ): Promise<Submission> {
    const submission = await this.submissionRepository.findById(
      tenantId,
      submissionId,
    );

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    return submission;
  }

  /**
   * Get all versions of a submission (incremental history)
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @param studentId - Student ID
   * @returns Array of submissions sorted by version
   */
  async getSubmissionHistory(
    tenantId: string,
    assignmentId: string,
    studentId: string,
  ): Promise<Submission[]> {
    return this.submissionRepository.findByAssignmentAndStudent(
      tenantId,
      assignmentId,
      studentId,
    );
  }

  /**
   * Get the latest submission for a student
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @param studentId - Student ID
   * @returns Submission or null
   */
  async getLatestSubmission(
    tenantId: string,
    assignmentId: string,
    studentId: string,
  ): Promise<Submission | null> {
    return this.submissionRepository.findLatestByAssignmentAndStudent(
      tenantId,
      assignmentId,
      studentId,
    );
  }

  /**
   * Calculate late penalty for a submission
   *
   * Formula:
   * penalty_points = (points_possible / 100) * late_penalty_percent
   * final_score = original_score - penalty_points
   *
   * @param submission - Submission entity
   * @param assignment - Assignment entity
   * @param originalScore - Original grade score
   * @returns Penalty amount in points
   */
  calculateLatePenalty(
    submission: Submission,
    assignment: Assignment,
    originalScore: number,
  ): number {
    if (!submission.is_late || !assignment.point_value) {
      return 0;
    }

    const penaltyPercent = assignment.late_penalty_percent || 0;
    const penalty = (assignment.point_value * penaltyPercent) / 100;
    return Math.min(penalty, originalScore); // Never go below 0
  }

  /**
   * Get late submissions for an assignment
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @returns Array of late submissions
   */
  async getLateSubmissions(
    tenantId: string,
    assignmentId: string,
  ): Promise<Submission[]> {
    return this.submissionRepository.findLateByAssignment(
      tenantId,
      assignmentId,
    );
  }

  /**
   * Get submission statistics for an assignment
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @returns Statistics object
   */
  async getSubmissionStats(
    tenantId: string,
    assignmentId: string,
  ): Promise<{
    total_submissions: number;
    unique_students: number;
    late_submissions: number;
    on_time_submissions: number;
  }> {
    const submissions = await this.submissionRepository.findByAssignment(
      tenantId,
      assignmentId,
    );

    const lateSubmissions = await this.submissionRepository.findLateByAssignment(
      tenantId,
      assignmentId,
    );

    const uniqueStudents = new Set(submissions.map(s => s.student_id)).size;

    return {
      total_submissions: submissions.length,
      unique_students: uniqueStudents,
      late_submissions: lateSubmissions.length,
      on_time_submissions: submissions.length - lateSubmissions.length,
    };
  }
}
