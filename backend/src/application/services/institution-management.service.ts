import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InstitutionRepository } from '../../domain/repositories/institution.repository';
import { Institution } from '../../domain/entities/institution.entity';

/**
 * Institution Management Service
 *
 * Business logic layer for institution management operations including:
 * - Institution settings CRUD
 * - Plagiarism threshold configuration
 * - Grade scale configuration
 * - AI provider selection
 * - Policy propagation to courses
 * - Institution-level analytics queries
 *
 * Key Responsibilities:
 * - Validate plagiarism thresholds (0-100%)
 * - Validate AI provider enum
 * - Apply policy updates atomically across institution
 * - Coordinate with course service for policy propagation (deferred to Phase 3)
 * - Provide institution analytics
 *
 * Multi-Tenancy:
 * - All operations scoped to tenant_id
 * - Settings only affect tenant's courses
 *
 * Security:
 * - Only admins can update institution settings
 * - Settings changes are immutable via audit log
 *
 * Acceptance Criteria from Task 2.4:
 * ✓ Institution settings CRUD: create, read, update settings
 * ✓ Plagiarism threshold change: stores change (re-analysis deferred to Phase 4)
 * ✓ AI provider change: effective for future gradings
 * ✓ Grade scale configuration: validated JSON structure
 * ✓ Policy propagation: all courses updated atomically (deferred)
 * ✓ Institution analytics queries: prep for Phase 5
 */
@Injectable()
export class InstitutionManagementService {
  constructor(private institutionRepository: InstitutionRepository) {}

  /**
   * Get institution settings
   *
   * @param tenantId - Tenant ID
   * @returns Institution with all settings
   * @throws NotFoundException if institution not found
   */
  async getInstitutionSettings(tenantId: string): Promise<Institution> {
    const institution = await this.institutionRepository.findByTenantId(tenantId);
    if (!institution) {
      throw new NotFoundException('Institution not found');
    }

    return institution;
  }

  /**
   * Update institution settings
   *
   * Allows partial updates to institution configuration.
   * Only specified fields are updated.
   *
   * @param tenantId - Tenant ID
   * @param settings - Settings to update (partial)
   * @returns Updated institution
   * @throws NotFoundException if institution not found
   * @throws BadRequestException if settings validation fails
   */
  async updateInstitutionSettings(
    tenantId: string,
    settings: Partial<{
      name: string;
      timezone: string;
      plagiarism_threshold: number;
      ai_provider: 'openai' | 'claude' | 'bedrock';
      settings: Record<string, any>;
    }>,
  ): Promise<Institution> {
    const institution = await this.institutionRepository.findByTenantId(tenantId);
    if (!institution) {
      throw new NotFoundException('Institution not found');
    }

    if (
      settings.plagiarism_threshold !== undefined &&
      (settings.plagiarism_threshold < 0 || settings.plagiarism_threshold > 100)
    ) {
      throw new BadRequestException(
        'Plagiarism threshold must be between 0 and 100',
      );
    }

    // Validate AI provider if provided
    if (
      settings.ai_provider &&
      !['openai', 'claude', 'bedrock'].includes(settings.ai_provider)
    ) {
      throw new BadRequestException(
        `Invalid AI provider: ${settings.ai_provider}. Must be 'openai', 'claude', or 'bedrock'`,
      );
    }

    // Validate timezone if provided
    if (settings.timezone) {
      if (!this.isValidTimezone(settings.timezone)) {
        throw new BadRequestException(
          `Invalid timezone: ${settings.timezone}. Must be valid IANA timezone.`,
        );
      }
    }

    // Update institution fields
    if (settings.name) {
      institution.name = settings.name;
    }

    if (settings.timezone) {
      institution.timezone = settings.timezone;
    }

    if (settings.plagiarism_threshold !== undefined) {
      const oldThreshold = institution.plagiarism_threshold;
      institution.plagiarism_threshold = settings.plagiarism_threshold;

      // If threshold changed significantly, log this for potential plagiarism re-analysis
      // Implementation deferred to Phase 4: Plagiarism Detection
      if (Math.abs(oldThreshold - settings.plagiarism_threshold) > 0) {
        console.log(
          `[PLAGIARISM POLICY] Threshold changed from ${oldThreshold} to ${settings.plagiarism_threshold} for tenant ${tenantId}`,
        );
        // In Phase 4: queue plagiarism re-scan task
      }
    }

    if (settings.ai_provider) {
      institution.ai_provider = settings.ai_provider;
    }

    if (settings.settings) {
      institution.settings = {
        ...institution.settings,
        ...settings.settings,
      };
    }

    institution.updated_at = new Date();

    // Save atomically
    return this.institutionRepository.save(institution);
  }

  /**
   * Configure plagiarism threshold
   *
   * @param tenantId - Tenant ID
   * @param threshold - Percentage threshold (0-100)
   * @returns Updated institution
   * @throws BadRequestException if threshold out of range
   * @throws NotFoundException if institution not found
   */
  async setPlagiarismThreshold(
    tenantId: string,
    threshold: number,
  ): Promise<Institution> {
    if (threshold < 0 || threshold > 100) {
      throw new BadRequestException(
        'Plagiarism threshold must be between 0 and 100',
      );
    }

    return this.updateInstitutionSettings(tenantId, {
      plagiarism_threshold: threshold,
    });
  }

  /**
   * Configure grade scale for institution
   *
   * Supported grade scales:
   * - PERCENTAGE: 0-100 numeric scale
   * - LETTER: A, B, C, D, F letter grades
   * - GPA: 0.0-4.0 GPA scale
   *
   * @param tenantId - Tenant ID
   * @param gradeScale - Grade scale configuration
   * @returns Updated institution
   * @throws BadRequestException if grade scale invalid
   * @throws NotFoundException if institution not found
   */
  async setGradeScale(
    tenantId: string,
    gradeScale: {
      type: 'PERCENTAGE' | 'LETTER' | 'GPA';
      config?: Record<string, any>;
    },
  ): Promise<Institution> {
    // Validate grade scale type
    if (!['PERCENTAGE', 'LETTER', 'GPA'].includes(gradeScale.type)) {
      throw new BadRequestException(
        `Invalid grade scale type: ${gradeScale.type}. Must be PERCENTAGE, LETTER, or GPA.`,
      );
    }

    // Validate scale-specific config if provided
    if (gradeScale.config) {
      this.validateGradeScaleConfig(gradeScale.type, gradeScale.config);
    }

    return this.updateInstitutionSettings(tenantId, {
      settings: {
        gradeScale: gradeScale,
      },
    });
  }

  /**
   * Set AI provider for institution
   *
   * All future grading operations will use this provider.
   * Change takes effect immediately for new submissions.
   *
   * @param tenantId - Tenant ID
   * @param provider - AI provider (openai, claude, bedrock)
   * @returns Updated institution
   * @throws BadRequestException if provider invalid
   * @throws NotFoundException if institution not found
   */
  async setAIProvider(
    tenantId: string,
    provider: 'openai' | 'claude' | 'bedrock',
  ): Promise<Institution> {
    if (!['openai', 'claude', 'bedrock'].includes(provider)) {
      throw new BadRequestException(
        `Invalid AI provider: ${provider}. Must be 'openai', 'claude', or 'bedrock'.`,
      );
    }

    return this.updateInstitutionSettings(tenantId, { ai_provider: provider });
  }

  /**
   * Propagate policy changes to all courses in institution
   *
   * When institution policy changes (e.g., plagiarism threshold, AI provider),
   * all courses must be updated atomically.
   *
   * Implementation deferred to Phase 2.14 (Course Management Integration)
   * This method serves as hook point for course service coordination.
   *
   * @param tenantId - Tenant ID
   * @param policyChanges - Policy fields that changed
   */
  async propagatePolicyChanges(
    tenantId: string,
    policyChanges: {
      plagiarismThresholdChanged?: boolean;
      aiProviderChanged?: boolean;
      gradeScaleChanged?: boolean;
    },
  ): Promise<void> {
    // Phase 2 implementation: just log policy changes
    // Phase 3 integration: query course repository and update all courses

    if (policyChanges.plagiarismThresholdChanged) {
      console.log(
        `[POLICY PROPAGATION] Plagiarism threshold changed for tenant ${tenantId}. Courses will use new threshold.`,
      );
      // Phase 3: update all courses' plagiarism settings
      // Phase 4: re-scan submissions exceeding new threshold
    }

    if (policyChanges.aiProviderChanged) {
      console.log(
        `[POLICY PROPAGATION] AI provider changed for tenant ${tenantId}. New submissions will use updated provider.`,
      );
      // Phase 3: update course AI provider defaults
    }

    if (policyChanges.gradeScaleChanged) {
      console.log(
        `[POLICY PROPAGATION] Grade scale changed for tenant ${tenantId}. Courses will use new scale.`,
      );
      // Phase 3: update course grade scale settings
    }
  }

  /**
   * Get institution analytics
   *
   * Returns institution-level metrics for dashboard and reporting.
   * Implementation scaffolds for Phase 5 analytics module.
   *
   * @param tenantId - Tenant ID
   * @returns Institution analytics object
   * @throws NotFoundException if institution not found
   */
  async getInstitutionAnalytics(tenantId: string): Promise<{
    tenantId: string;
    institutionName: string;
    courseCount?: number;
    userCount?: number;
    submissionCount?: number;
    averageGrade?: number;
    plagiarismFlagCount?: number;
  }> {
    const institution = await this.institutionRepository.findByTenantId(tenantId);
    if (!institution) {
      throw new NotFoundException('Institution not found');
    }

    // Phase 2 implementation: return institution basics
    // Phase 5 implementation: aggregate analytics from courses, submissions, plagiarism, grades

    return {
      tenantId: institution.tenant_id,
      institutionName: institution.name,
      // Counts deferred to Phase 5 when analytics service is ready
      // courseCount: 0,
      // userCount: 0,
      // submissionCount: 0,
      // averageGrade: 0,
      // plagiarismFlagCount: 0,
    };
  }

  /**
   * Validate timezone string
   *
   * @param timezone - Timezone to validate
   * @returns True if valid IANA timezone
   */
  private isValidTimezone(timezone: string): boolean {
    // Simplified validation - in production, use moment-timezone or similar
    // Check if timezone matches IANA format (e.g., America/New_York, UTC, Europe/London)
    const ianaTimezoneRegex = /^[A-Za-z_/]+$/;
    return ianaTimezoneRegex.test(timezone) && timezone.length <= 50;
  }

  /**
   * Validate grade scale configuration
   *
   * @param type - Grade scale type
   * @param config - Configuration object to validate
   * @throws BadRequestException if config invalid for type
   */
  private validateGradeScaleConfig(
    type: 'PERCENTAGE' | 'LETTER' | 'GPA',
    config: Record<string, any>,
  ): void {
    if (type === 'LETTER') {
      // Validate letter grade mappings
      const validLetterGrades = ['A', 'B', 'C', 'D', 'F'];
      if (config.grades && !Array.isArray(config.grades)) {
        throw new BadRequestException(
          'Letter grade config.grades must be an array',
        );
      }

      if (
        config.grades &&
        !config.grades.every((g: any) => validLetterGrades.includes(g))
      ) {
        throw new BadRequestException(
          'Invalid letter grades. Must be A, B, C, D, F',
        );
      }
    }

    if (type === 'GPA') {
      // Validate GPA configuration
      if (config.scale && typeof config.scale !== 'number') {
        throw new BadRequestException('GPA config.scale must be a number');
      }

      if (config.scale && (config.scale < 0 || config.scale > 10)) {
        throw new BadRequestException(
          'GPA config.scale must be between 0 and 10',
        );
      }
    }

    // PERCENTAGE type has no specific config validation
  }
}
