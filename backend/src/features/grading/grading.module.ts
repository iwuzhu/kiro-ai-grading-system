import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GradingController } from './grading.controller';
import { Grade } from '../../domain/entities/grade.entity';
import { GradeOverride } from '../../domain/entities/grade-override.entity';
import { Submission } from '../../domain/entities/submission.entity';
import { Assignment } from '../../domain/entities/assignment.entity';
import { GradeOverrideService } from '../../domain/services/grade-override.service';
import { AIGradingService } from '../../domain/services/ai-grading.service';
import { GradeRepository } from '../../domain/repositories/grade.repository';
import { GradeOverrideRepository } from '../../domain/repositories/grade-override.repository';
import { SubmissionRepository } from '../../domain/repositories/submission.repository';
import { AssignmentRepository } from '../../domain/repositories/assignment.repository';
import { OpenAIProvider } from '../../infrastructure/ai/openai.provider';

/**
 * Grading Module
 *
 * Provides grading operations:
 * - Grade creation and retrieval (manual grading)
 * - Grade override workflow with audit trail
 * - AI-powered grading via ChatGPT
 *
 * AI Grading:
 * - OpenAIProvider: ChatGPT (GPT-4o) integration
 * - AIGradingService: Orchestrates AI grading workflow
 *
 * Exports:
 * - GradeOverrideService: Manual override management
 * - GradeRepository: Grade data access
 * - AIGradingService: AI grading operations
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
    AIGradingService,
    GradeRepository,
    GradeOverrideRepository,
    SubmissionRepository,
    AssignmentRepository,
    OpenAIProvider,
    // Provide OpenAIProvider as the AIProvider interface
    {
      provide: 'AIProvider',
      useClass: OpenAIProvider,
    },
  ],
  exports: [
    GradeOverrideService,
    GradeRepository,
    AIGradingService,
  ],
})
export class GradingModule {}
