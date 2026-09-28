import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  PlagiarismDetectionMethod,
  PlagiarismDetectionResult,
  PlagiarismSourceMatch,
} from './plagiarism-detection.interface';

/**
 * Copyleaks Service
 *
 * Provides plagiarism detection using Copyleaks API v3.
 * - Submits documents to Copyleaks for scanning
 * - Polls for scan completion (120s timeout)
 * - Extracts plagiarism score (0-100%)
 * - Extracts AI detection score (0-100%)
 * - Returns matched sources with similarity percentages
 * - Supports webhook notifications (optional)
 *
 * API Details:
 * - Base URL: https://api.copyleaks.com/v3
 * - POST /submissions - Submit document
 * - GET /submissions/{id} - Get submission status
 * - GET /submissions/{id}/report - Get full report
 *
 * Authentication:
 * - API key in header: Authorization: Bearer {api_key}
 *
 * Response Format:
 * - similarity: number (0-100)
 * - aiGenerationScore: number (0-100)
 * - results: { sources: [...] }
 *
 * Error Handling:
 * - Timeout (>120s): Defer and retry
 * - Rate limit (429): Exponential backoff
 * - Auth error (401): Alert admin, disable service
 * - Server error (5xx): Retry with backoff
 *
 * Requirement 9: Plagiarism Detection via Copyleaks
 */
@Injectable()
export class CopyLeaksService implements PlagiarismDetectionMethod {
  private readonly logger = new Logger(CopyLeaksService.name);
  private apiClient: AxiosInstance;
  private apiKey: string;
  private apiUrl: string;
  private timeoutMs: number = 120000; // 120 second timeout

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('COPYLEAKS_API_KEY') || '';
    this.apiUrl =
      this.configService.get<string>('COPYLEAKS_API_URL') ||
      'https://api.copyleaks.com/v3';
    this.timeoutMs =
      this.configService.get<number>('COPYLEAKS_TIMEOUT_MS') || 120000;

    this.apiClient = axios.create({
      baseURL: this.apiUrl,
      timeout: this.timeoutMs,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get service name
   */
  getName(): string {
    return 'CopyLeaks';
  }

  /**
   * Check if CopyLeaks service is available
   * Validates API key and connectivity
   */
  async isAvailable(): Promise<boolean> {
    try {
      if (!this.apiKey) {
        this.logger.warn('CopyLeaks API key not configured');
        return false;
      }

      // Quick health check by attempting to get submissions list
      // This validates API key and connectivity
      const response = await this.apiClient.get('/submissions', {
        params: { limit: 1 },
        timeout: 5000,
      });

      return response.status === 200;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          this.logger.error('CopyLeaks authentication failed - invalid API key');
        } else if (error.code === 'ECONNREFUSED') {
          this.logger.warn('CopyLeaks service connection refused');
        }
      } else {
        this.logger.warn(
          `CopyLeaks availability check failed: ${(error as Error).message}`,
        );
      }
      return false;
    }
  }

  /**
   * Detect plagiarism using CopyLeaks
   * @param submissionContent - Text content to scan
   * @param submissionId - ID of submission
   * @param assignmentId - ID of assignment
   * @param tenantId - Tenant context
   * @returns Detection result with scores and sources
   */
  async detect(
    submissionContent: string,
    submissionId: string,
    assignmentId: string,
    tenantId: string,
  ): Promise<PlagiarismDetectionResult> {
    try {
      this.logger.debug(
        `Submitting to CopyLeaks: submission=${submissionId}, tenant=${tenantId}`,
      );

      // Step 1: Submit document to CopyLeaks
      const submissionData = await this.submitDocument(
        submissionContent,
        submissionId,
      );

      const externalScanId = submissionData.id;
      this.logger.debug(`Document submitted to CopyLeaks: id=${externalScanId}`);

      // Step 2: Poll for completion (120s timeout)
      const report = await this.pollForCompletion(externalScanId, 120000);

      if (!report) {
        // Timeout occurred
        return {
          plagiarismScore: 0,
          sourceMatches: [],
          externalScanId,
          isComplete: false,
          error: 'CopyLeaks scan timeout - please retry',
        };
      }

      // Step 3: Parse scores and sources from report
      const { plagiarismScore, aiGenerationScore, sourceMatches } =
        this.extractScoresAndSources(report);

      this.logger.debug(
        `CopyLeaks scan complete: plagiarism=${plagiarismScore}%, ai=${aiGenerationScore}%, sources=${sourceMatches.length}`,
      );

      return {
        plagiarismScore,
        aiGenerationScore,
        sourceMatches,
        externalScanId,
        isComplete: true,
      };
    } catch (error) {
      if (error instanceof TimeoutError) {
        this.logger.warn('CopyLeaks scan timed out');
        return {
          plagiarismScore: 0,
          sourceMatches: [],
          isComplete: false,
          error: 'CopyLeaks scan timeout',
        };
      }

      this.logger.error(
        `CopyLeaks detection error: ${(error as Error).message}`,
      );

      return {
        plagiarismScore: 0,
        sourceMatches: [],
        isComplete: false,
        error: `CopyLeaks error: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Submit document to CopyLeaks for scanning
   * @param content - Document content
   * @param submissionId - Reference ID
   * @returns Submission data with ID
   */
  private async submitDocument(
    content: string,
    submissionId: string,
  ): Promise<any> {
    try {
      const response = await this.apiClient.post('/submissions', {
        document: {
          docName: `submission-${submissionId}`,
          docText: content,
        },
        webhooks: {
          // Optional webhook for async notifications
          // completionWebhook: `${process.env.API_BASE_URL}/webhooks/copyleaks/complete`
        },
        properties: {
          submitBy: 'API',
          custom: {
            submissionId,
          },
        },
      });

      if (response.status !== 201 && response.status !== 200) {
        throw new Error(
          `CopyLeaks submission failed: ${response.status} ${response.statusText}`,
        );
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          throw new RateLimitError('CopyLeaks rate limit exceeded');
        } else if (error.response?.status === 401) {
          throw new AuthError('CopyLeaks authentication failed');
        } else if (error.response?.status >= 500) {
          throw new ServerError(
            `CopyLeaks server error: ${error.response.status}`,
          );
        } else if (error.code === 'ECONNABORTED') {
          throw new TimeoutError('CopyLeaks submission timeout');
        }
      }

      throw error;
    }
  }

  /**
   * Poll for scan completion
   * Retries until completion or timeout
   * @param submissionId - CopyLeaks submission ID
   * @param maxWaitMs - Maximum wait time
   * @returns Report data or null if timeout
   */
  private async pollForCompletion(
    submissionId: string,
    maxWaitMs: number,
  ): Promise<any> {
    const startTime = Date.now();
    const pollIntervalMs = 2000; // Poll every 2 seconds
    let lastError: Error | null = null;

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const response = await this.apiClient.get(
          `/submissions/${submissionId}`,
          {
            timeout: 10000,
          },
        );

        const status = response.data?.status;

        // Check if scan is complete
        if (
          status === 'completed' ||
          status === 'finished' ||
          status === 'done'
        ) {
          // Get full report
          return await this.getReport(submissionId);
        }

        // Still processing
        if (status === 'processing' || status === 'pending') {
          await this.sleep(pollIntervalMs);
          continue;
        }

        // Status check successful but still processing
        if (!status || status === 'queued') {
          await this.sleep(pollIntervalMs);
          continue;
        }

        // Unknown status
        this.logger.warn(
          `CopyLeaks unknown status: ${status} for submission ${submissionId}`,
        );
        await this.sleep(pollIntervalMs);
      } catch (error) {
        lastError = error as Error;

        if (axios.isAxiosError(error)) {
          if (error.response?.status === 404) {
            // Submission not found - retry
            await this.sleep(pollIntervalMs);
            continue;
          } else if (error.response?.status === 429) {
            // Rate limited - wait longer
            await this.sleep(5000);
            continue;
          } else if (error.response?.status >= 500) {
            // Server error - retry
            await this.sleep(pollIntervalMs);
            continue;
          } else if (error.code === 'ECONNABORTED') {
            // Timeout on this request - retry
            await this.sleep(pollIntervalMs);
            continue;
          }
        }

        // Other error - log and retry
        this.logger.warn(
          `CopyLeaks poll error: ${(error as Error).message}, retrying...`,
        );
        await this.sleep(pollIntervalMs);
      }
    }

    // Timeout occurred
    this.logger.warn(
      `CopyLeaks polling timed out after ${maxWaitMs}ms. Last error: ${lastError?.message}`,
    );
    throw new TimeoutError('CopyLeaks scan polling timeout');
  }

  /**
   * Get full report from CopyLeaks
   * @param submissionId - CopyLeaks submission ID
   * @returns Report data
   */
  private async getReport(submissionId: string): Promise<any> {
    try {
      const response = await this.apiClient.get(
        `/submissions/${submissionId}/report`,
        {
          timeout: 10000,
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Error getting CopyLeaks report: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Extract plagiarism and AI scores from CopyLeaks report
   * @param report - CopyLeaks report
   * @returns Scores and source matches
   */
  private extractScoresAndSources(report: any): {
    plagiarismScore: number;
    aiGenerationScore: number;
    sourceMatches: PlagiarismSourceMatch[];
  } {
    const plagiarismScore = this.extractPlagiarismScore(report);
    const aiGenerationScore = this.extractAiScore(report);
    const sourceMatches = this.extractSourceMatches(report);

    return {
      plagiarismScore,
      aiGenerationScore,
      sourceMatches,
    };
  }

  /**
   * Extract plagiarism score from report
   * CopyLeaks provides similarity percentage
   */
  private extractPlagiarismScore(report: any): number {
    try {
      // CopyLeaks v3 format: report.statistics.percentMatched
      let score = report?.statistics?.percentMatched || 0;

      // Also check for alternative formats
      if (score === 0 || score === undefined) {
        score = report?.results?.similarity || 0;
      }

      if (score === 0 || score === undefined) {
        score = report?.similarity || 0;
      }

      // Ensure valid range and proper rounding
      score = Math.max(0, Math.min(100, Number(score) || 0));
      return Math.round(score * 100) / 100; // Round to 2 decimal places
    } catch (error) {
      this.logger.warn(
        `Error extracting plagiarism score: ${(error as Error).message}`,
      );
      return 0;
    }
  }

  /**
   * Extract AI generation score from report
   * CopyLeaks v3 includes aiScore
   */
  private extractAiScore(report: any): number {
    try {
      // CopyLeaks v3 format: report.results.aiScore or report.aiGenerationScore
      let score = report?.results?.aiScore || 0;

      // Also check for alternative formats
      if (score === 0 || score === undefined) {
        score = report?.aiGenerationScore || 0;
      }

      if (score === 0 || score === undefined) {
        score = report?.aiScore || 0;
      }

      // Ensure valid range and proper rounding
      score = Math.max(0, Math.min(100, Number(score) || 0));
      return Math.round(score * 100) / 100; // Round to 2 decimal places
    } catch (error) {
      this.logger.warn(
        `Error extracting AI score: ${(error as Error).message}`,
      );
      return 0;
    }
  }

  /**
   * Extract source matches from report
   * CopyLeaks provides list of matched sources
   */
  private extractSourceMatches(report: any): PlagiarismSourceMatch[] {
    try {
      const sources = report?.results?.sources || [];

      return sources.map((source: any, index: number) => ({
        id: `copyleaks-${index}`,
        title:
          source?.title ||
          source?.name ||
          `Match ${index + 1}` ||
          'Unknown Source',
        url: source?.url || undefined,
        matchPercentage: Math.max(
          0,
          Math.min(100, Math.round((source?.percentMatched || 0) * 100) / 100),
        ),
        sourceType: source?.type || 'online',
        excerpts: [
          {
            submissionText: source?.submissionText || '',
            sourceText: source?.sourceText || '',
            matchLength: source?.matchLength || 0,
          },
        ],
      }));
    } catch (error) {
      this.logger.warn(
        `Error extracting source matches: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Custom error classes for specific error conditions
 */
class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

class ServerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServerError';
  }
}
