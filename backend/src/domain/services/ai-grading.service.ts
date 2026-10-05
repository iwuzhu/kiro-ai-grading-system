import { Injectable, Logger, Inject } from '@nestjs/common';
import { AIProvider } from './ai-provider.interface';
import { GradeRepository } from '../repositories/grade.repository';
import { SubmissionRepository } from '../repositories/submission.repository';
import { AssignmentRepository } from '../repositories/assignment.repository';
import { Grade } from '../entities/grade.entity';

export interface AIGradingRequest {
  tenantId: string;
  submissionId: string;
  assignmentId: string;
}

export interface AIGradingResult {
  grade: Grade;
  provider: string;
  tokensUsed?: number;
  processingTimeMs: number;
}

@Injectable()
export class AIGradingService {
  private readonly logger = new Logger(AIGradingService.name);

  constructor(
    @Inject('AIProvider') private aiProvider: AIProvider,
    private gradeRepository: GradeRepository,
    private submissionRepository: SubmissionRepository,
    private assignmentRepository: AssignmentRepository,
  ) {}

  /**
   * Grade a submission using AI
   *
   * @param request - Grading request with submission and assignment IDs
   * @returns Grade object with AI-generated score and feedback
   */
  async gradeSubmission(request: AIGradingRequest): Promise<AIGradingResult> {
    const startTime = Date.now();

    try {
      this.logger.debug(
        `Starting AI grading for submission ${request.submissionId}`,
      );

      // Step 1: Fetch submission
      const submission = await this.submissionRepository.findById(
        request.tenantId,
        request.submissionId,
      );

      if (!submission) {
        throw new Error(
          `Submission not found: ${request.submissionId}`,
        );
      }

      // Step 2: Fetch assignment with rubric
      const assignment = await this.assignmentRepository.findById(
        request.assignmentId,
        request.tenantId,
      );

      if (!assignment) {
        throw new Error(
          `Assignment not found: ${request.assignmentId}`,
        );
      }

      // Step 3: Check if grade already exists
      const existingGrade = await this.gradeRepository.findBySubmission(
        request.tenantId,
        request.submissionId,
      );

      if (existingGrade) {
        this.logger.warn(
          `Grade already exists for submission ${request.submissionId}, updating...`,
        );
      }

      // Step 4: Extract rubric and assignment description
      const rubricText = this.formatRubric(assignment);
      const assignmentDescription =
        assignment.description || 'No description provided';

      // Step 5: Get submission content
      const submissionContent = this.formatSubmissionContent(submission);

      // Step 6: Call AI provider
      this.logger.debug('Calling AI provider...');
      const aiResponse = await this.aiProvider.gradeSubmission(
        submissionContent,
        rubricText,
        assignmentDescription,
      );

      // Step 7: Create or update grade
      let grade: Grade;
      if (existingGrade) {
        // Update existing grade
        existingGrade.ai_score = aiResponse.score;
        existingGrade.confidence = aiResponse.confidence;
        existingGrade.final_score = aiResponse.score; // Initial final score
        existingGrade.feedback = aiResponse.feedback;
        existingGrade.strengths = aiResponse.strengths;
        existingGrade.improvements = aiResponse.improvements;
        existingGrade.status = 'AI_GRADED';
        existingGrade.grade_details = {
          aiProvider: this.aiProvider.getProviderName(),
          reasoning: aiResponse.reasoning,
          rubricAlignment: aiResponse.rubricAlignment,
          aiGradedAt: new Date().toISOString(),
        };
        existingGrade.updated_at = new Date();

        grade = await this.gradeRepository.save(existingGrade);
      } else {
        // Create new grade
        grade = await this.gradeRepository.createGrade({
          tenant_id: request.tenantId,
          submission_id: request.submissionId,
          assignment_id: request.assignmentId,
          ai_score: aiResponse.score,
          confidence: aiResponse.confidence,
          final_score: aiResponse.score,
          feedback: aiResponse.feedback,
          strengths: aiResponse.strengths,
          improvements: aiResponse.improvements,
          status: 'AI_GRADED',
          graded_by_user_id: null, // AI-generated, not by user
          grade_type: 'overall_submission',
          grade_details: {
            aiProvider: this.aiProvider.getProviderName(),
            reasoning: aiResponse.reasoning,
            rubricAlignment: aiResponse.rubricAlignment,
            aiGradedAt: new Date().toISOString(),
          },
        });
      }

      const processingTimeMs = Date.now() - startTime;

      this.logger.log(
        `AI grading completed for submission ${request.submissionId}: score=${grade.ai_score}, confidence=${grade.confidence}, time=${processingTimeMs}ms`,
      );

      return {
        grade,
        provider: this.aiProvider.getProviderName(),
        processingTimeMs,
      };
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;

      this.logger.error(
        `AI grading failed for submission ${request.submissionId}: ${error.message}`,
      );

      throw error;
    }
  }

  /**
   * Format rubric for AI prompt
   */
  private formatRubric(assignment: any): string {
    if (!assignment.content || !Array.isArray(assignment.content)) {
      return 'No rubric provided';
    }

    // If assignment.content is an array of question objects
    if (assignment.content.length > 0 && assignment.content[0].type) {
      // Structured content
      return assignment.content
        .map((item: any, idx: number) => {
          const criteria = item.rubric || item.description || '';
          const points = item.pointValue || 0;
          return `${idx + 1}. ${item.title || item.text} (${points} points)\n   Criteria: ${criteria}`;
        })
        .join('\n\n');
    }

    // Plain text content
    if (typeof assignment.content === 'string') {
      return assignment.content;
    }

    // JSON-serialized content
    return JSON.stringify(assignment.content, null, 2);
  }

  /**
   * Format submission content for AI prompt
   */
  private formatSubmissionContent(submission: any): string {
    if (!submission.content) {
      return '[No content submitted]';
    }

    if (typeof submission.content === 'string') {
      return submission.content;
    }

    // If content is JSON
    if (typeof submission.content === 'object') {
      return JSON.stringify(submission.content, null, 2);
    }

    return String(submission.content);
  }

  /**
   * Check if AI provider is ready
   */
  isConfigured(): boolean {
    return this.aiProvider.isConfigured();
  }

  /**
   * Get provider info
   */
  getProviderInfo(): { name: string; configured: boolean } {
    return {
      name: this.aiProvider.getProviderName(),
      configured: this.aiProvider.isConfigured(),
    };
  }
}
