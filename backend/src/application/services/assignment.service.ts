import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Assignment } from '../../domain/entities/assignment.entity';
import { AssignmentRepository } from '../../domain/repositories/assignment.repository';
import { FileService } from '../../infrastructure/storage/file.service';
import { QuestionValidator, QuestionValidationError } from '../../domain/value-objects/question.validator';
import {
  Question,
  AssignmentContent,
  PublishedStatusEnum,
  QuestionTypeEnum,
} from '../../domain/value-objects/question.types';

/**
 * Assignment Service
 *
 * Application service for assignment management:
 * - Create and update assignments
 * - Add, edit, remove questions
 * - Publish/archive assignments
 * - Handle file uploads for question attachments
 *
 * Business Logic:
 * - Validates question structure before storage
 * - Manages assignment lifecycle (draft -> published -> archived)
 * - Handles S3 file uploads for question resources
 * - Prevents modifications to published assignments (except drafts)
 */
@Injectable()
export class AssignmentService {
  constructor(
    private assignmentRepository: AssignmentRepository,
    private fileService: FileService,
  ) {}

  /**
   * Create a new assignment (starts as draft with empty questions)
   *
   * @param tenantId - Tenant ID for multi-tenancy
   * @param courseId - Course ID
   * @param title - Assignment title
   * @param description - Assignment description
   * @param pointValue - Total points for assignment
   * @param createdByUserId - Instructor creating assignment
   * @returns New assignment entity
   */
  async createAssignment(
    tenantId: string,
    courseId: string,
    title: string,
    description: string | null,
    pointValue: number | null,
    createdByUserId: string,
  ): Promise<Assignment> {
    // Check for duplicate title in course (unique constraint)
    const existing = await this.assignmentRepository.findByTitleInCourse(
      tenantId,
      courseId,
      title,
    );

    if (existing && !existing.deleted_at) {
      throw new BadRequestException(
        `Assignment "${title}" already exists in this course`,
      );
    }

    // Create assignment with empty questions array
    const assignment = new Assignment();
    assignment.tenant_id = tenantId;
    assignment.course_id = courseId;
    assignment.title = title;
    assignment.description = description;
    assignment.point_value = pointValue;
    assignment.content = { questions: [] }; // Start with empty questions
    assignment.published_status = PublishedStatusEnum.DRAFT;
    assignment.allow_incremental = false;
    assignment.late_penalty_percent = 0;
    assignment.created_by_user_id = createdByUserId;

    return this.assignmentRepository.save(assignment);
  }

  /**
   * Add a question to an assignment
   *
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @param question - Question object to add
   * @param userId - User adding question (for permissions)
   * @returns Updated assignment
   */
  async addQuestion(
    tenantId: string,
    assignmentId: string,
    question: Question,
    userId: string,
  ): Promise<Assignment> {
    const assignment = await this.getAssignmentForEdit(tenantId, assignmentId, userId);

    // Validate question
    try {
      QuestionValidator.validate(question);
    } catch (error) {
      if (error instanceof QuestionValidationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    // Check for duplicate question ID
    const content = assignment.content as AssignmentContent;
    if (content.questions.some((q) => q.id === question.id)) {
      throw new BadRequestException(`Question with ID "${question.id}" already exists`);
    }

    // Add question to content array
    content.questions.push(question);
    assignment.updated_at = new Date();

    return this.assignmentRepository.save(assignment);
  }

  /**
   * Edit an existing question in an assignment
   *
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @param questionId - ID of question to edit
   * @param updatedQuestion - Updated question object
   * @param userId - User editing question (for permissions)
   * @returns Updated assignment
   */
  async editQuestion(
    tenantId: string,
    assignmentId: string,
    questionId: string,
    updatedQuestion: Partial<Question>,
    userId: string,
  ): Promise<Assignment> {
    const assignment = await this.getAssignmentForEdit(tenantId, assignmentId, userId);

    const content = assignment.content as AssignmentContent;
    const questionIndex = content.questions.findIndex((q) => q.id === questionId);

    if (questionIndex === -1) {
      throw new NotFoundException(`Question with ID "${questionId}" not found`);
    }

    // Merge updates, preserving the original type
    const originalQuestion = content.questions[questionIndex];
    const updatedFull = { ...originalQuestion, ...updatedQuestion } as any;

    // Validate merged question
    try {
      QuestionValidator.validate(updatedFull);
    } catch (error) {
      if (error instanceof QuestionValidationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    // Update in array with proper casting
    content.questions[questionIndex] = updatedFull as Question;
    assignment.updated_at = new Date();

    return this.assignmentRepository.save(assignment);
  }

  /**
   * Remove a question from an assignment
   *
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @param questionId - ID of question to remove
   * @param userId - User removing question (for permissions)
   * @returns Updated assignment
   */
  async removeQuestion(
    tenantId: string,
    assignmentId: string,
    questionId: string,
    userId: string,
  ): Promise<Assignment> {
    const assignment = await this.getAssignmentForEdit(tenantId, assignmentId, userId);

    const content = assignment.content as AssignmentContent;
    const initialLength = content.questions.length;

    // Filter out the question
    content.questions = content.questions.filter((q) => q.id !== questionId);

    if (content.questions.length === initialLength) {
      throw new NotFoundException(`Question with ID "${questionId}" not found`);
    }

    // Ensure at least one question remains
    if (content.questions.length === 0) {
      throw new BadRequestException('Assignment must contain at least one question');
    }

    assignment.updated_at = new Date();
    return this.assignmentRepository.save(assignment);
  }

  /**
   * Reorder questions in an assignment
   *
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @param questionIds - Array of question IDs in desired order
   * @param userId - User reordering (for permissions)
   * @returns Updated assignment
   */
  async reorderQuestions(
    tenantId: string,
    assignmentId: string,
    questionIds: string[],
    userId: string,
  ): Promise<Assignment> {
    const assignment = await this.getAssignmentForEdit(tenantId, assignmentId, userId);

    const content = assignment.content as AssignmentContent;

    // Validate all IDs exist
    const existingIds = new Set(content.questions.map((q) => q.id));
    const newIds = new Set(questionIds);

    if (existingIds.size !== newIds.size || [...existingIds].some((id) => !newIds.has(id))) {
      throw new BadRequestException('Question ID list does not match existing questions');
    }

    // Create ordered map
    const questionMap = new Map(content.questions.map((q) => [q.id, q]));

    // Reorder
    content.questions = questionIds.map((id) => {
      const q = questionMap.get(id);
      if (!q) throw new NotFoundException(`Question "${id}" not found`);
      return q;
    });

    assignment.updated_at = new Date();
    return this.assignmentRepository.save(assignment);
  }

  /**
   * Upload a question attachment (image, PDF, starter code, etc.)
   * Instructor uploads resource for a specific question
   *
   * @param tenantId - Tenant ID
   * @param courseId - Course ID
   * @param assignmentId - Assignment ID
   * @param questionId - Question ID
   * @param fileName - File name
   * @param fileBuffer - File content
   * @param userId - Uploader ID (for permissions)
   * @returns S3 URI of uploaded file
   */
  async uploadQuestionAttachment(
    tenantId: string,
    courseId: string,
    assignmentId: string,
    questionId: string,
    fileName: string,
    fileBuffer: Buffer,
    userId: string,
  ): Promise<string> {
    // Verify assignment exists and user can edit it
    const assignment = await this.getAssignmentForEdit(tenantId, assignmentId, userId);

    // Verify question exists
    const content = assignment.content as AssignmentContent;
    const question = content.questions.find((q) => q.id === questionId);
    if (!question) {
      throw new NotFoundException(`Question "${questionId}" not found in assignment`);
    }

    // Upload file
    return this.fileService.uploadQuestionAttachment(
      fileName,
      fileBuffer,
      tenantId,
      courseId,
      assignmentId,
      questionId,
    );
  }

  /**
   * Publish an assignment (draft -> published)
   * Makes assignment visible to students
   *
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @param userId - Publisher ID (for permissions)
   * @returns Updated assignment
   */
  async publishAssignment(
    tenantId: string,
    assignmentId: string,
    userId: string,
  ): Promise<Assignment> {
    const assignment = await this.getAssignmentForEdit(tenantId, assignmentId, userId);

    if (assignment.published_status === PublishedStatusEnum.PUBLISHED) {
      throw new BadRequestException('Assignment is already published');
    }

    // Validate has at least one question
    const content = assignment.content as AssignmentContent;
    if (!content.questions || content.questions.length === 0) {
      throw new BadRequestException('Cannot publish assignment without questions');
    }

    // Validate all questions
    try {
      QuestionValidator.validateAssignment(content.questions);
    } catch (error) {
      throw new BadRequestException(`Cannot publish: ${error.message}`);
    }

    assignment.published_status = PublishedStatusEnum.PUBLISHED;
    assignment.published_at = new Date();
    assignment.published_by_user_id = userId;
    assignment.updated_at = new Date();

    return this.assignmentRepository.save(assignment);
  }

  /**
   * Archive an assignment (published -> archived)
   * Closes assignment to new submissions
   *
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @param userId - User archiving (for permissions)
   * @returns Updated assignment
   */
  async archiveAssignment(
    tenantId: string,
    assignmentId: string,
    userId: string,
  ): Promise<Assignment> {
    const assignment = await this.getAssignmentForEdit(tenantId, assignmentId, userId);

    assignment.published_status = PublishedStatusEnum.ARCHIVED;
    assignment.updated_at = new Date();

    return this.assignmentRepository.save(assignment);
  }

  /**
   * Get an assignment (for viewing, not editing)
   *
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @returns Assignment entity
   */
  async getAssignment(tenantId: string, assignmentId: string): Promise<Assignment> {
    const assignment = await this.assignmentRepository.findById(assignmentId, tenantId);

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    return assignment;
  }

  /**
   * Get an assignment for editing (with permission checks)
   * Internal helper - ensures user can edit and status allows editing
   *
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @param userId - User ID (for permission checks)
   * @returns Assignment entity
   */
  private async getAssignmentForEdit(
    tenantId: string,
    assignmentId: string,
    userId: string,
  ): Promise<Assignment> {
    const assignment = await this.assignmentRepository.findById(assignmentId, tenantId);

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    // Can only edit own assignments or admin override (simplified for now)
    if (assignment.created_by_user_id !== userId) {
      // TODO: Add admin role check here
      throw new BadRequestException('You do not have permission to edit this assignment');
    }

    // Can only edit draft assignments (not published)
    if (assignment.published_status !== PublishedStatusEnum.DRAFT) {
      throw new BadRequestException(
        `Cannot edit ${assignment.published_status} assignment. Only draft assignments can be edited.`,
      );
    }

    return assignment;
  }

  /**
   * Calculate total points for an assignment
   * Sums pointValue of all questions
   *
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @returns Total points
   */
  async calculateTotalPoints(tenantId: string, assignmentId: string): Promise<number> {
    const assignment = await this.getAssignment(tenantId, assignmentId);
    const content = assignment.content as AssignmentContent;

    return content.questions.reduce((sum, q) => sum + (q.pointValue || 0), 0);
  }

  /**
   * Get question count for an assignment
   *
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @returns Number of questions
   */
  async getQuestionCount(tenantId: string, assignmentId: string): Promise<number> {
    const assignment = await this.getAssignment(tenantId, assignmentId);
    const content = assignment.content as AssignmentContent;

    return content.questions.length;
  }
}
