import { IsString, IsOptional, IsUUID, IsNumber, IsDateString, IsBoolean, IsEnum, Min, Max, MinLength, MaxLength } from 'class-validator';

/**
 * DTO for creating a new assignment
 */
export class CreateAssignmentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(['ESSAY', 'CODE', 'QUIZ', 'SHORT_ANSWER', 'FILE'])
  type: string;

  @IsNumber()
  @Min(0.01)
  point_value: number;

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
}
