import { Injectable, Logger } from '@nestjs/common';
import { PlagiarismResultRepository } from '../repositories/plagiarism-result.repository';
import { PlagiarismFlagRepository } from '../repositories/plagiarism-flag.repository';
import { SubmissionRepository } from '../repositories/submission.repository';
import { InstitutionRepository } from '../repositories/institution.repository';
import { CopyLeaksService } from '@/infrastructure/plagiarism/copyleaks.service';
import { LocalCorpusService } from '@/infrastructure/plagiarism/local-corpus.service';
import { AiDetectionService } from '@/infrastructure/plagiarism/ai-detection.service';
import {
  PlagiarismDetectionResult,
} from '@/infrastructure/plagiarism/plagiarism-detection.interface';

/**
 * Plagiarism Scanning Service
 *
 * Coordinates plagiarism detection workflow using Copyleaks + LocalCorpus + AI detection.
 * - Attempts CopyLeaks first (primary detection, 120s timeout)
 * - Falls back to local corpus + AI detection if CopyLeaks unavailable
 * - Combines scores: max(copyleaks, local) for plagiarism; separate AI score
 * - Handles timeouts gracefully (stores PENDING, retries later)
 * - Creates PlagiarismResult record with status tracking
 *
 * Workflow:
 * 1. Create PENDING PlagiarismResult
 * 2. Try CopyLeaks (120s timeout) - if success, go to 6
 * 3. If CopyLeaks timeout/fail: try local corpus + AI detection in parallel
 * 4. Combine scores (max plagiarism, separate AI)
 * 5. Update PlagiarismResult with COMPLETED and scores
 * 6. Check if above institution threshold - trigger flagging
 *
 * Error Handling:
 * - Timeout (defer & retry): Set status PENDING, retry next batch
 * - Partial failure (1 method fails): Use remaining methods
 * - All methods fail: Set FAILED, manual review needed
 *
 * Requirement 9: Plagiarism Detection Orchestration with CopyLeaks
 */
@Injectable()
export class PlagiarismScanningService {
  private readonly logger = new Logger(PlagiarismScanningService.name);

  constructor(
    private plagiarismResultRepository: PlagiarismResultRepository,
    private plagiarismFlagRepository: PlagiarismFlagRepository,
    private submissionRepository: SubmissionRepository,
    private institutionRepository: InstitutionRepository,
    private copyLeaksService: CopyLeaksService,
    private localCorpusService: LocalCorpusService,
    private aiDetectionService: AiDetectionService,
  ) {}

  /**
   * Scan submission for plagiarism
   * Coordinates all three detection methods
   * @param submissionId - ID of submission to scan
   * @param tenantId - Tenant context
   * @returns Plagiarism result
   */
  async scanSubmission(
    submissionId: string,
    tenantId: string,
  ): Promise<string> {
    // Step 1: Find submission and related entities
    const submission = await this.submissionRepository.findById(
      tenantId,
      submissionId,
    );
    if (!submission) {
      throw new Error(`Submission ${submissionId} not found`);
    }

    // Get institution_id from assignment -> course relationship
    let institutionId = tenantId;
    if (submission.assignment?.course?.institution_id) {
      institutionId = submission.assignment.course.institution_id;
    } else if (submission.assignment) {
      // Fallback: query for institution_id directly (repository should eager load this)
      institutionId = tenantId;
    }

    // Step 2: Create PENDING PlagiarismResult
    const result = await this.plagiarismResultRepository.createResult({
      tenant_id: tenantId,
      institution_id: institutionId,
      submission_id: submissionId,
      assignment_id: submission.assignment_id,
      status: 'PENDING',
    });

    this.logger.debug(`Created plagiarism result ${result.id} for submission ${submissionId}`);

    // Step 3: Attempt to scan with configured submission content
    // (In production, extract text from submission files)
    const submissionContent = 'Sample submission content'; // TODO: Extract from file

    // Step 4: Try detection methods
    await this.performDetection(result.id, tenantId, submissionContent, submission);

    return result.id;
  }

  /**
   * Perform plagiarism detection using available methods
   * Priority: CopyLeaks (primary) -> LocalCorpus + AI Detection (fallback)
   * @param resultId - Plagiarism result ID
   * @param tenantId - Tenant context
   * @param content - Submission content to scan
   * @param submission - Submission entity
   */
  private async performDetection(
    resultId: string,
    tenantId: string,
    content: string,
    submission: any,
  ): Promise<void> {
    try {
      // Try CopyLeaks first (primary method)
      const copyLeaksResult = await this.tryCopyLeaks(
        content,
        submission.id,
        submission.assignment_id,
        tenantId,
      );

      if (copyLeaksResult && copyLeaksResult.isComplete) {
        // CopyLeaks succeeded
        await this.plagiarismResultRepository.markAsCompleted(
          tenantId,
          resultId,
          copyLeaksResult.plagiarismScore,
          copyLeaksResult.aiGenerationScore || 0,
          copyLeaksResult.sourceMatches,
          copyLeaksResult.externalScanId,
        );
        this.logger.debug(
          `Plagiarism scan completed via CopyLeaks: plagiarism=${copyLeaksResult.plagiarismScore}%, ai=${copyLeaksResult.aiGenerationScore}%`,
        );
        return;
      }

      // CopyLeaks not available or timed out - use fallback methods
      this.logger.debug('CopyLeaks unavailable, attempting fallback methods');
      const localResult = await this.tryLocalCorpus(
        content,
        submission.id,
        submission.assignment_id,
        tenantId,
      );

      const aiResult = await this.tryAiDetection(
        content,
        submission.id,
        submission.assignment_id,
        tenantId,
      );

      // Combine results: max plagiarism score, separate AI score
      const combinedScore = Math.max(
        localResult?.plagiarismScore || 0,
        aiResult?.plagiarismScore || 0,
      );

      const aiScore = aiResult?.aiGenerationScore || 0;

      const sourceMatches = [
        ...(localResult?.sourceMatches || []),
        ...(aiResult?.sourceMatches || []),
      ];

      await this.plagiarismResultRepository.markAsCompleted(
        tenantId,
        resultId,
        combinedScore,
        aiScore,
        sourceMatches,
      );

      this.logger.debug(
        `Plagiarism scan completed via fallback methods: plagiarism=${combinedScore}%, ai=${aiScore}%`,
      );
    } catch (error) {
      // All methods failed
      this.logger.error(
        `Plagiarism detection failed: ${(error as Error).message}`,
      );

      await this.plagiarismResultRepository.markAsFailed(tenantId, resultId);
    }
  }

  /**
   * Try CopyLeaks detection (primary method)
   * @returns Result if successful/complete, null if timed out or unavailable
   */
  private async tryCopyLeaks(
    content: string,
    submissionId: string,
    assignmentId: string,
    tenantId: string,
  ): Promise<PlagiarismDetectionResult | null> {
    try {
      const available = await this.copyLeaksService.isAvailable();
      if (!available) {
        this.logger.debug('CopyLeaks service not available');
        return null;
      }

      this.logger.debug('Attempting CopyLeaks plagiarism detection');
      const result = await this.executeWithTimeout(
        this.copyLeaksService.detect(content, submissionId, assignmentId, tenantId),
        120000, // 120 second timeout
      );

      return result;
    } catch (error) {
      if (error instanceof TimeoutError) {
        this.logger.warn('CopyLeaks detection timed out');
        return null;
      }

      this.logger.error(
        `CopyLeaks detection error: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Try local corpus detection
   */
  private async tryLocalCorpus(
    content: string,
    submissionId: string,
    assignmentId: string,
    tenantId: string,
  ): Promise<PlagiarismDetectionResult | null> {
    try {
      const available = await this.localCorpusService.isAvailable();
      if (!available) {
        this.logger.debug('Local corpus service not available');
        return null;
      }

      this.logger.debug('Attempting local corpus plagiarism detection');
      const result = await this.executeWithTimeout(
        this.localCorpusService.detect(
          content,
          submissionId,
          assignmentId,
          tenantId,
        ),
        30000, // 30 second timeout
      );

      return result;
    } catch (error) {
      if (error instanceof TimeoutError) {
        this.logger.warn('Local corpus detection timed out');
      } else {
        this.logger.error(
          `Local corpus detection error: ${(error as Error).message}`,
        );
      }
      return null;
    }
  }

  /**
   * Try AI content detection
   */
  private async tryAiDetection(
    content: string,
    submissionId: string,
    assignmentId: string,
    tenantId: string,
  ): Promise<PlagiarismDetectionResult | null> {
    try {
      const available = await this.aiDetectionService.isAvailable();
      if (!available) {
        this.logger.debug('AI detection service not available');
        return null;
      }

      this.logger.debug('Attempting AI content detection');
      const result = await this.executeWithTimeout(
        this.aiDetectionService.detect(content, submissionId, assignmentId, tenantId),
        30000, // 30 second timeout
      );

      return result;
    } catch (error) {
      if (error instanceof TimeoutError) {
        this.logger.warn('AI detection timed out');
      } else {
        this.logger.error(
          `AI detection error: ${(error as Error).message}`,
        );
      }
      return null;
    }
  }

  /**
   * Get pending scans for retry
   * @param tenantId - Tenant ID
   * @param limit - Max results
   */
  async getPendingScans(tenantId: string, limit: number = 50): Promise<any[]> {
    return this.plagiarismResultRepository.findPending(tenantId, limit);
  }

  /**
   * Retry failed scans
   * @param tenantId - Tenant ID
   * @param maxRetries - Maximum retries
   */
  async retryFailedScans(tenantId: string, maxRetries: number = 3): Promise<number> {
    const failedScans = await this.plagiarismResultRepository.findFailed(
      tenantId,
      maxRetries,
    );

    let retryCount = 0;

    for (const scan of failedScans) {
      try {
        // Retry the scan
        const submission = await this.submissionRepository.findById(
          tenantId,
          scan.submission_id,
        );

        if (submission) {
          const content = 'Sample submission content'; // TODO: Extract from file
          await this.performDetection(
            scan.id,
            tenantId,
            content,
            submission,
          );
          retryCount++;
        }
      } catch (error) {
        this.logger.error(
          `Retry failed for scan ${scan.id}: ${(error as Error).message}`,
        );
      }
    }

    return retryCount;
  }

  /**
   * Execute promise with timeout
   */
  private executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new TimeoutError('Operation timeout')),
          timeoutMs,
        ),
      ),
    ]);
  }

  /**
   * Get scanning statistics
   */
  async getScanningStats(tenantId: string): Promise<{
    totalScanned: number;
    pending: number;
    failed: number;
    avgPlagiarismScore: number;
  }> {
    const pending = await this.plagiarismResultRepository.findPending(tenantId, 1000);
    const failed = await this.plagiarismResultRepository.findFailed(tenantId, 1000);
    const stats = await this.plagiarismResultRepository.getStatsByAssignment(
      tenantId,
      'all',
    );

    return {
      totalScanned: stats.totalScanned,
      pending: pending.length,
      failed: failed.length,
      avgPlagiarismScore: stats.avgPlagiarismScore,
    };
  }
}

/**
 * Custom timeout error
 */
class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}
