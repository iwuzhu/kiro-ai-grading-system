import {
  IsEmail,
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  MaxLength,
  MinLength,
  IsNotEmpty,
} from 'class-validator';

/**
 * Create User DTO
 *
 * Validation:
 * - email: Required, must be valid email format
 * - name: Required, 1-255 characters
 * - role: Required, one of ADMIN|INSTRUCTOR|STUDENT
 * - password: Optional, minimum 8 characters if provided
 * - permissions: Optional, array of permission strings
 */
export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @MinLength(1)
  name: string;

  @IsEnum(['ADMIN', 'INSTRUCTOR', 'STUDENT'])
  @IsNotEmpty()
  role: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT';

  @IsString()
  @IsOptional()
  @MinLength(8)
  password?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  permissions?: string[];
}

/**
 * Update User DTO
 *
 * Partial update - all fields optional
 */
export class UpdateUserDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  @MinLength(1)
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;
}

/**
 * Bulk Import Users DTO
 *
 * CSV Format: email,name,role[,password]
 */
export class BulkImportUsersDto {
  @IsString()
  @IsNotEmpty()
  csvContent: string;
}

/**
 * Change User Role DTO
 */
export class ChangeUserRoleDto {
  @IsEnum(['ADMIN', 'INSTRUCTOR', 'STUDENT'])
  @IsNotEmpty()
  newRole: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT';
}

/**
 * Update User Status DTO
 */
export class UpdateUserStatusDto {
  @IsEnum(['ACTIVE', 'INACTIVE', 'INVITED'])
  @IsNotEmpty()
  status: 'ACTIVE' | 'INACTIVE' | 'INVITED';
}

/**
 * Update User Permissions DTO
 */
export class UpdateUserPermissionsDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  permissions: string[];
}

/**
 * User Response DTO (public view)
 */
export class UserResponseDto {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT';
  status: 'ACTIVE' | 'INACTIVE' | 'INVITED';
  permissions: string[];
  created_at: Date;
  updated_at: Date;
}

/**
 * Bulk Import Result DTO
 */
export class BulkImportResultDto {
  successCount: number;
  errors: Array<{ row: number; error: string }>;
  createdUsers: UserResponseDto[];
}
