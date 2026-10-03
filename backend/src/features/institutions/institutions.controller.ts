import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InstitutionManagementService } from '../../application/services/institution-management.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../infrastructure/auth/types';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import {
  UpdateInstitutionSettingsDto,
  SetPlagiarismThresholdDto,
  SetGradeScaleDto,
  SetAIProviderDto,
} from './dtos/institution.dto';
import { Institution } from '../../domain/entities/institution.entity';

/**
 * Institution Management Controller
 *
 * REST endpoints for institution settings management:
 * - Get institution settings
 * - Update institution settings (name, timezone, AI provider)
 * - Configure plagiarism thresholds
 * - Configure grade scales
 * - Set AI provider
 * - View institution analytics
 *
 * RBAC Guards:
 * - GET /settings: ADMIN only (view settings)
 * - PATCH /settings: ADMIN only (update settings)
 * - PATCH /settings/plagiarism-threshold: ADMIN only
 * - PATCH /settings/grade-scale: ADMIN only
 * - PATCH /settings/ai-provider: ADMIN only
 * - GET /analytics: ADMIN only (view analytics)
 *
 * Multi-Tenancy:
 * - All operations scoped to current tenant
 * - Only institution admins can modify settings
 * - Cross-tenant access returns 403 Forbidden
 *
 * Response Format:
 * All endpoints return standardized response envelope:
 * {
 *   "success": true|false,
 *   "data": { institution object },
 *   "error": null | { code, message, details },
 *   "timestamp": "ISO-8601",
 *   "path": "/api/v1/..."
 * }
 *
 * Error Codes:
 * - VALIDATION_ERROR (400): Input validation failed
 * - UNAUTHORIZED (401): Authentication required
 * - FORBIDDEN (403): Insufficient permissions
 * - NOT_FOUND (404): Institution not found
 * - INTERNAL_SERVER_ERROR (500): Unexpected server error
 */
@Controller('api/v1/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InstitutionsController {
  constructor(private institutionManagementService: InstitutionManagementService) {}

  /**
   * Get institution settings
   *
   * @route GET /api/v1/:institution_id/settings
   * @rbac ADMIN only
   *
   * Response: 200 OK
   * {
   *   "success": true,
   *   "data": {
   *     "id": "uuid",
   *     "tenant_id": "uuid",
   *     "name": "Test University",
   *     "domain": "university.edu",
   *     "timezone": "America/New_York",
   *     "plagiarism_threshold": 75,
   *     "ai_provider": "openai",
   *     "settings": {
   *       "gradeScale": {
   *         "type": "PERCENTAGE",
   *         "config": {}
   *       }
   *     },
   *     "created_at": "2024-01-01T00:00:00Z",
   *     "updated_at": "2024-01-01T00:00:00Z"
   *   },
   *   "error": null
   * }
   */
  @Get()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getSettings(
    @CurrentTenant() tenantId: string,
  ): Promise<{
    success: boolean;
    data: Partial<Institution>;
    error: null;
  }> {
    try {
      const institution = await this.institutionManagementService.getInstitutionSettings(
        tenantId,
      );

      return {
        success: true,
        data: this.sanitizeInstitution(institution),
        error: null,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update institution settings
   *
   * @route PATCH /api/v1/:institution_id/settings
   * @rbac ADMIN only
   *
   * Request (partial update with nested settings):
   * {
   *   "name": "Updated University Name",
   *   "timezone": "UTC",
   *   "settings": {
   *     "plagiarismEnabled": true,
   *     "plagiarismThreshold": 20,
   *     "aiGradingEnabled": true,
   *     "aiProvider": "openai"
   *   }
   * }
   *
   * Or with top-level plagiarism/AI settings:
   * {
   *   "plagiarismEnabled": true,
   *   "plagiarismThreshold": 20,
   *   "aiGradingEnabled": true,
   *   "aiProvider": "openai"
   * }
   *
   * Response: 200 OK with updated institution
   */
  @Patch()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateSettings(
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateInstitutionSettingsDto,
  ): Promise<{
    success: boolean;
    data: Partial<Institution>;
    error: null;
  }> {
    try {
      // Build the settings object to pass to service
      const updatePayload: Partial<{
        name: string;
        timezone: string;
        plagiarism_threshold: number;
        ai_provider: 'openai' | 'claude' | 'bedrock';
        settings: Record<string, any>;
      }> = {
        name: dto.name,
        timezone: dto.timezone,
      };

      // Handle AI provider - can come from either top-level or nested
      if (dto.aiProvider) {
        updatePayload.ai_provider = dto.aiProvider as 'openai' | 'claude' | 'bedrock';
      } else if (dto.settings?.aiProvider) {
        updatePayload.ai_provider = dto.settings.aiProvider as 'openai' | 'claude' | 'bedrock';
      }

      // Handle plagiarism threshold - can come from either top-level or nested
      if (dto.plagiarismThreshold !== undefined) {
        updatePayload.plagiarism_threshold = dto.plagiarismThreshold;
      } else if (dto.settings?.plagiarismThreshold !== undefined) {
        updatePayload.plagiarism_threshold = dto.settings.plagiarismThreshold;
      }

      // Build nested settings object for feature flags and other settings
      const nestedSettings: Record<string, any> = {
        ...dto.settings,
      };

      // Add top-level flags to nested settings
      if (dto.plagiarismEnabled !== undefined) {
        nestedSettings.plagiarismEnabled = dto.plagiarismEnabled;
      }
      if (dto.aiGradingEnabled !== undefined) {
        nestedSettings.aiGradingEnabled = dto.aiGradingEnabled;
      }

      // Only add settings if we have any
      if (Object.keys(nestedSettings).length > 0) {
        updatePayload.settings = nestedSettings;
      }

      const institution = await this.institutionManagementService.updateInstitutionSettings(
        tenantId,
        updatePayload,
      );

      return {
        success: true,
        data: this.sanitizeInstitution(institution),
        error: null,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Set plagiarism detection threshold
   *
   * @route PATCH /api/v1/:institution_id/settings/plagiarism-threshold
   * @rbac ADMIN only
   *
   * Request:
   * {
   *   "threshold": 80
   * }
   *
   * Response: 200 OK with updated institution
   *
   * Notes:
   * - Threshold must be 0-100
   * - When threshold changes, existing submissions will be re-evaluated
   *   (re-analysis deferred to Phase 4)
   * - Submissions exceeding new threshold will be flagged
   */
  @Patch('plagiarism-threshold')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async setPlagiarismThreshold(
    @CurrentTenant() tenantId: string,
    @Body() dto: SetPlagiarismThresholdDto,
  ): Promise<{
    success: boolean;
    data: Partial<Institution>;
    error: null;
  }> {
    try {
      const institution = await this.institutionManagementService.setPlagiarismThreshold(
        tenantId,
        dto.threshold,
      );

      // Trigger policy propagation (async in production)
      await this.institutionManagementService.propagatePolicyChanges(tenantId, {
        plagiarismThresholdChanged: true,
      });

      return {
        success: true,
        data: this.sanitizeInstitution(institution),
        error: null,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Set grade scale configuration
   *
   * @route PATCH /api/v1/:institution_id/settings/grade-scale
   * @rbac ADMIN only
   *
   * Request (percentage scale):
   * {
   *   "type": "PERCENTAGE",
   *   "config": {}
   * }
   *
   * Request (letter scale):
   * {
   *   "type": "LETTER",
   *   "config": {
   *     "grades": ["A", "B", "C", "D", "F"]
   *   }
   * }
   *
   * Request (GPA scale):
   * {
   *   "type": "GPA",
   *   "config": {
   *     "scale": 4.0
   *   }
   * }
   *
   * Response: 200 OK with updated institution
   */
  @Patch('grade-scale')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async setGradeScale(
    @CurrentTenant() tenantId: string,
    @Body() dto: SetGradeScaleDto,
  ): Promise<{
    success: boolean;
    data: Partial<Institution>;
    error: null;
  }> {
    try {
      const institution = await this.institutionManagementService.setGradeScale(
        tenantId,
        {
          type: dto.type,
          config: dto.config,
        },
      );

      // Trigger policy propagation
      await this.institutionManagementService.propagatePolicyChanges(tenantId, {
        gradeScaleChanged: true,
      });

      return {
        success: true,
        data: this.sanitizeInstitution(institution),
        error: null,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Set AI provider for grading
   *
   * @route PATCH /api/v1/:institution_id/settings/ai-provider
   * @rbac ADMIN only
   *
   * Request:
   * {
   *   "provider": "openai"
   * }
   *
   * Valid providers: "openai" | "claude" | "bedrock"
   *
   * Response: 200 OK with updated institution
   *
   * Notes:
   * - Change takes effect immediately for new submissions
   * - Existing grades retain their original provider info
   */
  @Patch('ai-provider')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async setAIProvider(
    @CurrentTenant() tenantId: string,
    @Body() dto: SetAIProviderDto,
  ): Promise<{
    success: boolean;
    data: Partial<Institution>;
    error: null;
  }> {
    try {
      const institution = await this.institutionManagementService.setAIProvider(
        tenantId,
        dto.provider,
      );

      // Trigger policy propagation
      await this.institutionManagementService.propagatePolicyChanges(tenantId, {
        aiProviderChanged: true,
      });

      return {
        success: true,
        data: this.sanitizeInstitution(institution),
        error: null,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get institution analytics
   *
   * @route GET /api/v1/:institution_id/analytics
   * @rbac ADMIN only
   *
   * Response: 200 OK
   * {
   *   "success": true,
   *   "data": {
   *     "tenantId": "uuid",
   *     "institutionName": "Test University",
   *     "courseCount": 25,
   *     "userCount": 450,
   *     "submissionCount": 12500,
   *     "averageGrade": 78.5,
   *     "plagiarismFlagCount": 15
   *   },
   *   "error": null
   * }
   *
   * Notes:
   * - Full analytics implementation in Phase 5
   * - Currently returns basic institution info
   */
  @Get('analytics')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getAnalytics(
    @CurrentTenant() tenantId: string,
  ): Promise<{
    success: boolean;
    data: any;
    error: null;
  }> {
    try {
      const analytics = await this.institutionManagementService.getInstitutionAnalytics(
        tenantId,
      );

      return {
        success: true,
        data: analytics,
        error: null,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Sanitize institution object for response
   * (remove sensitive fields if needed)
   *
   * @param institution - Institution to sanitize
   * @returns Sanitized institution object
   */
  private sanitizeInstitution(institution: Institution): Partial<Institution> {
    return {
      id: institution.id,
      tenant_id: institution.tenant_id,
      name: institution.name,
      domain: institution.domain,
      timezone: institution.timezone,
      plagiarism_threshold: institution.plagiarism_threshold,
      ai_provider: institution.ai_provider,
      settings: institution.settings,
      created_at: institution.created_at,
      updated_at: institution.updated_at,
    };
  }
}
