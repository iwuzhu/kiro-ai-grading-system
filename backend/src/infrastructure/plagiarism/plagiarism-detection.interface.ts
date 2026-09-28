/**
 * Plagiarism Detection Method Interface
 *
 * Unified interface for all plagiarism detection strategies.
 * Supports pluggable implementations: Turnitin API, Local Corpus, AI Detection.
 *
 * Requirement 9: Plagiarism Detection
 */
export interface PlagiarismDetectionMethod {
  /**
   * Detect plagiarism in submission content
   * @param submissionContent - The text content to scan
   * @param submissionId - ID of the submission being scanned
   * @param assignmentId - ID of the assignment
   * @param tenantId - Tenant context
   * @returns Detection result with scores and source matches
   */
  detect(
    submissionContent: string,
    submissionId: string,
    assignmentId: string,
    tenantId: string,
  ): Promise<PlagiarismDetectionResult>;

  /**
   * Get the name of this detection method
   */
  getName(): string;

  /**
   * Check if this method is available/ready to use
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Result from plagiarism detection
 */
export interface PlagiarismDetectionResult {
  /**
   * Plagiarism score (0-100)
   * Percentage of submission that is plagiarized or unoriginal
   */
  plagiarismScore: number;

  /**
   * AI generation score (0-100)
   * Percentage of submission that appears AI-generated
   * Can be undefined if method doesn't detect AI content
   */
  aiGenerationScore?: number;

  /**
   * Source matches found
   * Array of sources matching the submission
   */
  sourceMatches: PlagiarismSourceMatch[];

  /**
   * External scan ID (for API-based methods)
   * Used to reference external scan for retrieval later
   */
  externalScanId?: string;

  /**
   * Error message if detection failed
   */
  error?: string;

  /**
   * Whether the result is complete/final
   * Some methods may return partial results (e.g., Turnitin polling)
   */
  isComplete: boolean;
}

/**
 * A source match found during plagiarism detection
 */
export interface PlagiarismSourceMatch {
  /**
   * Unique identifier for this source
   */
  id: string;

  /**
   * Title or name of the matched source
   */
  title: string;

  /**
   * URL to the matched source (if available)
   */
  url?: string;

  /**
   * Percentage of submission that matches this source
   */
  matchPercentage: number;

  /**
   * Excerpts showing the matches
   */
  excerpts: PlagiarismExcerpt[];

  /**
   * Source type (online, student_submission, database, etc.)
   */
  sourceType?: string;
}

/**
 * An excerpt showing a specific match
 */
export interface PlagiarismExcerpt {
  /**
   * Text from the submission that matched
   */
  submissionText: string;

  /**
   * Corresponding text from the source
   */
  sourceText: string;

  /**
   * Length of the matched text
   */
  matchLength: number;
}
