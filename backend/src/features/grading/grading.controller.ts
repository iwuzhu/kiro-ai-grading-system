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
import { GradeOverrideService } from '../../domain/services/grade-override.service';
import { AIGradingService } from '../../domain/services/ai-grading.service';
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
@Controller('grading')
@UseGuards(AuthGuard('jwt'))
export class GradingController {
  constructor(
    private gradeOverrideService: GradeOverrideService,
    private gradeRepository: GradeRepository,
    private aiGradingService: AIGradingService,
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
        assignment_id: grade.submission?.assignment_id || null,
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
   * GET /api/v1/submissions/{submissionId}/grades
   * Get grade for a submission
   */
  @Get('submission/:submissionId/grades')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getSubmissionGrade(
    @CurrentTenant() tenantId: string,
    @Param('submissionId') submissionId: string,
  ) {
    const grade = await this.gradeRepository.findBySubmission(tenantId, submissionId);

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
        assignment_id: grade.submission?.assignment_id || null,
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

  /**
   * POST /api/v1/grading
   * Create a new grade for a submission (manual grading)
   *
   * Property: Every Grade Must Have Explanation
   * - Feedback: Required (min 20 chars)
   * - Strengths: At least 1 required
   * - Improvements: At least 1 required
   *
   * Property: Every Grade Must Have Confidence Score
   * - For manual grades: instructor confidence (0-100)
   * - Helps calibrate instructor reliability
   */
  @Post()
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createGrade(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body()
    body: {
      submission_id: string;
      assignment_id: string;
      score: number;
      confidence?: number; // Optional: instructor confidence (0-100)
      feedback: string;
      strengths: string[];
      improvements: string[];
    },
  ) {
    try {
      // Validation: Required fields
      if (!body.submission_id || !body.assignment_id) {
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Missing required fields: submission_id, assignment_id',
          },
        };
      }

      // Validation: Score range (0-100)
      if (body.score < 0 || body.score > 100) {
        return {
          success: false,
          error: {
            code: 'INVALID_SCORE',
            message: 'Score must be between 0 and 100',
          },
        };
      }

      // Validation: Feedback (min 20 chars)
      if (!body.feedback || body.feedback.trim().length < 20) {
        return {
          success: false,
          error: {
            code: 'INVALID_FEEDBACK',
            message: 'Feedback must be at least 20 characters',
          },
        };
      }

      // Validation: At least one strength
      if (!body.strengths || body.strengths.length === 0) {
        return {
          success: false,
          error: {
            code: 'INVALID_STRENGTHS',
            message: 'At least one strength must be provided',
          },
        };
      }

      // Validation: At least one improvement
      if (!body.improvements || body.improvements.length === 0) {
        return {
          success: false,
          error: {
            code: 'INVALID_IMPROVEMENTS',
            message: 'At least one improvement must be provided',
          },
        };
      }

      // Validation: Confidence (if provided)
      let instructorConfidence = body.confidence ?? 85; // Default to 85% if not provided
      if (instructorConfidence < 0 || instructorConfidence > 100) {
        return {
          success: false,
          error: {
            code: 'INVALID_CONFIDENCE',
            message: 'Confidence must be between 0 and 100',
          },
        };
      }

      // Check if grade already exists for this submission
      const existingGrade = await this.gradeRepository.findBySubmission(
        tenantId,
        body.submission_id,
      );

      let grade;

      if (existingGrade) {
        // Grade exists - update it
        existingGrade.feedback = body.feedback;
        existingGrade.strengths = body.strengths;
        existingGrade.improvements = body.improvements;
        existingGrade.final_score = body.score;
        existingGrade.confidence = instructorConfidence;
        existingGrade.status = 'MANUALLY_GRADED';
        existingGrade.graded_by_user_id = user.id;
        existingGrade.updated_at = new Date();

        grade = await this.gradeRepository.save(existingGrade);
      } else {
        // Grade doesn't exist - create it
        grade = await this.gradeRepository.createGrade({
          tenant_id: tenantId,
          submission_id: body.submission_id,
          assignment_id: body.assignment_id, // Pass assignment_id
          feedback: body.feedback,
          strengths: body.strengths,
          improvements: body.improvements,
          final_score: body.score,
          // For manual grades: ai_score is null, confidence represents instructor confidence
          ai_score: null,
          confidence: instructorConfidence,
          status: 'MANUALLY_GRADED',
          graded_by_user_id: user.id,
        });
      }

      return {
        success: true,
        data: {
          id: grade.id,
          submission_id: grade.submission_id,
          assignment_id: grade.submission?.assignment_id || null,
          score: grade.final_score,
          confidence: grade.confidence,
          feedback: grade.feedback,
          strengths: grade.strengths,
          improvements: grade.improvements,
          status: grade.status,
          graded_by_user_id: grade.graded_by_user_id,
          created_at: grade.created_at,
        },
      };
    } catch (error) {
      console.error('Error creating grade:', error);
      return {
        success: false,
        error: {
          code: 'GRADE_CREATION_FAILED',
          message: error.message || 'Failed to create grade',
        },
      };
    }
  }

  /**
   * POST /api/v1/grading/ai-grade
   * Grade a submission using AI
   *
   * Calls ChatGPT (or configured AI provider) to automatically grade
   * Returns AI-generated score, confidence, feedback, strengths, and improvements
   *
   * Property: Confidence Score is Consistent
   * - AI returns 0-100 confidence score
   * - Validated and stored as decimal with 2 decimal places
   *
   * Property: Grade Explanation Always Provided
   * - AI feedback: Always provided (min 50 chars from prompt)
   * - Strengths: At least 2 required by prompt
   * - Improvements: At least 2 required by prompt
   *
   * Property: Human Override Fully Supported
   * - Instructors can override AI grades via /override endpoint
   * - Original AI score preserved in grade_details
   * - Audit trail maintained via GradeOverrideService
   */
  @Post('ai-grade')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async gradeWithAI(
    @CurrentTenant() tenantId: string,
    @Body()
    body: {
      submission_id: string;
      assignment_id: string;
      submission_content?: string;  // NEW: Content from frontend
      rubric_text?: string;          // NEW: Rubric from frontend
      assignment_description?: string; // NEW: Assignment description from frontend
    },
  ) {
    try {
      // Validation: Required fields
      if (!body.submission_id || !body.assignment_id) {
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Missing required fields: submission_id, assignment_id',
          },
        };
      }

      // Check if AI provider is configured
      if (!this.aiGradingService.isConfigured()) {
        return {
          success: false,
          error: {
            code: 'AI_PROVIDER_NOT_CONFIGURED',
            message: 'AI grading provider is not configured. Please set TECOpenAIAPIKeyDeepGrader secret in AWS Secrets Manager.',
          },
        };
      }

      // Call AI grading service
      console.log('[gradeWithAI] Calling AI grading service with:', {
        tenantId,
        submissionId: body.submission_id,
        assignmentId: body.assignment_id,
        hasSubmissionContent: !!body.submission_content,
        hasRubricText: !!body.rubric_text,
        hasAssignmentDescription: !!body.assignment_description,
      });

      const result = await this.aiGradingService.gradeSubmission({
        tenantId,
        submissionId: body.submission_id,
        assignmentId: body.assignment_id,
        submissionContent: body.submission_content,  // Pass from frontend
        rubricText: body.rubric_text,                 // Pass from frontend
        assignmentDescription: body.assignment_description, // Pass from frontend
      });

      console.log('[gradeWithAI] AI grading service returned:', {
        gradeId: result.grade.id,
        aiScore: result.grade.ai_score,
        confidence: result.grade.confidence,
        provider: result.provider,
        processingTimeMs: result.processingTimeMs,
      });

      const responseData = {
        success: true,
        data: {
          id: result.grade.id,
          submission_id: result.grade.submission_id,
          assignment_id: result.grade.assignment_id,
          ai_score: result.grade.ai_score,
          confidence: result.grade.confidence,
          feedback: result.grade.feedback,
          strengths: result.grade.strengths,
          improvements: result.grade.improvements,
          status: result.grade.status,
          aiProvider: result.provider,
          processingTimeMs: result.processingTimeMs,
          created_at: result.grade.created_at,
        },
      };

      console.log('[gradeWithAI] Sending response:', responseData);
      return responseData;
    } catch (error) {
      console.error('[gradeWithAI] Error grading with AI:', {
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
        errorType: error instanceof Error ? 'Error instance' : typeof error,
      });
      
      const errorResponse = {
        success: false,
        error: {
          code: 'AI_GRADING_FAILED',
          message: error instanceof Error ? error.message : 'AI grading failed',
          details: {
            hint: 'Ensure AI provider is configured and submission IDs are valid',
            errorType: error instanceof Error ? error.constructor.name : typeof error,
          },
        },
      };

      console.error('[gradeWithAI] Sending error response:', errorResponse);
      return errorResponse;
    }
  }
}
