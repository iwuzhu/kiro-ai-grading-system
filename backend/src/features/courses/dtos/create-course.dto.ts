import { IsString, IsOptional, IsUUID, IsDateString, MinLength, MaxLength } from 'class-validator';

/**
 * DTO for creating a new course
 */
export class CreateCourseDto {
  @IsUUID()
  institution_id: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  code: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  semester_start?: string;

  @IsOptional()
  @IsDateString()
  semester_end?: string;
}
