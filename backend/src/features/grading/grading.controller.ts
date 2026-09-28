import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GradingEngineService } from '../../domain/services/grading-engine.service';
import { GradeOverrideService } from '../../domain/services/grade-override.service';
import { GradeRepository } from '../../domain/repositories/grade.repository';
import { UserRole } from '../../infrastructure/auth/types';

/**
 * Grading Controllers (Task 3.14)
 *
 * REST endpoints for grading operations.
 * - Grade creation and retrieval
 * - Grade override workflow
 * - RBAC enforcement (instructors only)
 *
 * Requirements Met:
 * ✓ 3.14: Grading Controllers
 * ✓ 7: AI Grading operations
 * ✓ 13: Grade Override workflow
 */
@Controller('api/v1/grading')
@UseGuards(AuthGuard('jwt'))
export class GradingController {
  constructor(
    private gradingEngineService: GradingEngineService,
    private gradeOverrideService: GradeOverrideService,
    private gradeRepository: GradeRepository,
  ) {}

  /**
   * GET /api/v1/grading/{gradeId}
   * Get grade details
   */
  @Get(':gradeId')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getGrade(
    @CurrentTenant() tenantId: string,
    @Param('gradeId') gradeId: string,
  ) {
    const grade = await this.gradeRepository.findById(tenantId, gradeId);

    if (!grade) {
      return {
        success: false,
        error: {
          code: 'GRADE_NOT_FOUND',
          message: 'Grade not found',
        },
      };
    }

    return {
      success: true,
      data: {
        id: grade.id,
        submission_id: grade.submission_id,
        assignment_id: grade.assignment_id,
        ai_score: grade.ai_score,
        confidence: grade.confidence,
        final_score: grade.final_score,
        feedback: grade.feedback,
        strengths: grade.strengths,
        improvements: grade.improvements,
        status: grade.status,
        created_at: grade.created_at,
        updated_at: grade.updated_at,
      },
    };
  }

  /**
   * GET /api/v1/grading/assignment/{assignmentId}
   * Get all grades for an assignment
   */
  @Get('assignment/:assignmentId')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getAssignmentGrades(
    @CurrentTenant() tenantId: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    const grades = await this.gradeRepository.findByAssignment(
      tenantId,
      assignmentId,
    );

    return {
      success: true,
      data: {
        grades: grades.map(g => ({
          id: g.id,
          submission_id: g.submission_id,
          ai_score: g.ai_score,
          confidence: g.confidence,
          final_score: g.final_score,
          status: g.status,
          created_at: g.created_at,
        })),
        count: grades.length,
      },
    };
  }

  /**
   * PATCH /api/v1/grading/{gradeId}/override
   * Override a grade with manual score
   */
  @Patch(':gradeId/override')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async overrideGrade(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('gradeId') gradeId: string,
    @Body() body: { manual_score: number; rationale: string },
  ) {
    try {
      const override = await this.gradeOverrideService.overrideGrade(
        tenantId,
        gradeId,
        body.manual_score,
        body.rationale,
        user.id,
      );

      return {
        success: true,
        data: {
          id: override.id,
          grade_id: override.grade_id,
          original_score: override.original_score,
          manual_score: override.manual_score,
          rationale: override.rationale,
          approved_at: override.approved_at,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'OVERRIDE_FAILED',
          message: error.message,
        },
      };
    }
  }

  /**
   * GET /api/v1/grading/stats
   * Get grading statistics
   */
  @Get('stats/all')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getGradingStats(@CurrentTenant() tenantId: string) {
    const stats = await this.gradingEngineService.getGradingStats(tenantId);

    return {
      success: true,
      data: stats,
    };
  }

  /**
   * GET /api/v1/grading/{gradeId}/override
   * Get override for a grade (if exists)
   */
  @Get(':gradeId/override')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getOverride(
    @CurrentTenant() tenantId: string,
    @Param('gradeId') gradeId: string,
  ) {
    const override = await this.gradeOverrideService.getOverride(
      tenantId,
      gradeId,
    );

    if (!override) {
      return {
        success: true,
        data: null,
      };
    }

    return {
      success: true,
      data: {
        id: override.id,
        grade_id: override.grade_id,
        original_score: override.original_score,
        manual_score: override.manual_score,
        rationale: override.rationale,
        approved_at: override.approved_at,
      },
    };
  }
}
