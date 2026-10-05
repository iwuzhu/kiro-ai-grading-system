/**
 * Test Controller for Submission Debugging
 * 
 * Provides endpoints to test the complete submission flow
 * with detailed logging and verification
 */

import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { SubmissionManagementService } from '../../domain/services/submission-management.service';
import { SubmissionRepository } from '../../domain/repositories/submission.repository';
import { Submission } from '../../domain/entities/submission.entity';

@Controller('api/v1/test/submissions')
export class TestSubmissionController {
  constructor(
    private submissionManagementService: SubmissionManagementService,
    private submissionRepository: SubmissionRepository,
  ) {}

  /**
   * Test direct repository save
   * POST /api/v1/test/submissions/direct-save
   * 
   * Creates a submission directly to test repository
   */
  @Post('direct-save')
  @HttpCode(HttpStatus.CREATED)
  async testDirectSave(
    @Body() body: {
      tenantId: string;
      assignmentId: string;
      studentId: string;
      fileName: string;
    },
  ) {
    console.log('[TestSubmissionController.testDirectSave] Starting direct save test:', body);

    try {
      // Create submission data
      const submissionData = {
        tenant_id: body.tenantId,
        assignment_id: body.assignmentId,
        student_id: body.studentId,
        version: 1,
        file_path: `s3://tecbridge-general/websites/externals/deepgrader/${Date.now()}/${body.fileName}`,
        file_type: 'application/octet-stream',
        content: {
          answers: {
            file: `s3://tecbridge-general/websites/externals/deepgrader/${Date.now()}/${body.fileName}`,
            submittedAt: new Date().toISOString(),
          },
        },
        is_incremental: false,
        is_late: false,
        submitted_at: new Date(),
      };

      console.log('[TestSubmissionController.testDirectSave] Calling repository.createSubmission...');
      const submission = await this.submissionRepository.createSubmission(submissionData);

      console.log('[TestSubmissionController.testDirectSave] ✅ Submission saved successfully:', {
        id: submission.id,
        tenant_id: submission.tenant_id,
        assignment_id: submission.assignment_id,
      });

      // Now verify by fetching
      console.log('[TestSubmissionController.testDirectSave] Verifying by fetching...');
      const verified = await this.submissionRepository.findOne({
        where: {
          id: submission.id,
          tenant_id: body.tenantId,
        },
      });

      if (verified) {
        console.log('[TestSubmissionController.testDirectSave] ✅ Verification SUCCESS - record found in DB');
        return {
          success: true,
          message: 'Submission saved and verified successfully',
          submission: {
            id: submission.id,
            tenant_id: submission.tenant_id,
            assignment_id: submission.assignment_id,
            student_id: submission.student_id,
            file_path: submission.file_path,
            content: submission.content,
            created_at: submission.created_at,
          },
          verified: true,
        };
      } else {
        console.log('[TestSubmissionController.testDirectSave] ❌ Verification FAILED - record NOT found in DB');
        return {
          success: false,
          message: 'Submission was saved but could not be verified',
          submission: {
            id: submission.id,
            tenant_id: submission.tenant_id,
            assignment_id: submission.assignment_id,
          },
          verified: false,
        };
      }
    } catch (error) {
      console.error('[TestSubmissionController.testDirectSave] ❌ ERROR:', {
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : null,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get all submissions
   * GET /api/v1/test/submissions/all
   * 
   * Lists all submissions in the database (for testing)
   */
  @Get('all')
  @HttpCode(HttpStatus.OK)
  async getAllSubmissions() {
    console.log('[TestSubmissionController.getAllSubmissions] Fetching all submissions...');

    try {
      const submissions = await this.submissionRepository.find();
      console.log('[TestSubmissionController.getAllSubmissions] Found submissions:', {
        count: submissions.length,
      });

      return {
        success: true,
        count: submissions.length,
        submissions: submissions.map(s => ({
          id: s.id,
          tenant_id: s.tenant_id,
          assignment_id: s.assignment_id,
          student_id: s.student_id,
          version: s.version,
          file_path: s.file_path,
          content: s.content,
          created_at: s.created_at,
          submitted_at: s.submitted_at,
        })),
      };
    } catch (error) {
      console.error('[TestSubmissionController.getAllSubmissions] ERROR:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get submissions for specific assignment
   * GET /api/v1/test/submissions/by-assignment/:assignmentId/:tenantId
   */
  @Get('by-assignment/:assignmentId/:tenantId')
  @HttpCode(HttpStatus.OK)
  async getSubmissionsByAssignment(assignmentId: string, tenantId: string) {
    console.log('[TestSubmissionController.getSubmissionsByAssignment] Fetching:', {
      assignmentId,
      tenantId,
    });

    try {
      const submissions = await this.submissionRepository.find({
        where: {
          assignment_id: assignmentId,
          tenant_id: tenantId,
        },
      });

      console.log('[TestSubmissionController.getSubmissionsByAssignment] Found:', {
        count: submissions.length,
      });

      return {
        success: true,
        count: submissions.length,
        submissions: submissions.map(s => ({
          id: s.id,
          tenant_id: s.tenant_id,
          assignment_id: s.assignment_id,
          student_id: s.student_id,
          version: s.version,
          created_at: s.created_at,
        })),
      };
    } catch (error) {
      console.error('[TestSubmissionController.getSubmissionsByAssignment] ERROR:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
