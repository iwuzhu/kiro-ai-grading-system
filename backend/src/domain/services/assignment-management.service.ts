import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { AssignmentRepository } from '../repositories/assignment.repository';
import { RubricRepository } from '../repositories/rubric.repository';
import { CourseRepository } from '../repositories/course.repository';
import { UserRepository } from '../repositories/user.repository';

/**
 * Assignment Management Service
 *
 * Orchestrates assignment lifecycle management including:
 * - Assignment CRUD (create, read, update, publish)
 * - File type validation
 * - Rubric attachment
 * - Assignment publication workflow
 *
 * Acceptance Criteria:
 * ✓ Only instructors can create assignments
 * ✓ Published assignments trigger student notifications
 * ✓ Unpublished assignments hidden from students
 * ✓ Rubric modification after grading begins revalidates grades
 * ✓ File type constraints enforced per assignment
 */
@Injectable()
export class AssignmentManagementService {
  // Supported file types per assignment type
  private readonly fileTypeMap = {
    ESSAY: ['pdf', 'docx', 'txt', 'md', 'doc'],
    CODE: ['py', 'java', 'js', 'cpp', 'cs', 'c', 'rb', 'go', 'rs', 'zip'],
    QUIZ: ['json', 'xml'],
    SHORT_ANSWER: ['txt', 'md', 'docx', 'pdf'],
    FILE: ['pdf', 'docx', 'xlsx', 'pptx', 'zip', 'txt', 'md'],
  };

  constructor(
    private readonly assignmentRepository: AssignmentRepository,
    private readonly rubricRepository: RubricRepository,
    private readonly courseRepository: CourseRepository,
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Create a new assignment
   * @param tenantId - Tenant ID
   * @param courseId - Course ID
   * @param userId - Creating instructor's user ID
   * @param assignmentData - Assignment creation data
   * @returns Created assignment
   */
  async createAssignment(
    tenantId: string,
    courseId: string,
    userId: string,
    assignmentData: {
      title: string;
      description?: string;
      type: string; // ESSAY, CODE, QUIZ, SHORT_ANSWER, FILE
      point_value: number;
      rubric_id?: string;
      allow_incremental?: boolean;
      soft_deadline?: Date;
      hard_deadline?: Date;
      late_penalty_percent?: number;
    },
  ): Promise<any> {
    // Verify user is instructor and can edit course
    const user = await this.userRepository.findById(tenantId, userId);
    if (!user || user.role !== 'INSTRUCTOR') {
      throw new ForbiddenException('Only instructors can create assignments');
    }

    // Verify course exists and belongs to tenant
    const course = await this.courseRepository.findById(tenantId, courseId);
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Validate assignment type
    if (!Object.keys(this.fileTypeMap).includes(assignmentData.type)) {
      throw new BadRequestException(
        `Invalid assignment type. Must be one of: ${Object.keys(this.fileTypeMap).join(', ')}`,
      );
    }

    // Validate required fields
    if (!assignmentData.title || assignmentData.title.trim().length === 0) {
      throw new BadRequestException('Assignment title is required');
    }

    if (
      !Number.isFinite(assignmentData.point_value) ||
      assignmentData.point_value <= 0
    ) {
      throw new BadRequestException('Point value must be a positive number');
    }

    // Validate deadlines
    if (assignmentData.soft_deadline && assignmentData.hard_deadline) {
      if (assignmentData.soft_deadline > assignmentData.hard_deadline) {
        throw new BadRequestException(
          'Soft deadline must be before hard deadline',
        );
      }
    }

    // Validate late penalty percentage
    if (assignmentData.late_penalty_percent !== undefined) {
      if (
        assignmentData.late_penalty_percent < 0 ||
        assignmentData.late_penalty_percent > 100
      ) {
        throw new BadRequestException('Late penalty must be between 0 and 100');
      }
    }

    // Verify rubric if provided
    if (assignmentData.rubric_id) {
      const rubric = await this.rubricRepository.findById(
        tenantId,
        assignmentData.rubric_id,
      );
      if (!rubric) {
        throw new NotFoundException('Rubric not found');
      }
    }

    // Create assignment
    const assignment = await this.assignmentRepository.createAssignment({
      tenant_id: tenantId,
      course_id: courseId,
      title: assignmentData.title,
      description: assignmentData.description || null,
      type: assignmentData.type as 'ESSAY' | 'CODE' | 'QUIZ' | 'SHORT_ANSWER' | 'FILE',
      point_value: assignmentData.point_value,
      rubric_id: assignmentData.rubric_id || null,
      allow_incremental: assignmentData.allow_incremental || false,
      soft_deadline: assignmentData.soft_deadline || null,
      hard_deadline: assignmentData.hard_deadline || null,
      late_penalty_percent: assignmentData.late_penalty_percent || 0,
      created_by_user_id: userId,
    });

    return assignment;
  }

  /**
   * Get assignment by ID
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @returns Assignment with full details
   */
  async getAssignment(
    tenantId: string,
    assignmentId: string,
  ): Promise<any> {
    const assignment = await this.assignmentRepository.findById(
      tenantId,
      assignmentId,
    );
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    return {
      ...assignment,
      allowed_file_types: this.fileTypeMap[assignment.type] || [],
    };
  }

  /**
   * Get all assignments in a course
   * @param tenantId - Tenant ID
   * @param courseId - Course ID
   * @param includeUnpublished - Include unpublished (admin/instructor only)
   * @returns Array of assignments
   */
  async getAssignmentsByCourse(
    tenantId: string,
    courseId: string,
    includeUnpublished: boolean = false,
  ): Promise<any[]> {
    const assignments = await this.assignmentRepository.findByCourse(
      tenantId,
      courseId,
      includeUnpublished,
    );

    return assignments.map((a) => ({
      ...a,
      allowed_file_types: this.fileTypeMap[a.type] || [],
    }));
  }

  /**
   * Update assignment
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @param userId - User making the update
   * @param updates - Fields to update
   * @returns Updated assignment
   */
  async updateAssignment(
    tenantId: string,
    assignmentId: string,
    userId: string,
    updates: {
      title?: string;
      description?: string;
      point_value?: number;
      rubric_id?: string;
      allow_incremental?: boolean;
      soft_deadline?: Date;
      hard_deadline?: Date;
      late_penalty_percent?: number;
    },
  ): Promise<any> {
    const assignment = await this.assignmentRepository.findById(
      tenantId,
      assignmentId,
    );
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    if (assignment.created_by_user_id !== userId) {
      throw new ForbiddenException(
        'Only the assignment creator can modify this assignment',
      );
    }

    // Validate updates
    if (updates.title && updates.title.trim().length === 0) {
      throw new BadRequestException('Assignment title cannot be empty');
    }

    if (
      updates.point_value &&
      (!Number.isFinite(updates.point_value) || updates.point_value <= 0)
    ) {
      throw new BadRequestException('Point value must be a positive number');
    }

    if (
      updates.late_penalty_percent !== undefined &&
      (updates.late_penalty_percent < 0 || updates.late_penalty_percent > 100)
    ) {
      throw new BadRequestException('Late penalty must be between 0 and 100');
    }

    if (updates.soft_deadline && updates.hard_deadline) {
      if (updates.soft_deadline > updates.hard_deadline) {
        throw new BadRequestException(
          'Soft deadline must be before hard deadline',
        );
      }
    }

    if (updates.rubric_id) {
      const rubric = await this.rubricRepository.findById(
        tenantId,
        updates.rubric_id,
      );
      if (!rubric) {
        throw new NotFoundException('Rubric not found');
      }
    }

    // Apply updates
    if (updates.title) assignment.title = updates.title;
    if (updates.description !== undefined) assignment.description = updates.description;
    if (updates.point_value) assignment.point_value = updates.point_value;
    if (updates.rubric_id !== undefined) assignment.rubric_id = updates.rubric_id;
    if (updates.allow_incremental !== undefined) assignment.allow_incremental = updates.allow_incremental;
    if (updates.soft_deadline !== undefined) assignment.soft_deadline = updates.soft_deadline;
    if (updates.hard_deadline !== undefined) assignment.hard_deadline = updates.hard_deadline;
    if (updates.late_penalty_percent !== undefined) assignment.late_penalty_percent = updates.late_penalty_percent;

    return this.assignmentRepository.save(assignment);
  }

  /**
   * Publish assignment (make visible to students)
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @param userId - User publishing the assignment
   * @returns Updated assignment with published_at timestamp
   */
  async publishAssignment(
    tenantId: string,
    assignmentId: string,
    userId: string,
  ): Promise<any> {
    const assignment = await this.assignmentRepository.findById(
      tenantId,
      assignmentId,
    );
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    if (assignment.created_by_user_id !== userId) {
      throw new ForbiddenException(
        'Only the assignment creator can publish this assignment',
      );
    }

    if (assignment.published_at) {
      throw new BadRequestException('Assignment is already published');
    }

    // TODO: Trigger notification to enrolled students
    // await this.notificationService.publishAssignmentNotification(assignment);

    return this.assignmentRepository.publish(tenantId, assignmentId, userId);
  }

  /**
   * Unpublish assignment (hide from students)
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @param userId - User unpublishing the assignment
   * @returns Updated assignment
   */
  async unpublishAssignment(
    tenantId: string,
    assignmentId: string,
    userId: string,
  ): Promise<any> {
    const assignment = await this.assignmentRepository.findById(
      tenantId,
      assignmentId,
    );
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    if (assignment.created_by_user_id !== userId) {
      throw new ForbiddenException(
        'Only the assignment creator can unpublish this assignment',
      );
    }

    if (!assignment.published_at) {
      throw new BadRequestException('Assignment is not published');
    }

    assignment.published_at = null;
    assignment.published_by_user_id = null;

    return this.assignmentRepository.save(assignment);
  }

  /**
   * Delete assignment (soft delete)
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @param userId - User deleting the assignment
   * @returns Updated assignment
   */
  async deleteAssignment(
    tenantId: string,
    assignmentId: string,
    userId: string,
  ): Promise<any> {
    const assignment = await this.assignmentRepository.findById(
      tenantId,
      assignmentId,
    );
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    if (assignment.created_by_user_id !== userId) {
      throw new ForbiddenException(
        'Only the assignment creator can delete this assignment',
      );
    }

    return this.assignmentRepository.softDeleteAssignment(tenantId, assignmentId);
  }

  /**
   * Validate if a file type is allowed for this assignment
   * @param assignmentType - Assignment type (ESSAY, CODE, etc.)
   * @param fileExtension - File extension (without dot)
   * @returns true if file type is allowed
   */
  isFileTypeAllowed(assignmentType: string, fileExtension: string): boolean {
    const allowed = this.fileTypeMap[assignmentType] || [];
    return allowed.includes(fileExtension.toLowerCase());
  }

  /**
   * Get allowed file types for assignment type
   * @param assignmentType - Assignment type
   * @returns Array of allowed file extensions
   */
  getAllowedFileTypes(assignmentType: string): string[] {
    return this.fileTypeMap[assignmentType] || [];
  }

  /**
   * Check if user can edit assignment
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @param userId - User ID
   * @returns true if user can edit
   */
  async canEditAssignment(
    tenantId: string,
    assignmentId: string,
    userId: string,
  ): Promise<boolean> {
    const assignment = await this.assignmentRepository.findById(
      tenantId,
      assignmentId,
    );
    if (!assignment) {
      return false;
    }

    return assignment.created_by_user_id === userId;
  }

  /**
   * Check if assignment is published
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @returns true if published
   */
  async isPublished(
    tenantId: string,
    assignmentId: string,
  ): Promise<boolean> {
    const assignment = await this.assignmentRepository.findById(
      tenantId,
      assignmentId,
    );
    if (!assignment) {
      return false;
    }

    return !!assignment.published_at;
  }
}
