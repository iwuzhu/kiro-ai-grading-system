import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SubmissionManagementService } from '../../domain/services/submission-management.service';
import { SubmissionRepository } from '../../domain/repositories/submission.repository';
import { GradeRepository } from '../../domain/repositories/grade.repository';
import { S3Service } from '../../infrastructure/storage/s3.service';
import { SubmissionUploadService } from './submission-upload.service';
import { UserRole } from '../../infrastructure/auth/types';

/**
 * Submission Controllers (Task 3.15)
 *
 * REST endpoints for submission operations.
 * - File upload and validation
 * - Submission retrieval and history
 * - Incremental submission support
 *
 * Requirements Met:
 * ✓ 3.15: Submission Controllers
 * ✓ 6: Student submission workflow
 * ✓ 14: Multi-format file support
 */
@Controller('submissions')
@UseGuards(AuthGuard('jwt'))
export class SubmissionsController {
  constructor(
    private submissionManagementService: SubmissionManagementService,
    private submissionRepository: SubmissionRepository,
    private submissionUploadService: SubmissionUploadService,
    private gradeRepository: GradeRepository,
    private s3Service: S3Service,
  ) {}

  /**
   * GET /api/v1/submissions/download/{submissionId}
   * Download submission file (with signed URL)
   * MUST be before :submissionId route to match correctly
   */
  @Get('download/:submissionId')
  @Roles(UserRole.STUDENT, UserRole.INSTRUCTOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async downloadSubmission(
    @CurrentTenant() tenantId: string,
    @Param('submissionId') submissionId: string,
    @Res() res: any,
  ) {
    try {
      const submission = await this.submissionManagementService.getSubmissionById(
        tenantId,
        submissionId,
      );

      if (!submission.file_path) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NO_FILE',
            message: 'Submission has no file',
          },
        });
      }

      // Get file from S3/storage
      const fileBuffer = await this.s3Service.downloadFile(submission.file_path);
      const fileName = submission.file_path.split('/').pop() || 'submission';

      // Set response headers for file download
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Content-Length', fileBuffer.length);

      // Send the file as binary data
      res.send(fileBuffer);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'DOWNLOAD_FAILED',
          message: error instanceof Error ? error.message : 'Failed to download file',
        },
      });
    }
  }

  /**
   * GET /api/v1/submissions/stats/{assignmentId}
   * Get submission statistics for an assignment
   * MUST be before :submissionId route to match correctly
   */
  @Get('stats/:assignmentId')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getSubmissionStats(
    @CurrentTenant() tenantId: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    const stats = await this.submissionManagementService.getSubmissionStats(
      tenantId,
      assignmentId,
    );

    return {
      success: true,
      data: stats,
    };
  }

  /**
   * GET /api/v1/submissions/assignment/{assignmentId}
   * Get all submissions for an assignment (instructor view)
   * MUST be before :submissionId route to match correctly
   */
  @Get('assignment/:assignmentId')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getAssignmentSubmissions(
    @CurrentTenant() tenantId: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    const submissions = await this.submissionManagementService.getAssignmentSubmissions(
      tenantId,
      assignmentId,
    );

    const stats = await this.submissionManagementService.getSubmissionStats(
      tenantId,
      assignmentId,
    );

    return {
      success: true,
      data: {
        submissions: submissions.map(s => ({
          id: s.id,
          student_id: s.student_id,
          version: s.version,
          is_late: s.is_late,
          submitted_at: s.submitted_at,
          file_path: s.file_path,
          file_type: s.file_type,
        })),
        stats: {
          total: stats.total_submissions,
          unique_students: stats.unique_students,
          late: stats.late_submissions,
          on_time: stats.on_time_submissions,
        },
      },
    };
  }

  /**
   * GET /api/v1/submissions/student/my-submissions
   * Get all submissions for current student
   * MUST be before :submissionId route to match correctly
   */
  @Get('student/my-submissions')
  @Roles(UserRole.STUDENT)
  @HttpCode(HttpStatus.OK)
  async getMySubmissions(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const submissions = await this.submissionManagementService.getStudentSubmissions(
      tenantId,
      user.id,
    );

    return {
      success: true,
      data: {
        submissions: submissions.map(s => ({
          id: s.id,
          assignment_id: s.assignment_id,
          version: s.version,
          is_late: s.is_late,
          submitted_at: s.submitted_at,
        })),
        count: submissions.length,
      },
    };
  }

  /**
   * GET /api/v1/submissions/history/{assignmentId}/{studentId}
   * Get all submission versions (history)
   * MUST be before :submissionId route to match correctly
   */
  @Get('history/:assignmentId/:studentId')
  @Roles(UserRole.STUDENT, UserRole.INSTRUCTOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getSubmissionHistory(
    @CurrentTenant() tenantId: string,
    @Param('assignmentId') assignmentId: string,
    @Param('studentId') studentId: string,
  ) {
    const submissions = await this.submissionManagementService.getSubmissionHistory(
      tenantId,
      assignmentId,
      studentId,
    );

    return {
      success: true,
      data: {
        submissions: submissions.map(s => ({
          id: s.id,
          version: s.version,
          file_path: s.file_path,
          file_type: s.file_type,
          is_late: s.is_late,
          is_incremental: s.is_incremental,
          submitted_at: s.submitted_at,
        })),
        count: submissions.length,
      },
    };
  }

  /**
   * GET /api/v1/submissions/assignments/{assignmentId}/history
   * Get current user's submission history for an assignment
   * MUST be before :submissionId route to match correctly
   */
  @Get('assignments/:assignmentId/history')
  @Roles(UserRole.STUDENT, UserRole.INSTRUCTOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getMySubmissionHistory(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('assignmentId') assignmentId: string,
  ) {
    const submissions = await this.submissionManagementService.getSubmissionHistory(
      tenantId,
      assignmentId,
      user.id,
    );

    return submissions.map(s => ({
      id: s.id,
      assignment_id: s.assignment_id,
      student_id: s.student_id,
      version: s.version,
      file_path: s.file_path,
      file_type: s.file_type,
      content: s.content,
      is_late: s.is_late,
      is_incremental: s.is_incremental,
      submitted_at: s.submitted_at,
      created_at: s.created_at,
    }));
  }

  /**
   * POST /api/v1/submissions/assignments/{assignmentId}/submit
   * Create a new submission (file upload)
   */
  @Post('assignments/:assignmentId/submit')
  @Roles(UserRole.STUDENT, UserRole.INSTRUCTOR)
  @HttpCode(HttpStatus.CREATED)
  async createSubmission(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('assignmentId') assignmentId: string,
    @Req() request: any,
  ) {
    try {
      // In production, would parse multipart file upload
      // For now, accept file data in body for testing
      const { file_path, file_type, content } = request.body;

      if (!content) {
        throw new BadRequestException('No content provided for submission');
      }

      // Determine file type from fileName or use provided file_type
      const fileName = request.body.fileName || `submission_${Date.now()}.txt`;
      const contentType = file_type || fileName.split('.').pop()?.toLowerCase() || 'txt';

      // Convert content to buffer if it's a string
      let contentBuffer: Buffer;
      if (typeof content === 'string') {
        // Check if it's base64 (file upload) or plain text
        if (content.startsWith('data:') || content.includes(';base64,')) {
          // Base64 encoded file
          const base64Data = content.split(',')[1] || content;
          contentBuffer = Buffer.from(base64Data, 'base64');
        } else {
          // Plain text submission
          contentBuffer = Buffer.from(content, 'utf-8');
        }
      } else {
        contentBuffer = content;
      }

      // Upload to S3
      const s3Uri = await this.submissionUploadService.uploadSubmissionContent(
        tenantId,
        assignmentId,
        user.id,
        contentBuffer,
        fileName,
        contentType,
      );

      // Create submission with S3 URI in file_path
      const submission = await this.submissionManagementService.createSubmission(
        tenantId,
        assignmentId,
        user.id,
        s3Uri, // S3 URI stored in file_path
        contentType,
        null, // No content stored in DB (it's in S3)
      );

      return {
        success: true,
        data: {
          id: submission.id,
          assignment_id: submission.assignment_id,
          version: submission.version,
          file_path: submission.file_path,
          file_type: submission.file_type,
          is_late: submission.is_late,
          submitted_at: submission.submitted_at,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SUBMISSION_FAILED',
          message: error.message,
        },
      };
    }
  }

  /**
   * GET /api/v1/submissions/{submissionId}/grades
   * Get grade for a submission
   * Generic routes MUST come after specific routes
   */
  @Get(':submissionId/grades')
  @Roles(UserRole.STUDENT, UserRole.INSTRUCTOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getSubmissionGrade(
    @CurrentTenant() tenantId: string,
    @Param('submissionId') submissionId: string,
  ) {
    try {
      const grade = await this.gradeRepository.findBySubmission(
        tenantId,
        submissionId,
      );

      if (!grade) {
        return {
          success: true,
          data: null,
        };
      }

      return {
        success: true,
        data: {
          id: grade.id,
          submission_id: grade.submission_id,
          assignment_id: grade.assignment_id,
          score: grade.final_score,
          ai_score: grade.ai_score,
          confidence: grade.confidence,
          feedback: grade.feedback,
          strengths: grade.strengths,
          improvements: grade.improvements,
          status: grade.status,
          created_at: grade.created_at,
          updated_at: grade.updated_at,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'GRADE_FETCH_FAILED',
          message: error.message,
        },
      };
    }
  }

  /**
   * GET /api/v1/submissions/{submissionId}
   * Get submission details
   * Generic routes MUST come after specific routes
   */
  @Get(':submissionId')
  @Roles(UserRole.STUDENT, UserRole.INSTRUCTOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getSubmission(
    @CurrentTenant() tenantId: string,
    @Param('submissionId') submissionId: string,
  ) {
    try {
      const submission = await this.submissionManagementService.getSubmissionById(
        tenantId,
        submissionId,
      );

      return {
        success: true,
        data: {
          id: submission.id,
          assignment_id: submission.assignment_id,
          student_id: submission.student_id,
          version: submission.version,
          file_path: submission.file_path,
          file_type: submission.file_type,
          is_late: submission.is_late,
          is_incremental: submission.is_incremental,
          submitted_at: submission.submitted_at,
          created_at: submission.created_at,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SUBMISSION_NOT_FOUND',
          message: error.message,
        },
      };
    }
  }
}
