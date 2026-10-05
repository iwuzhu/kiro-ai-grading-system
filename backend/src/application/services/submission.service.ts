import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Submission } from '../../domain/entities/submission.entity';
import { Assignment } from '../../domain/entities/assignment.entity';
import { SubmissionRepository } from '../../domain/repositories/submission.repository';
import { AssignmentRepository } from '../../domain/repositories/assignment.repository';
import { FileService } from '../../infrastructure/storage/file.service';
import {
  AnswerValidator,
  AnswerValidationError,
} from '../../domain/value-objects/question.validator';
import {
  Answer,
  SubmissionContent,
  AssignmentContent,
  FileUploadAnswer,
  Question,
} from '../../domain/value-objects/question.types';

/**
 * Submission Service
 *
 * Application service for submission handling:
 * - Create and update submissions
 * - Accept and validate student answers
 * - Upload answer files (for FILE_UPLOAD questions)
 * - Track submission status and progress
 * - Handle incremental submissions
 *
 * Business Logic:
 * - Validates answers against question requirements
 * - Manages file uploads for answer submissions
 * - Handles deadline enforcement (soft/hard)
 * - Tracks submission versioning
 */
@Injectable()
export class SubmissionService {
  constructor(
    private submissionRepository: SubmissionRepository,
    private assignmentRepository: AssignmentRepository,
    private fileService: FileService,
  ) {}

  /**
   * Create a new submission (student starts assignment)
   *
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @param studentId - Student ID
   * @returns New submission with empty answers array
   */
  async createSubmission(
    tenantId: string,
    assignmentId: string,
    studentId: string,
  ): Promise<Submission> {
    // Verify assignment exists and is published
    const assignment = await this.assignmentRepository.findById(assignmentId, tenantId);
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    // Check if assignment is published and not archived
    if (assignment.published_status === 'archived') {
      throw new BadRequestException('This assignment is closed and no longer accepts submissions');
    }

    if (assignment.published_status !== 'published') {
      throw new BadRequestException('This assignment is not yet available to students');
    }

    // Check for existing submission
    const latestSubmission = await this.submissionRepository.findLatestByAssignmentAndStudent(
      tenantId,
      assignmentId,
      studentId,
    );

    // Determine version number
    let version = 1;
    if (latestSubmission) {
      if (!assignment.allow_incremental) {
        throw new BadRequestException(
          'This assignment does not allow multiple submissions',
        );
      }
      version = latestSubmission.version + 1;
    }

    // Create submission
    const submission = new Submission();
    submission.tenant_id = tenantId;
    submission.assignment_id = assignmentId;
    submission.student_id = studentId;
    submission.version = version;
    submission.is_incremental = assignment.allow_incremental && version > 1;
    submission.content = {
      answers: [],
      startedAt: new Date(),
      completedAt: new Date(),
    } as SubmissionContent;
    submission.answer_status = 'in_progress';
    submission.question_count = 0;
    submission.submitted_at = new Date();

    // Check if late
    submission.is_late = this.isLateSubmission(assignment);

    return this.submissionRepository.save(submission);
  }

  /**
   * Submit an answer to a specific question
   *
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @param submissionId - Submission ID
   * @param answer - Answer object to submit
   * @param studentId - Student ID (for permissions)
   * @returns Updated submission
   */
  async submitAnswer(
    tenantId: string,
    assignmentId: string,
    submissionId: string,
    answer: Answer,
    studentId: string,
  ): Promise<Submission> {
    const submission = await this.getSubmissionForAnswer(
      tenantId,
      submissionId,
      studentId,
    );

    // Get assignment to find the question
    const assignment = await this.assignmentRepository.findById(
      assignmentId,
      tenantId,
    );
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    // Find question
    const content = assignment.content as AssignmentContent;
    const question = content.questions.find((q) => q.id === answer.questionId);
    if (!question) {
      throw new NotFoundException(
        `Question "${answer.questionId}" not found in assignment`,
      );
    }

    // Validate answer against question
    try {
      AnswerValidator.validate(answer, question);
    } catch (error) {
      if (error instanceof AnswerValidationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    // Add or update answer in submission
    const submissionContent = submission.content as SubmissionContent;
    const existingIndex = submissionContent.answers.findIndex(
      (a) => a.questionId === answer.questionId,
    );

    if (existingIndex >= 0) {
      submissionContent.answers[existingIndex] = answer;
    } else {
      submissionContent.answers.push(answer);
    }

    submission.question_count = submissionContent.answers.length;
    submission.updated_at = new Date();

    return this.submissionRepository.save(submission);
  }

  /**
   * Submit multiple answers at once (bulk submit)
   *
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @param submissionId - Submission ID
   * @param answers - Array of answers
   * @param studentId - Student ID (for permissions)
   * @returns Updated submission
   */
  async submitAnswers(
    tenantId: string,
    assignmentId: string,
    submissionId: string,
    answers: Answer[],
    studentId: string,
  ): Promise<Submission> {
    // Submit each answer
    let submission = await this.getSubmissionForAnswer(
      tenantId,
      submissionId,
      studentId,
    );

    for (const answer of answers) {
      submission = await this.submitAnswer(
        tenantId,
        assignmentId,
        submissionId,
        answer,
        studentId,
      );
    }

    return submission;
  }

  /**
   * Upload a file for a FILE_UPLOAD question answer
   *
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @param submissionId - Submission ID
   * @param questionId - Question ID (must be FILE_UPLOAD type)
   * @param fileName - File name
   * @param fileBuffer - File content
   * @param studentId - Student ID (for permissions)
   * @returns S3 URI of uploaded file
   */
  async uploadAnswerFile(
    tenantId: string,
    assignmentId: string,
    submissionId: string,
    questionId: string,
    fileName: string,
    fileBuffer: Buffer,
    studentId: string,
  ): Promise<string> {
    // Verify submission exists and belongs to student
    const submission = await this.getSubmissionForAnswer(
      tenantId,
      submissionId,
      studentId,
    );

    // Verify assignment and question
    const assignment = await this.assignmentRepository.findById(
      assignmentId,
      tenantId,
    );
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    const content = assignment.content as AssignmentContent;
    const question = content.questions.find((q) => q.id === questionId);
    if (!question) {
      throw new NotFoundException(`Question "${questionId}" not found`);
    }

    // Verify question is FILE_UPLOAD type
    if (question.type !== 'FILE_UPLOAD') {
      throw new BadRequestException(
        `Question "${questionId}" is not a FILE_UPLOAD question`,
      );
    }

    // Upload file
    return this.fileService.uploadAnswerFile(
      fileName,
      fileBuffer,
      tenantId,
      assignmentId,
      submissionId,
      questionId,
    );
  }

  /**
   * Upload multiple files for a FILE_UPLOAD question
   *
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @param submissionId - Submission ID
   * @param questionId - Question ID
   * @param files - Array of { fileName, fileBuffer } tuples
   * @param studentId - Student ID (for permissions)
   * @returns Array of S3 URIs
   */
  async uploadAnswerFiles(
    tenantId: string,
    assignmentId: string,
    submissionId: string,
    questionId: string,
    files: { fileName: string; fileBuffer: Buffer }[],
    studentId: string,
  ): Promise<string[]> {
    const uris: string[] = [];

    for (const file of files) {
      const uri = await this.uploadAnswerFile(
        tenantId,
        assignmentId,
        submissionId,
        questionId,
        file.fileName,
        file.fileBuffer,
        studentId,
      );
      uris.push(uri);
    }

    return uris;
  }

  /**
   * Mark submission as complete (in_progress -> submitted)
   * Student finishes answering all questions and submits
   *
   * @param tenantId - Tenant ID
   * @param submissionId - Submission ID
   * @param studentId - Student ID (for permissions)
   * @returns Updated submission
   */
  async submitForGrading(
    tenantId: string,
    submissionId: string,
    studentId: string,
  ): Promise<Submission> {
    const submission = await this.getSubmissionForAnswer(
      tenantId,
      submissionId,
      studentId,
    );

    // Update status and completion time
    submission.answer_status = 'submitted';
    const content = submission.content as SubmissionContent;
    content.completedAt = new Date();
    submission.submitted_at = new Date();
    submission.updated_at = new Date();

    return this.submissionRepository.save(submission);
  }

  /**
   * Save submission as draft (in_progress, not submitted yet)
   * Used for auto-save while student is answering
   *
   * @param tenantId - Tenant ID
   * @param submissionId - Submission ID
   * @param studentId - Student ID (for permissions)
   * @returns Updated submission
   */
  async saveDraft(
    tenantId: string,
    submissionId: string,
    studentId: string,
  ): Promise<Submission> {
    const submission = await this.getSubmissionForAnswer(
      tenantId,
      submissionId,
      studentId,
    );

    submission.answer_status = 'in_progress';
    submission.updated_at = new Date();

    return this.submissionRepository.save(submission);
  }

  /**
   * Get a submission (for viewing)
   *
   * @param tenantId - Tenant ID
   * @param submissionId - Submission ID
   * @returns Submission entity
   */
  async getSubmission(tenantId: string, submissionId: string): Promise<Submission> {
    const submission = await this.submissionRepository.findById(
      submissionId,
      tenantId,
    );

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    return submission;
  }

  /**
   * Get submission for answer input (with permission checks)
   * Internal helper - ensures student can answer
   *
   * @param tenantId - Tenant ID
   * @param submissionId - Submission ID
   * @param studentId - Student ID (for permission checks)
   * @returns Submission entity
   */
  private async getSubmissionForAnswer(
    tenantId: string,
    submissionId: string,
    studentId: string,
  ): Promise<Submission> {
    const submission = await this.getSubmission(tenantId, submissionId);

    // Verify student owns this submission
    if (submission.student_id !== studentId) {
      throw new BadRequestException('You do not have permission to answer this submission');
    }

    // Verify submission is not already graded
    if (submission.answer_status === 'graded') {
      throw new BadRequestException('Submission has already been graded and cannot be modified');
    }

    return submission;
  }

  /**
   * Check if submission is late based on assignment deadlines
   *
   * @param assignment - Assignment entity
   * @returns true if submitted after soft_deadline
   */
  private isLateSubmission(assignment: Assignment): boolean {
    if (!assignment.soft_deadline) {
      return false;
    }

    const now = new Date();
    return now > assignment.soft_deadline;
  }

  /**
   * Get all submissions for an assignment
   *
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @param includeDeleted - Include soft-deleted submissions
   * @returns Array of submissions
   */
  async getSubmissionsByAssignment(
    tenantId: string,
    assignmentId: string,
    includeDeleted: boolean = false,
  ): Promise<Submission[]> {
    return this.submissionRepository.findByAssignment(
      assignmentId,
      tenantId,
    );
  }

  /**
   * Get all submissions by a student
   *
   * @param tenantId - Tenant ID
   * @param studentId - Student ID
   * @param assignmentId - Optional: filter by assignment
   * @returns Array of submissions
   */
  async getSubmissionsByStudent(
    tenantId: string,
    studentId: string,
    assignmentId?: string,
  ): Promise<Submission[]> {
    if (assignmentId) {
      return this.submissionRepository.findByAssignmentAndStudent(
        studentId,
        assignmentId,
        tenantId,
      );
    }

    return this.submissionRepository.findByStudent(studentId, tenantId);
  }

  /**
   * Count answered questions in a submission
   *
   * @param tenantId - Tenant ID
   * @param submissionId - Submission ID
   * @returns Number of answered questions
   */
  async countAnsweredQuestions(tenantId: string, submissionId: string): Promise<number> {
    const submission = await this.getSubmission(tenantId, submissionId);
    const content = submission.content as SubmissionContent;

    return content.answers.length;
  }

  /**
   * Get progress percentage for a submission
   * (answered questions / total questions)
   *
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @param submissionId - Submission ID
   * @returns Percentage (0-100)
   */
  async getSubmissionProgress(
    tenantId: string,
    assignmentId: string,
    submissionId: string,
  ): Promise<number> {
    const assignment = await this.assignmentRepository.findById(
      assignmentId,
      tenantId,
    );
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    const submission = await this.getSubmission(tenantId, submissionId);

    const content = assignment.content as AssignmentContent;
    const totalQuestions = content.questions.length;
    const submissionContent = submission.content as SubmissionContent;
    const answeredQuestions = submissionContent.answers.length;

    if (totalQuestions === 0) return 0;
    return Math.round((answeredQuestions / totalQuestions) * 100);
  }
}
