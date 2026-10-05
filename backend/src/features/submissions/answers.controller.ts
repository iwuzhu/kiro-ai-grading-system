import {
  Controller,
  Post,
  Patch,
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
import { SubmissionService } from '../../application/services/submission.service';
import { Answer } from '../../domain/value-objects/question.types';

/**
 * Submission Answers Controller
 *
 * REST endpoints for student answer submission:
 * - Create submission (start assignment)
 * - Submit answer to a question
 * - Submit multiple answers
 * - Upload files for FILE_UPLOAD questions
 * - Save draft (auto-save)
 * - Submit for grading (finalize submission)
 * - View submission progress
 *
 * Only accessible to students for their own submissions
 */
@Controller('assignments')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AnswersController {
  constructor(private readonly submissionService: SubmissionService) {}

  /**
   * Create a new submission (student starts an assignment)
   * POST /api/v1/{institution_id}/assignments/{assignment_id}/submissions
   *
   * @param assignmentId - Assignment ID
   * @param tenantId - Tenant ID
   * @param user - Current user (student)
   */
  @Post(':assignment_id/submissions')
  @Roles(UserRole.STUDENT)
  async createSubmission(
    @Param('assignment_id') assignmentId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const submission = await this.submissionService.createSubmission(
      tenantId,
      assignmentId,
      user.id,
    );

    return {
      success: true,
      data: submission,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Submit an answer to a specific question
   * POST /api/v1/{institution_id}/assignments/{assignment_id}/submissions/{submission_id}/answers
   *
   * @param assignmentId - Assignment ID
   * @param submissionId - Submission ID
   * @param answer - Answer object
   * @param tenantId - Tenant ID
   * @param user - Current user
   */
  @Post(':assignment_id/submissions/:submission_id/answers')
  @Roles(UserRole.STUDENT)
  async submitAnswer(
    @Param('assignment_id') assignmentId: string,
    @Param('submission_id') submissionId: string,
    @Body() answer: Answer,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const updated = await this.submissionService.submitAnswer(
      tenantId,
      assignmentId,
      submissionId,
      answer,
      user.id,
    );

    return {
      success: true,
      data: updated,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Submit multiple answers at once (bulk submit)
   * POST /api/v1/{institution_id}/assignments/{assignment_id}/submissions/{submission_id}/answers/bulk
   *
   * @param assignmentId - Assignment ID
   * @param submissionId - Submission ID
   * @param body - { answers: Answer[] }
   * @param tenantId - Tenant ID
   * @param user - Current user
   */
  @Post(':assignment_id/submissions/:submission_id/answers/bulk')
  @Roles(UserRole.STUDENT)
  async submitAnswers(
    @Param('assignment_id') assignmentId: string,
    @Param('submission_id') submissionId: string,
    @Body() body: { answers: Answer[] },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const updated = await this.submissionService.submitAnswers(
      tenantId,
      assignmentId,
      submissionId,
      body.answers,
      user.id,
    );

    return {
      success: true,
      data: updated,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Upload a file for a FILE_UPLOAD question
   * POST /api/v1/{institution_id}/assignments/{assignment_id}/submissions/{submission_id}/questions/{question_id}/file
   *
   * @param assignmentId - Assignment ID
   * @param submissionId - Submission ID
   * @param questionId - Question ID (must be FILE_UPLOAD type)
   * @param file - Uploaded file
   * @param tenantId - Tenant ID
   * @param user - Current user
   */
  @Post(':assignment_id/submissions/:submission_id/questions/:question_id/file')
  @Roles(UserRole.STUDENT)
  @UseInterceptors(FileInterceptor('file'))
  async uploadAnswerFile(
    @Param('assignment_id') assignmentId: string,
    @Param('submission_id') submissionId: string,
    @Param('question_id') questionId: string,
    @UploadedFile() file: Multer.File,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const s3Uri = await this.submissionService.uploadAnswerFile(
      tenantId,
      assignmentId,
      submissionId,
      questionId,
      file.originalname,
      file.buffer,
      user.id,
    );

    return {
      success: true,
      data: {
        s3Uri,
        fileName: file.originalname,
        sizeBytes: file.size,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Upload multiple files for a FILE_UPLOAD question
   * POST /api/v1/{institution_id}/assignments/{assignment_id}/submissions/{submission_id}/questions/{question_id}/files
   *
   * @param assignmentId - Assignment ID
   * @param submissionId - Submission ID
   * @param questionId - Question ID
   * @param files - Array of uploaded files
   * @param tenantId - Tenant ID
   * @param user - Current user
   */
  @Post(':assignment_id/submissions/:submission_id/questions/:question_id/files')
  @Roles(UserRole.STUDENT)
  @UseInterceptors(
    FileInterceptor('files', {
      limits: { fileSize: 100 * 1024 * 1024 }, // 100MB total
    }),
  )
  async uploadAnswerFiles(
    @Param('assignment_id') assignmentId: string,
    @Param('submission_id') submissionId: string,
    @Param('question_id') questionId: string,
    @UploadedFile() files: Multer.File[],
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const fileList = Array.isArray(files) ? files : [files];
    const uris = await this.submissionService.uploadAnswerFiles(
      tenantId,
      assignmentId,
      submissionId,
      questionId,
      fileList.map((f) => ({
        fileName: f.originalname,
        fileBuffer: f.buffer,
      })),
      user.id,
    );

    return {
      success: true,
      data: {
        uris,
        count: uris.length,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Save submission as draft (auto-save)
   * PATCH /api/v1/{institution_id}/assignments/{assignment_id}/submissions/{submission_id}/draft
   *
   * @param assignmentId - Assignment ID
   * @param submissionId - Submission ID
   * @param tenantId - Tenant ID
   * @param user - Current user
   */
  @Patch(':assignment_id/submissions/:submission_id/draft')
  @Roles(UserRole.STUDENT)
  async saveDraft(
    @Param('assignment_id') assignmentId: string,
    @Param('submission_id') submissionId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const updated = await this.submissionService.saveDraft(
      tenantId,
      submissionId,
      user.id,
    );

    return {
      success: true,
      data: updated,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Submit submission for grading (finalize)
   * PATCH /api/v1/{institution_id}/assignments/{assignment_id}/submissions/{submission_id}/submit
   *
   * @param assignmentId - Assignment ID
   * @param submissionId - Submission ID
   * @param tenantId - Tenant ID
   * @param user - Current user
   */
  @Patch(':assignment_id/submissions/:submission_id/submit')
  @Roles(UserRole.STUDENT)
  async submitForGrading(
    @Param('assignment_id') assignmentId: string,
    @Param('submission_id') submissionId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const updated = await this.submissionService.submitForGrading(
      tenantId,
      submissionId,
      user.id,
    );

    return {
      success: true,
      data: updated,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get submission details
   * GET /api/v1/{institution_id}/assignments/{assignment_id}/submissions/{submission_id}
   *
   * @param assignmentId - Assignment ID
   * @param submissionId - Submission ID
   * @param tenantId - Tenant ID
   * @param user - Current user
   */
  @Get(':assignment_id/submissions/:submission_id')
  async getSubmission(
    @Param('assignment_id') assignmentId: string,
    @Param('submission_id') submissionId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const submission = await this.submissionService.getSubmission(
      tenantId,
      submissionId,
    );

    return {
      success: true,
      data: submission,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get submission progress (answered questions / total questions)
   * GET /api/v1/{institution_id}/assignments/{assignment_id}/submissions/{submission_id}/progress
   *
   * @param assignmentId - Assignment ID
   * @param submissionId - Submission ID
   * @param tenantId - Tenant ID
   */
  @Get(':assignment_id/submissions/:submission_id/progress')
  async getSubmissionProgress(
    @Param('assignment_id') assignmentId: string,
    @Param('submission_id') submissionId: string,
    @CurrentTenant() tenantId: string,
  ) {
    const progressPercentage = await this.submissionService.getSubmissionProgress(
      tenantId,
      assignmentId,
      submissionId,
    );

    return {
      success: true,
      data: { progressPercentage },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get student's submissions for an assignment (including version history)
   * GET /api/v1/{institution_id}/assignments/{assignment_id}/my-submissions
   *
   * @param assignmentId - Assignment ID
   * @param tenantId - Tenant ID
   * @param user - Current user
   */
  @Get(':assignment_id/my-submissions')
  @Roles(UserRole.STUDENT)
  async getMySubmissions(
    @Param('assignment_id') assignmentId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const submissions = await this.submissionService.getSubmissionsByStudent(
      tenantId,
      user.id,
      assignmentId,
    );

    return {
      success: true,
      data: submissions,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get all submissions for an assignment (instructor only)
   * GET /api/v1/{institution_id}/assignments/{assignment_id}/submissions
   *
   * @param assignmentId - Assignment ID
   * @param tenantId - Tenant ID
   */
  @Get(':assignment_id/submissions')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  async getAssignmentSubmissions(
    @Param('assignment_id') assignmentId: string,
    @CurrentTenant() tenantId: string,
  ) {
    const submissions = await this.submissionService.getSubmissionsByAssignment(
      tenantId,
      assignmentId,
      false,
    );

    return {
      success: true,
      data: submissions,
      timestamp: new Date().toISOString(),
    };
  }
}
