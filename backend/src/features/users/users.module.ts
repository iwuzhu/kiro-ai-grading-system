import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../domain/entities/user.entity';
import { Institution } from '../../domain/entities/institution.entity';
import { UsersController } from './users.controller';
import { UserManagementService } from '../../application/services/user-management.service';
import { UserRepository } from '../../domain/repositories/user.repository';
import { InstitutionRepository } from '../../domain/repositories/institution.repository';

/**
 * Users Module
 *
 * Provides REST API endpoints for user management operations:
 * - Create users
 * - List users with pagination and filtering
 * - Update user roles and permissions
 * - Deactivate/activate users
 * - Bulk import users from CSV
 *
 * Exports:
 * - UserManagementService: For user operations
 * - UserRepository: For user data access
 */
@Module({
  imports: [TypeOrmModule.forFeature([User, Institution])],
  controllers: [UsersController],
  providers: [UserManagementService, UserRepository, InstitutionRepository],
  exports: [UserManagementService, UserRepository, InstitutionRepository],
})
export class UsersModule {}
