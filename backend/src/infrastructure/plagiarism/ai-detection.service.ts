import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PlagiarismDetectionMethod,
  PlagiarismDetectionResult,
} from './plagiarism-detection.interface';

/**
 * AI Content Detection Service
 *
 * Detects AI-generated content in submissions.
 * - Supports multiple pluggable detection strategies
 * - Returns AI generation score (0-100%)
 * - Separate from plagiarism detection (distinct metric)
 * - Supports fallback strategies if primary method unavailable
 *
 * Detection Strategies:
 * 1. GPT-2 Detector (local, free, good baseline)
 * 2. ZeroGPT API (online, high accuracy)
 * 3. OpenAI Moderator API (via OpenAI endpoint)
 *
 * Performance Targets:
 * - True Positive Rate (TPR): > 80% for AI content
 * - False Positive Rate (FPR): < 10% for human content
 * - Processing time: < 10 seconds per submission
 *
 * Note:
 * - AI detection is probabilistic, not deterministic
 * - Used in combination with plagiarism score, not replacement
 * - Should trigger instructor review, not automatic action
 *
 * Requirement 9.3: AI Content Detection
 */
@Injectable()
export class AiDetectionService implements PlagiarismDetectionMethod {
  private readonly logger = new Logger(AiDetectionService.name);
  private strategies: AiDetectionStrategy[] = [];
  private primaryStrategy: AiDetectionStrategy | null = null;

  constructor(private configService: ConfigService) {
    this.initializeStrategies();
  }

  /**
   * Get service name
   */
  getName(): string {
    return 'AI Content Detection';
  }

  /**
   * Check if AI detection service is available
   */
  async isAvailable(): Promise<boolean> {
    if (this.strategies.length === 0) {
      this.logger.warn('No AI detection strategies available');
      return false;
    }

    // Check if at least one strategy is available
    for (const strategy of this.strategies) {
      if (await strategy.isAvailable()) {
        return true;
      }
    }

    return false;
  }

  /**
   * Initialize available detection strategies
   */
  private initializeStrategies(): void {
    const strategies: AiDetectionStrategy[] = [];

    // Strategy 1: ZeroGPT API (recommended)
    const zerogptKey =
      this.configService.get<string>('ZEROGPT_API_KEY');
    if (zerogptKey) {
      strategies.push(
        new ZeroGptStrategy(zerogptKey, this.logger),
      );
      this.logger.debug('ZeroGPT AI detection strategy initialized');
    }

    // Strategy 2: GPT-2 Local Detector (fallback)
    strategies.push(new Gpt2LocalStrategy(this.logger));
    this.logger.debug('GPT-2 local AI detection strategy initialized');

    // Strategy 3: OpenAI Moderation (supplementary)
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (openaiKey) {
      strategies.push(new OpenaiModerationStrategy(openaiKey, this.logger));
      this.logger.debug('OpenAI moderation AI detection strategy initialized');
    }

    this.strategies = strategies;
    this.primaryStrategy = strategies[0] || null;
  }

  /**
   * Detect AI-generated content in submission
   * @param submissionContent - Text content to analyze
   * @param submissionId - ID of submission
   * @param assignmentId - ID of assignment
   * @param tenantId - Tenant context
   * @returns Detection result with AI score
   */
  async detect(
    submissionContent: string,
    submissionId: string,
    assignmentId: string,
    tenantId: string,
  ): Promise<PlagiarismDetectionResult> {
    try {
      // Normalize content
      const content = submissionContent.trim();

      if (content.length === 0) {
        return {
          plagiarismScore: 0,
          aiGenerationScore: 0,
          sourceMatches: [],
          isComplete: true,
        };
      }

      // Skip very short submissions (less likely to be AI-generated)
      if (content.length < 100) {
        return {
          plagiarismScore: 0,
          aiGenerationScore: 0,
          sourceMatches: [],
          isComplete: true,
        };
      }

      this.logger.debug(
        `Detecting AI content in submission ${submissionId}`,
      );

      // Try primary strategy first, then fallback
      let aiScore = 0;

      // Use primary strategy
      if (this.primaryStrategy && (await this.primaryStrategy.isAvailable())) {
        aiScore = await this.primaryStrategy.detectAiScore(content);
        this.logger.debug(
          `Primary strategy (${this.primaryStrategy.getName()}) returned AI score: ${aiScore}%`,
        );
      }

      // If primary failed or no confidence, try fallback
      if (aiScore === 0 || aiScore === -1) {
        for (const strategy of this.strategies) {
          if (
            strategy !== this.primaryStrategy &&
            (await strategy.isAvailable())
          ) {
            const score = await strategy.detectAiScore(content);
            if (score >= 0) {
              aiScore = score;
              this.logger.debug(
                `Fallback strategy (${strategy.getName()}) returned AI score: ${aiScore}%`,
              );
              break;
            }
          }
        }
      }

      // Ensure score is in valid range
      aiScore = Math.min(100, Math.max(0, aiScore));

      this.logger.debug(
        `AI content detection complete for submission ${submissionId}: score=${aiScore}%`,
      );

      return {
        plagiarismScore: 0, // AI detection doesn't score plagiarism
        aiGenerationScore: aiScore,
        sourceMatches: [],
        isComplete: true,
      };
    } catch (error) {
      this.logger.error(
        `AI detection error: ${(error as Error).message}`,
      );

      return {
        plagiarismScore: 0,
        aiGenerationScore: 0,
        sourceMatches: [],
        isComplete: false,
        error: `AI detection error: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Get list of available detection strategies
   */
  getAvailableStrategies(): string[] {
    return this.strategies.map((s) => s.getName());
  }
}

/**
 * Interface for AI detection strategies
 */
interface AiDetectionStrategy {
  getName(): string;
  isAvailable(): Promise<boolean>;
  detectAiScore(content: string): Promise<number>;
}

/**
 * ZeroGPT API Strategy
 * Uses ZeroGPT's machine learning model for AI detection
 */
class ZeroGptStrategy implements AiDetectionStrategy {
  private apiUrl = 'https://api.zerogpt.com/api/detect';

  constructor(private apiKey: string, private logger: Logger) {}

  getName(): string {
    return 'ZeroGPT API';
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: 'HEAD',
      });
      return response.ok;
    } catch (error) {
      this.logger.warn(`ZeroGPT availability check failed: ${(error as Error).message}`);
      return false;
    }
  }

  async detectAiScore(content: string): Promise<number> {
    try {
      const formData = new FormData();
      formData.append('text', content);

      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        this.logger.warn(
          `ZeroGPT API error: ${response.status} ${response.statusText}`,
        );
        return -1;
      }

      const data = (await response.json()) as any;
      // ZeroGPT returns 'fakeprobability' or 'fake_percentage'
      const score =
        data.fakeprobability ||
        data.fake_percentage ||
        data.ai_percentage ||
        0;

      return Math.min(100, Math.max(0, Number(score) || 0));
    } catch (error) {
      this.logger.error(
        `ZeroGPT detection error: ${(error as Error).message}`,
      );
      return -1;
    }
  }
}

/**
 * GPT-2 Local Strategy
 * Uses simple local heuristics based on text characteristics
 * (Placeholder for actual GPT-2 model integration)
 */
class Gpt2LocalStrategy implements AiDetectionStrategy {
  constructor(private logger: Logger) {}

  getName(): string {
    return 'GPT-2 Local';
  }

  async isAvailable(): Promise<boolean> {
    // Local strategy is always available
    return true;
  }

  async detectAiScore(content: string): Promise<number> {
    // Simple heuristic-based detection
    // In production, this would use actual ML model
    return this.analyzeWithHeuristics(content);
  }

  /**
   * Heuristic analysis for AI content
   * Looks for patterns typical of AI-generated text
   */
  private analyzeWithHeuristics(content: string): number {
    let score = 0;
    let indicators = 0;

    // Check 1: Excessive transitional phrases (AI loves these)
    const transitionPhrases =
      /\b(furthermore|moreover|in addition|consequently|therefore|thus|in conclusion|ultimately)\b/gi;
    const transitionCount = (content.match(transitionPhrases) || []).length;
    if (transitionCount > content.split('.').length * 0.15) {
      score += 10;
    }
    indicators++;

    // Check 2: Repetitive structure (AI patterns)
    const sentences = content.split(/[.!?]+/).filter((s) => s.trim());
    if (sentences.length > 0) {
      const avgLength =
        sentences.reduce((sum, s) => sum + s.split(' ').length, 0) /
        sentences.length;
      // AI tends to use consistent sentence lengths
      if (avgLength > 15 && avgLength < 25) {
        score += 5;
      }
    }
    indicators++;

    // Check 3: Formal tone indicators
    const formalWords =
      /\b(necessitates|demonstrates|illustrates|exemplifies|encompasses|facilitate)\b/gi;
    const formalCount = (content.match(formalWords) || []).length;
    if (formalCount > content.split(' ').length * 0.01) {
      score += 10;
    }
    indicators++;

    // Check 4: Paragraph structure regularity
    const paragraphs = content.split('\n\n').filter((p) => p.trim());
    if (
      paragraphs.length > 2 &&
      paragraphs.every((p) => p.split(' ').length > 50)
    ) {
      score += 5;
    }
    indicators++;

    // Normalize score
    const normalizedScore = Math.round((score / (indicators * 10)) * 100);
    return Math.min(100, Math.max(0, normalizedScore));
  }
}

/**
 * OpenAI Moderation Strategy
 * Uses OpenAI's moderation API (supplementary)
 */
class OpenaiModerationStrategy implements AiDetectionStrategy {
  private apiUrl = 'https://api.openai.com/v1/moderations';

  constructor(private apiKey: string, private logger: Logger) {}

  getName(): string {
    return 'OpenAI Moderation';
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      // OpenAI moderations are supplementary, not primary AI detection
      return true;
    } catch (error) {
      this.logger.warn(
        `OpenAI availability check failed: ${(error as Error).message}`,
      );
      return false;
    }
  }

  async detectAiScore(content: string): Promise<number> {
    try {
      // Note: OpenAI moderation API is primarily for content policy, not AI detection
      // This is a placeholder - actual implementation would use Claude or similar
      this.logger.debug(
        'OpenAI moderation is supplementary, not used for AI detection score',
      );
      return -1; // Return -1 to indicate strategy not applicable
    } catch (error) {
      this.logger.error(
        `OpenAI moderation error: ${(error as Error).message}`,
      );
      return -1;
    }
  }
}
