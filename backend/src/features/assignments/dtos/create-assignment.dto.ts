import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsDateString,
  IsBoolean,
  IsEnum,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for creating a new assignment
 * 
 * Supports both legacy (type + point_value) and new (JSONB content) formats
 * 
 * New format example:
 * {
 *   "title": "Quiz 1",
 *   "content": {
 *     "Multiple Choice": {
 *       "RubricNote": "...",
 *       "Question 1": { "What is...": { "Result": "...", "Answer": "", "Points": 5 } }
 *     }
 *   },
 *   "published_status": "draft"
 * }
 */
export class CreateAssignmentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  /**
   * JSONB content: Organized by question type with questions and rubric notes
   * New multi-question format
   */
  @IsOptional()
  @Type(() => Object)
  @IsObject()
  content?: Record<string, any>;

  /**
   * Legacy: Type of assignment (kept for backward compatibility)
   * Only used if content is not provided
   */
  @IsOptional()
  @IsEnum(['ESSAY', 'CODE', 'MULTIPLE_CHOICE', 'FILL_BLANK', 'SHORT_ANSWER', 'FILE'])
  type?: string;

  /**
   * Legacy: Points value (kept for backward compatibility)
   * Only used if content is not provided
   */
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  point_value?: number;

  @IsOptional()
  @IsUUID()
  rubric_id?: string;

  @IsOptional()
  @IsBoolean()
  allow_incremental?: boolean;

  @IsOptional()
  @IsDateString()
  soft_deadline?: string;

  @IsOptional()
  @IsDateString()
  hard_deadline?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  late_penalty_percent?: number;

  /**
   * Published status: 'draft', 'published', or 'archived'
   */
  @IsOptional()
  @Type(() => String)
  @IsEnum(['draft', 'published', 'archived'])
  published_status?: string;
}
