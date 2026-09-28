import { IsString, IsOptional, IsEnum, IsDateString, MinLength, MaxLength } from 'class-validator';

/**
 * DTO for updating a course
 */
export class UpdateCourseDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  semester_start?: string;

  @IsOptional()
  @IsDateString()
  semester_end?: string;

  @IsOptional()
  @IsEnum(['DRAFT', 'ACTIVE', 'ARCHIVED'])
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
}
