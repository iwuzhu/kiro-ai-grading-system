/**
 * AI Provider Interface (Task 3.5)
 *
 * Defines the contract for pluggable AI grading providers.
 * All providers (OpenAI, Anthropic, Bedrock) implement this interface.
 *
 * Supported Providers:
 * - OpenAI (GPT-4 Turbo)
 * - Anthropic (Claude 3 Opus)
 * - AWS Bedrock (Titan, Claude)
 *
 * Requirements Met:
 * ✓ 3.5: AI Provider Factory Pattern
 * ✓ 7: AI Grading Engine support for multiple providers
 */

/**
 * Result from AI grading
 */
export interface GradingResult {
  /** Numerical score (0-100, 2 decimal places) */
  score: number;

  /** Confidence level (0-100, 2 decimal places) */
  confidence: number;

  /** Detailed feedback text */
  feedback: string;

  /** Array of identified strengths */
  strengths: string[];

  /** Array of areas for improvement */
  improvements: string[];

  /** Optional: code-specific comments */
  code_comments?: CodeComment[];

  /** Raw response from AI provider for debugging */
  raw_response?: unknown;
}

/**
 * Code-specific comment from AI grader
 */
export interface CodeComment {
  /** Line number in code */
  line_number: number;

  /** Code snippet */
  code: string;

  /** Comment text */
  comment: string;

  /** Severity: error, warning, info */
  severity: 'error' | 'warning' | 'info';

  /** Suggested fix (optional) */
  suggested_fix?: string;
}

/**
 * Configuration for AI provider
 */
export interface AIProviderConfig {
  /** API key for the provider */
  api_key: string;

  /** Model name/ID (e.g., 'gpt-4-turbo', 'claude-3-opus') */
  model: string;

  /** Maximum tokens for response */
  max_tokens?: number;

  /** Temperature for response randomness (0-1) */
  temperature?: number;

  /** Custom endpoint (for proxies or self-hosted) */
  endpoint?: string;

  /** Request timeout in milliseconds */
  timeout?: number;

  /** Maximum retries on failure */
  max_retries?: number;
}

/**
 * AI Provider Interface
 */
export interface IAIProvider {
  /**
   * Initialize the provider with configuration
   * @param config - Provider configuration
   */
  initialize(config: AIProviderConfig): Promise<void>;

  /**
   * Grade a submission
   * @param submission_text - Student submission text
   * @param rubric - Rubric criteria for grading
   * @param assignment_description - Assignment description for context
   * @returns Grading result with score, confidence, and feedback
   */
  grade(
    submission_text: string,
    rubric: string,
    assignment_description: string,
  ): Promise<GradingResult>;

  /**
   * Check if provider is healthy and can be used
   * @returns true if provider is ready
   */
  isHealthy(): Promise<boolean>;

  /**
   * Get provider name
   * @returns Provider identifier (e.g., 'openai', 'anthropic', 'bedrock')
   */
  getProviderName(): string;

  /**
   * Get usage statistics (for billing/monitoring)
   * @returns Usage statistics
   */
  getUsageStats(): {
    requests_total: number;
    requests_succeeded: number;
    requests_failed: number;
    tokens_used: number;
  };
}
