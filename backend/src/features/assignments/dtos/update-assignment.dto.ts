import { IsString, IsOptional, IsUUID, IsNumber, IsDateString, IsBoolean, Min, Max, MinLength, MaxLength } from 'class-validator';

/**
 * DTO for updating an assignment
 */
export class UpdateAssignmentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

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
}
