/**
 * Institutions Module
 *
 * Provides institution management endpoints:
 * - GET /api/v1/settings - Get institution settings
 * - PATCH /api/v1/settings - Update institution settings
 * - PATCH /api/v1/settings/plagiarism-threshold - Set plagiarism threshold
 * - PATCH /api/v1/settings/grade-scale - Set grade scale
 * - PATCH /api/v1/settings/ai-provider - Set AI provider
 * - GET /api/v1/settings/analytics - Get analytics
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { Institution } from '../../domain/entities/institution.entity';
import { AuditLog } from '../../domain/entities/audit-log.entity';

// Repositories
import { InstitutionRepository } from '../../domain/repositories/institution.repository';

// Services
import { InstitutionManagementService } from '../../application/services/institution-management.service';

// Controllers
import { InstitutionsController } from './institutions.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Institution, AuditLog]),
  ],
  controllers: [InstitutionsController],
  providers: [InstitutionRepository, InstitutionManagementService],
  exports: [InstitutionManagementService],
})
export class InstitutionsModule {}
