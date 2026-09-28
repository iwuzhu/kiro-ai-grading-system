import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlagiarismController } from './plagiarism.controller';
import { PlagiarismResult } from '@/domain/entities/plagiarism-result.entity';
import { PlagiarismFlag } from '@/domain/entities/plagiarism-flag.entity';
import { PlagiarismScanningService } from '@/domain/services/plagiarism-scanning.service';
import { PlagiarismFlagService } from '@/domain/services/plagiarism-flag.service';
import { PlagiarismInvestigationService } from '@/domain/services/plagiarism-investigation.service';
import { PlagiarismResultRepository } from '@/domain/repositories/plagiarism-result.repository';
import { PlagiarismFlagRepository } from '@/domain/repositories/plagiarism-flag.repository';
import { SubmissionRepository } from '@/domain/repositories/submission.repository';
import { UserRepository } from '@/domain/repositories/user.repository';
import { InstitutionRepository } from '@/domain/repositories/institution.repository';
import { CopyLeaksService } from '@/infrastructure/plagiarism/copyleaks.service';
import { LocalCorpusService } from '@/infrastructure/plagiarism/local-corpus.service';
import { AiDetectionService } from '@/infrastructure/plagiarism/ai-detection.service';
import { NotificationService } from '@/domain/services/notification.service';

/**
 * Plagiarism Module
 *
 * Provides plagiarism detection and investigation features.
 * Exports:
 * - PlagiarismScanningService: Orchestrates plagiarism detection (CopyLeaks + LocalCorpus + AI)
 * - PlagiarismFlagService: Manages plagiarism flags and notifications
 * - PlagiarismInvestigationService: Tracks investigation workflow
 * - CopyLeaksService: External CopyLeaks API integration (primary)
 * - LocalCorpusService: Institutional plagiarism corpus (enhanced with multiple algorithms)
 * - AiDetectionService: AI content detection
 */
@Module({
  imports: [TypeOrmModule.forFeature([PlagiarismResult, PlagiarismFlag])],
  controllers: [PlagiarismController],
  providers: [
    // Services
    PlagiarismScanningService,
    PlagiarismFlagService,
    PlagiarismInvestigationService,
    NotificationService,

    // Repositories
    PlagiarismResultRepository,
    PlagiarismFlagRepository,
    SubmissionRepository,
    UserRepository,
    InstitutionRepository,

    // External Integration Services
    CopyLeaksService,
    LocalCorpusService,
    AiDetectionService,
  ],
  exports: [
    PlagiarismScanningService,
    PlagiarismFlagService,
    PlagiarismInvestigationService,
    CopyLeaksService,
    LocalCorpusService,
    AiDetectionService,
  ],
})
export class PlagiarismModule {}

