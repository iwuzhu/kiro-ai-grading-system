import { IsArray, IsEmail, IsOptional, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for enrolling a single student via email
 */
export class EnrollStudentDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsEnum(['STUDENT', 'INSTRUCTOR'])
  role?: 'STUDENT' | 'INSTRUCTOR';
}

/**
 * DTO for bulk enrolling students from CSV
 */
export class EnrollStudentsFromCsvDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EnrollStudentDto)
  students: EnrollStudentDto[];
}
