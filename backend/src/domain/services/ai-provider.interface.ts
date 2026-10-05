/**
 * AI Provider Interface
 * 
 * Defines the contract for AI providers (OpenAI, Claude, Bedrock, etc.)
 * Allows pluggable implementations for grading submissions
 */

export interface SubmissionFile {
  fileName: string;
  fileType: string;
  buffer: Buffer;
}

export interface AIGradingResponse {
  score: number; // 0-100
  confidence: number; // 0-100
  feedback: string;
  strengths: string[];
  improvements: string[];
  reasoning: string; // Why this score?
  rubricAlignment?: Record<string, number>; // Optional: per-criterion scores
}

export interface AIProvider {
  /**
   * Grade a submission using AI
   * 
   * @param submissionContent - The submission content to grade (text answers)
   * @param rubricText - The rubric criteria as text or JSON
   * @param assignmentDescription - Assignment instructions
   * @param files - Optional files to send to AI provider
   * @returns AIGradingResponse with score, feedback, etc.
   */
  gradeSubmission(
    submissionContent: string,
    rubricText: string,
    assignmentDescription: string,
    files?: SubmissionFile[],
  ): Promise<AIGradingResponse>;

  /**
   * Get provider name for logging and tracking
   */
  getProviderName(): string;

  /**
   * Verify provider is configured and ready
   */
  isConfigured(): boolean;
}
