import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentTenant } from '@/common/decorators/current-tenant.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UserRole } from '@/infrastructure/auth/types';
import { PlagiarismScanningService } from '@/domain/services/plagiarism-scanning.service';
import { PlagiarismFlagService } from '@/domain/services/plagiarism-flag.service';
import { PlagiarismInvestigationService } from '@/domain/services/plagiarism-investigation.service';
import { PlagiarismResultRepository } from '@/domain/repositories/plagiarism-result.repository';
import { PlagiarismFlagRepository } from '@/domain/repositories/plagiarism-flag.repository';
import { SubmissionRepository } from '@/domain/repositories/submission.repository';

/**
 * Plagiarism Controller
 *
 * Endpoints for plagiarism detection and investigation management.
 * - POST /plagiarism-check: Trigger plagiarism scan
 * - GET /plagiarism/{result_id}: Retrieve plagiarism result
 * - PATCH /plagiarism/{flag_id}/investigate: Record investigation action
 *
 * RBAC: @Roles(INSTRUCTOR, ADMIN) on all endpoints
 *
 * Requirement 10: Plagiarism Controllers (4.10)
 */
@Controller('api/v1/:institution_id/plagiarism')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class PlagiarismController {
  constructor(
    private plagiarismScanningService: PlagiarismScanningService,
    private plagiarismFlagService: PlagiarismFlagService,
    private plagiarismInvestigationService: PlagiarismInvestigationService,
    private plagiarismResultRepository: PlagiarismResultRepository,
    private plagiarismFlagRepository: PlagiarismFlagRepository,
    private submissionRepository: SubmissionRepository,
  ) {}

  /**
   * Trigger plagiarism scan for a submission
   * POST /api/v1/{institution_id}/submissions/{submission_id}/plagiarism-check
   *
   * @param institutionId - Institution ID (from path)
   * @param submissionId - Submission ID
   * @param tenantId - Tenant context from JWT
   * @param user - Current user from JWT
   * @returns Plagiarism result
   */
  @Post('submissions/:submission_id/check')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerPlagiarismCheck(
    @Param('institution_id') institutionId: string,
    @Param('submission_id') submissionId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<{
    success: boolean;
    data: { result_id: string; status: string; message: string };
  }> {
    // Verify submission exists and user has permission
    const submission = await this.submissionRepository.findById(
      tenantId,
      submissionId,
    );

    if (!submission) {
      throw new NotFoundException(`Submission ${submissionId} not found`);
    }

    // Trigger async plagiarism scan
    try {
      const resultId = await this.plagiarismScanningService.scanSubmission(
        submissionId,
        tenantId,
      );

      return {
        success: true,
        data: {
          result_id: resultId,
          status: 'PENDING',
          message: 'Plagiarism scan initiated. Results will be available shortly.',
        },
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to initiate plagiarism scan: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Get plagiarism result
   * GET /api/v1/{institution_id}/plagiarism/{result_id}
   *
   * @param institutionId - Institution ID (from path)
   * @param resultId - Plagiarism result ID
   * @param tenantId - Tenant context from JWT
   * @param user - Current user from JWT
   * @returns Plagiarism result with all scores
   */
  @Get('results/:result_id')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN, UserRole.STUDENT)
  @HttpCode(HttpStatus.OK)
  async getPlagiarismResult(
    @Param('institution_id') institutionId: string,
    @Param('result_id') resultId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<{
    success: boolean;
    data: {
      id: string;
      overall_score: number;
      ai_generation_score: number;
      source_matches: any[];
      status: string;
      detection_method: string;
      scanned_at: string | null;
      turnitin_submission_id?: string;
    };
  }> {
    const result = await this.plagiarismResultRepository.findById(
      tenantId,
      resultId,
    );

    if (!result) {
      throw new NotFoundException(
        `Plagiarism result ${resultId} not found`,
      );
    }

    return {
      success: true,
      data: {
        id: result.id,
        overall_score: parseFloat(result.overall_score.toString()),
        ai_generation_score: parseFloat(
          result.ai_generation_score.toString(),
        ),
        source_matches: result.source_matches || [],
        status: result.status,
        detection_method: result.turnitin_scan_id ? 'turnitin' : 'local',
        scanned_at: result.scanned_at?.toISOString() || null,
        turnitin_submission_id: result.turnitin_scan_id || undefined,
      },
    };
  }

  /**
   * Investigate plagiarism flag
   * PATCH /api/v1/{institution_id}/plagiarism/{flag_id}/investigate
   *
   * Records the outcome of plagiarism investigation
   * Body: { action: string, investigation_notes: string }
   *
   * @param institutionId - Institution ID (from path)
   * @param flagId - Plagiarism flag ID
   * @param body - Investigation action and notes
   * @param tenantId - Tenant context from JWT
   * @param user - Current user from JWT
   * @returns Updated flag
   */
  @Patch('flags/:flag_id/investigate')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async investigatePlagiarismFlag(
    @Param('institution_id') institutionId: string,
    @Param('flag_id') flagId: string,
    @Body() body: { action: string; investigation_notes: string },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<{
    success: boolean;
    data: {
      id: string;
      status: string;
      action: string;
      investigation_notes: string;
      resolved_at: string | null;
    };
  }> {
    // Validate request body
    if (!body.action || !body.investigation_notes) {
      throw new BadRequestException(
        'action and investigation_notes are required',
      );
    }

    // Get flag
    const flag = await this.plagiarismFlagRepository.findById(
      tenantId,
      flagId,
    );

    if (!flag) {
      throw new NotFoundException(`Plagiarism flag ${flagId} not found`);
    }

    // Record action
    const updated = await this.plagiarismInvestigationService.recordActionAndResolve(
      flagId,
      tenantId,
      body.action,
      body.investigation_notes,
    );

    if (!updated) {
      throw new BadRequestException(
        'Failed to update plagiarism flag',
      );
    }

    return {
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        action: updated.action || '',
        investigation_notes: updated.investigation_notes || '',
        resolved_at: updated.resolved_at?.toISOString() || null,
      },
    };
  }

  /**
   * Get plagiarism flags for submission
   * GET /api/v1/{institution_id}/submissions/{submission_id}/plagiarism-flags
   *
   * @param institutionId - Institution ID (from path)
   * @param submissionId - Submission ID
   * @param tenantId - Tenant context from JWT
   * @param user - Current user from JWT
   * @returns Array of plagiarism flags
   */
  @Get('submissions/:submission_id/flags')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN, UserRole.STUDENT)
  @HttpCode(HttpStatus.OK)
  async getPlagiarismFlags(
    @Param('institution_id') institutionId: string,
    @Param('submission_id') submissionId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<{
    success: boolean;
    data: Array<{
      id: string;
      status: string;
      plagiarism_score: number;
      flagged_at: string;
      resolved_at: string | null;
      action: string | null;
      investigation_notes: string | null;
    }>;
  }> {
    const flags = await this.plagiarismFlagRepository.findBySubmissionId(
      tenantId,
      submissionId,
    );

    return {
      success: true,
      data: flags.map((flag) => ({
        id: flag.id,
        status: flag.status,
        plagiarism_score: flag.plagiarism_result
          ? parseFloat(flag.plagiarism_result.overall_score.toString())
          : 0,
        flagged_at: flag.flagged_at.toISOString(),
        resolved_at: flag.resolved_at?.toISOString() || null,
        action: flag.action || null,
        investigation_notes: flag.investigation_notes || null,
      })),
    };
  }

  /**
   * Get investigation details
   * GET /api/v1/{institution_id}/plagiarism/{flag_id}
   *
   * @param institutionId - Institution ID (from path)
   * @param flagId - Plagiarism flag ID
   * @param tenantId - Tenant context from JWT
   * @param user - Current user from JWT
   * @returns Investigation details
   */
  @Get('flags/:flag_id')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getInvestigationDetails(
    @Param('institution_id') institutionId: string,
    @Param('flag_id') flagId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<{
    success: boolean;
    data: any;
  }> {
    const details = await this.plagiarismInvestigationService.getInvestigationDetails(
      flagId,
      tenantId,
    );

    if (!details) {
      throw new NotFoundException(
        `Investigation details for flag ${flagId} not found`,
      );
    }

    return {
      success: true,
      data: details,
    };
  }

  /**
   * Get unresolved investigations
   * GET /api/v1/{institution_id}/plagiarism/investigations/unresolved
   *
   * @param institutionId - Institution ID (from path)
   * @param tenantId - Tenant context from JWT
   * @param user - Current user from JWT
   * @returns Array of unresolved investigations
   */
  @Get('investigations/unresolved')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getUnresolvedInvestigations(
    @Param('institution_id') institutionId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<{
    success: boolean;
    data: any[];
  }> {
    const investigations = await this.plagiarismInvestigationService.getUnresolvedInvestigations(
      tenantId,
    );

    return {
      success: true,
      data: investigations,
    };
  }
}
