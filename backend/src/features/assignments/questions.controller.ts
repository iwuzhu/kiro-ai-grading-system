import {
  Controller,
  Post,
  Patch,
  Delete,
  Get,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { Multer } from 'multer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../infrastructure/auth/types';
import { AssignmentService } from '../../application/services/assignment.service';
import { Question } from '../../domain/value-objects/question.types';

/**
 * Questions Controller
 *
 * REST endpoints for question management within assignments:
 * - Add question to assignment
 * - Edit question
 * - Remove question
 * - Reorder questions
 * - Upload question attachments
 *
 * Only accessible to instructors during assignment draft phase
 */
@Controller('courses')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class QuestionsController {
  constructor(private readonly assignmentService: AssignmentService) {}

  /**
   * Add a question to an assignment
   * POST /api/v1/{institution_id}/courses/{course_id}/assignments/{assignment_id}/questions
   *
   * @param courseId - Course ID (for context)
   * @param assignmentId - Assignment ID
   * @param question - Question object
   * @param tenantId - Tenant ID
   * @param user - Current user
   */
  @Post(':course_id/assignments/:assignment_id/questions')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  async addQuestion(
    @Param('course_id') courseId: string,
    @Param('assignment_id') assignmentId: string,
    @Body() question: Question,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const updated = await this.assignmentService.addQuestion(
      tenantId,
      assignmentId,
      question,
      user.id,
    );

    return {
      success: true,
      data: updated,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Edit a question in an assignment
   * PATCH /api/v1/{institution_id}/courses/{course_id}/assignments/{assignment_id}/questions/{question_id}
   *
   * @param courseId - Course ID
   * @param assignmentId - Assignment ID
   * @param questionId - Question ID
   * @param updates - Partial question updates
   * @param tenantId - Tenant ID
   * @param user - Current user
   */
  @Patch(':course_id/assignments/:assignment_id/questions/:question_id')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  async editQuestion(
    @Param('course_id') courseId: string,
    @Param('assignment_id') assignmentId: string,
    @Param('question_id') questionId: string,
    @Body() updates: Partial<Question>,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const updated = await this.assignmentService.editQuestion(
      tenantId,
      assignmentId,
      questionId,
      updates,
      user.id,
    );

    return {
      success: true,
      data: updated,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Remove a question from an assignment
   * DELETE /api/v1/{institution_id}/courses/{course_id}/assignments/{assignment_id}/questions/{question_id}
   *
   * @param courseId - Course ID
   * @param assignmentId - Assignment ID
   * @param questionId - Question ID
   * @param tenantId - Tenant ID
   * @param user - Current user
   */
  @Delete(':course_id/assignments/:assignment_id/questions/:question_id')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  async removeQuestion(
    @Param('course_id') courseId: string,
    @Param('assignment_id') assignmentId: string,
    @Param('question_id') questionId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const updated = await this.assignmentService.removeQuestion(
      tenantId,
      assignmentId,
      questionId,
      user.id,
    );

    return {
      success: true,
      data: updated,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Reorder questions in an assignment
   * PATCH /api/v1/{institution_id}/courses/{course_id}/assignments/{assignment_id}/questions/reorder
   *
   * @param courseId - Course ID
   * @param assignmentId - Assignment ID
   * @param body - { questionIds: string[] }
   * @param tenantId - Tenant ID
   * @param user - Current user
   */
  @Patch(':course_id/assignments/:assignment_id/questions/reorder')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  async reorderQuestions(
    @Param('course_id') courseId: string,
    @Param('assignment_id') assignmentId: string,
    @Body() body: { questionIds: string[] },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const updated = await this.assignmentService.reorderQuestions(
      tenantId,
      assignmentId,
      body.questionIds,
      user.id,
    );

    return {
      success: true,
      data: updated,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Upload a question attachment (image, PDF, starter code, etc.)
   * POST /api/v1/{institution_id}/courses/{course_id}/assignments/{assignment_id}/questions/{question_id}/attachment
   *
   * @param courseId - Course ID
   * @param assignmentId - Assignment ID
   * @param questionId - Question ID
   * @param file - Uploaded file
   * @param tenantId - Tenant ID
   * @param user - Current user
   */
  @Post(':course_id/assignments/:assignment_id/questions/:question_id/attachment')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async uploadQuestionAttachment(
    @Param('course_id') courseId: string,
    @Param('assignment_id') assignmentId: string,
    @Param('question_id') questionId: string,
    @UploadedFile() file: Multer.File,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const s3Uri = await this.assignmentService.uploadQuestionAttachment(
      tenantId,
      courseId,
      assignmentId,
      questionId,
      file.originalname,
      file.buffer,
      user.id,
    );

    return {
      success: true,
      data: { s3Uri, fileName: file.originalname },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Publish an assignment (make it visible to students)
   * PATCH /api/v1/{institution_id}/courses/{course_id}/assignments/{assignment_id}/publish
   *
   * @param courseId - Course ID
   * @param assignmentId - Assignment ID
   * @param tenantId - Tenant ID
   * @param user - Current user
   */
  @Patch(':course_id/assignments/:assignment_id/publish')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  async publishAssignment(
    @Param('course_id') courseId: string,
    @Param('assignment_id') assignmentId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const updated = await this.assignmentService.publishAssignment(
      tenantId,
      assignmentId,
      user.id,
    );

    return {
      success: true,
      data: updated,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Archive an assignment (close to submissions)
   * PATCH /api/v1/{institution_id}/courses/{course_id}/assignments/{assignment_id}/archive
   *
   * @param courseId - Course ID
   * @param assignmentId - Assignment ID
   * @param tenantId - Tenant ID
   * @param user - Current user
   */
  @Patch(':course_id/assignments/:assignment_id/archive')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  async archiveAssignment(
    @Param('course_id') courseId: string,
    @Param('assignment_id') assignmentId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const updated = await this.assignmentService.archiveAssignment(
      tenantId,
      assignmentId,
      user.id,
    );

    return {
      success: true,
      data: updated,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get assignment details (with all questions)
   * GET /api/v1/{institution_id}/courses/{course_id}/assignments/{assignment_id}
   *
   * @param courseId - Course ID
   * @param assignmentId - Assignment ID
   * @param tenantId - Tenant ID
   * @param user - Current user
   */
  @Get(':course_id/assignments/:assignment_id')
  async getAssignment(
    @Param('course_id') courseId: string,
    @Param('assignment_id') assignmentId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const assignment = await this.assignmentService.getAssignment(
      tenantId,
      assignmentId,
    );

    return {
      success: true,
      data: assignment,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get total points for an assignment
   * GET /api/v1/{institution_id}/courses/{course_id}/assignments/{assignment_id}/total-points
   *
   * @param courseId - Course ID
   * @param assignmentId - Assignment ID
   * @param tenantId - Tenant ID
   */
  @Get(':course_id/assignments/:assignment_id/total-points')
  async getTotalPoints(
    @Param('course_id') courseId: string,
    @Param('assignment_id') assignmentId: string,
    @CurrentTenant() tenantId: string,
  ) {
    const totalPoints = await this.assignmentService.calculateTotalPoints(
      tenantId,
      assignmentId,
    );

    return {
      success: true,
      data: { totalPoints },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get question count for an assignment
   * GET /api/v1/{institution_id}/courses/{course_id}/assignments/{assignment_id}/question-count
   *
   * @param courseId - Course ID
   * @param assignmentId - Assignment ID
   * @param tenantId - Tenant ID
   */
  @Get(':course_id/assignments/:assignment_id/question-count')
  async getQuestionCount(
    @Param('course_id') courseId: string,
    @Param('assignment_id') assignmentId: string,
    @CurrentTenant() tenantId: string,
  ) {
    const count = await this.assignmentService.getQuestionCount(
      tenantId,
      assignmentId,
    );

    return {
      success: true,
      data: { count },
      timestamp: new Date().toISOString(),
    };
  }
}
