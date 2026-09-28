import { IsString, IsOptional, IsObject, IsBoolean, MinLength, MaxLength } from 'class-validator';

/**
 * DTO for creating a rubric
 */
export class CreateRubricDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsObject()
  criteria: any; // JSONB structure

  @IsOptional()
  @IsBoolean()
  is_template?: boolean;
}
