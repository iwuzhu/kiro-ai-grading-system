import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GradingController } from './grading.controller';
import { Grade } from '../../domain/entities/grade.entity';
import { GradeOverride } from '../../domain/entities/grade-override.entity';
import { Submission } from '../../domain/entities/submission.entity';
import { Assignment } from '../../domain/entities/assignment.entity';
import { GradeOverrideService } from '../../domain/services/grade-override.service';
import { GradeRepository } from '../../domain/repositories/grade.repository';
import { GradeOverrideRepository } from '../../domain/repositories/grade-override.repository';
import { SubmissionRepository } from '../../domain/repositories/submission.repository';
import { AssignmentRepository } from '../../domain/repositories/assignment.repository';

/**
 * Grading Module
 *
 * Provides grading operations:
 * - Grade creation and retrieval (manual grading)
 * - Grade override workflow with audit trail
 * - Grading statistics
 *
 * Note: AI grading (GradingEngineService) is not included in this module
 * because it requires AIProviderFactory and PromptConstructionService
 * which will be implemented in a future phase.
 *
 * Exports:
 * - GradeOverrideService: Manual override management
 * - GradeRepository: Grade data access
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Grade,
      GradeOverride,
      Submission,
      Assignment,
    ]),
  ],
  controllers: [GradingController],
  providers: [
    GradeOverrideService,
    GradeRepository,
    GradeOverrideRepository,
    SubmissionRepository,
    AssignmentRepository,
  ],
  exports: [
    GradeOverrideService,
    GradeRepository,
  ],
})
export class GradingModule {}
