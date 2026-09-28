import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsObject,
  Min,
  Max,
  IsNotEmpty,
} from 'class-validator';

/**
 * Update Institution Settings DTO
 *
 * Partial update - all fields optional
 */
export class UpdateInstitutionSettingsDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsObject()
  @IsOptional()
  settings?: Record<string, any>;
}

/**
 * Set Plagiarism Threshold DTO
 */
export class SetPlagiarismThresholdDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsNotEmpty()
  threshold: number;
}

/**
 * Set Grade Scale DTO
 */
export class SetGradeScaleDto {
  @IsEnum(['PERCENTAGE', 'LETTER', 'GPA'])
  @IsNotEmpty()
  type: 'PERCENTAGE' | 'LETTER' | 'GPA';

  @IsObject()
  @IsOptional()
  config?: Record<string, any>;
}

/**
 * Set AI Provider DTO
 */
export class SetAIProviderDto {
  @IsEnum(['openai', 'claude', 'bedrock'])
  @IsNotEmpty()
  provider: 'openai' | 'claude' | 'bedrock';
}

/**
 * Institution Response DTO
 */
export class InstitutionResponseDto {
  id: string;
  tenant_id: string;
  name: string;
  domain: string;
  timezone: string;
  plagiarism_threshold: number;
  ai_provider: 'openai' | 'claude' | 'bedrock';
  settings: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

/**
 * Institution Analytics DTO
 */
export class InstitutionAnalyticsDto {
  tenantId: string;
  institutionName: string;
  courseCount?: number;
  userCount?: number;
  submissionCount?: number;
  averageGrade?: number;
  plagiarismFlagCount?: number;
}
