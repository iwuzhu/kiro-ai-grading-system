import { Injectable, Logger, Inject } from '@nestjs/common';
import { AIProvider, SubmissionFile } from './ai-provider.interface';
import { GradeRepository } from '../repositories/grade.repository';
import { SubmissionRepository } from '../repositories/submission.repository';
import { AssignmentRepository } from '../repositories/assignment.repository';
import { Grade } from '../entities/grade.entity';
import { S3Service } from '../../infrastructure/storage/s3.service';

export interface AIGradingRequest {
  tenantId: string;
  submissionId: string;
  assignmentId: string;
  submissionContent?: string;   // NEW: Optional content from frontend
  rubricText?: string;           // NEW: Optional rubric from frontend
  assignmentDescription?: string; // NEW: Optional assignment description from frontend
  files?: SubmissionFile[];       // NEW: Optional files to send to OpenAI
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
    private s3Service: S3Service,
  ) {}

  /**
   * Grade a submission using AI
   *
   * @param request - Grading request with submission and assignment IDs
   * @returns Grade object with AI-generated score and feedback
   * 
   * Optimization: If submission and rubric are already cached in the
   * Submission Content component, backend only calls AI provider without
   * additional fetches. Otherwise, fetches from database.
   */
  async gradeSubmission(request: AIGradingRequest): Promise<AIGradingResult> {
    const startTime = Date.now();

    try {
      this.logger.debug(
        `Starting AI grading for submission ${request.submissionId}`,
      );

      // Step 1: Use provided content or fetch submission
      let submission: any;
      let rubricText: string;
      let assignmentDescription: string;

      // If content provided from frontend, use it directly
      if (request.submissionContent && request.rubricText && request.assignmentDescription) {
        this.logger.debug('Using content provided from frontend');
        submission = { 
          content: request.submissionContent,
          submitted_at: new Date()
        };
        rubricText = request.rubricText;
        assignmentDescription = request.assignmentDescription;
      } else {
        // Otherwise fetch from database
        this.logger.debug('Fetching content from database');
        
        submission = await this.submissionRepository.findById(
          request.tenantId,
          request.submissionId,
        );

        if (!submission) {
          throw new Error(
            `Submission not found: ${request.submissionId}`,
          );
        }

        const assignment = await this.assignmentRepository.findById(
          request.tenantId,
          request.assignmentId,
        );

        if (!assignment) {
          throw new Error(
            `Assignment not found: ${request.assignmentId}`,
          );
        }

        rubricText = this.formatRubric(assignment);
        assignmentDescription = assignment.description || 'No description provided';
      }

      // Step 2: Check if grade already exists
      const existingGrade = await this.gradeRepository.findBySubmission(
        request.tenantId,
        request.submissionId,
      );

      if (existingGrade) {
        this.logger.warn(
          `Grade already exists for submission ${request.submissionId}, updating...`,
        );
      }

      // Step 3: Get submission content and files
      const submissionContent = await this.formatSubmissionContent(submission);
      const submissionFiles = await this.prepareSubmissionFiles(submission);

      // Step 4: Call AI provider with content and files
      this.logger.debug(`Calling AI provider with ${submissionFiles.length} file(s)...`);
      const aiResponse = await this.aiProvider.gradeSubmission(
        submissionContent,
        rubricText,
        assignmentDescription,
        submissionFiles, // Pass files to OpenAI
      );

      // Step 5: Return AI response WITHOUT saving to database
      // NOTE: Only the "Save Grade" button endpoint should persist to database
      // This endpoint only generates the AI grade for frontend display
      
      const gradeData = {
        id: existingGrade?.id || 'temp-' + request.submissionId, // Temp ID until saved
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
        created_at: existingGrade?.created_at || new Date(),
        updated_at: new Date(),
      };

      // ✅ Do NOT save to database here
      // This allows frontend to:
      // 1. Display the AI grade in the form
      // 2. Let instructor review it
      // 3. Instructor clicks "Save Grade" button to actually persist

      const processingTimeMs = Date.now() - startTime;

      this.logger.log(
        `AI grading completed for submission ${request.submissionId}: score=${gradeData.ai_score}, confidence=${gradeData.confidence}, time=${processingTimeMs}ms`,
      );

      return {
        grade: gradeData as any,
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
   * Extracts text answers from content.answers if present
   * Files are sent separately to OpenAI, not included in prompt
   */
  private async formatSubmissionContent(submission: any): Promise<string> {
    // Extract text answers from content.answers if present
    if (submission.content && typeof submission.content === 'object') {
      const answers = submission.content.answers || []
      
      if (Array.isArray(answers) && answers.length > 0) {
        const answersText = answers
          .map((answer: any, idx: number) => {
            const questionId = answer.questionId || `Q${idx + 1}`
            const answerText = answer.answer || '[No answer provided]'
            const type = answer.type || 'SHORT_ANSWER'
            return `Question ${questionId} (${type}):\n${answerText}`
          })
          .join('\n\n---\n\n')
        
        return `STUDENT ANSWERS:\n${answersText}`
      }
    }

    return '[No text answers submitted]'
  }

  /**
   * Prepare submission files for OpenAI
   * Downloads files from S3 and returns as buffers with metadata
   */
  private async prepareSubmissionFiles(submission: any): Promise<SubmissionFile[]> {
    const files: SubmissionFile[] = []

    if (!submission.file_path) {
      return files
    }

    try {
      this.logger.debug(`[prepareSubmissionFiles] Preparing file: ${submission.file_path}`)
      
      // Download file from S3
      const fileBuffer = await this.s3Service.downloadFile(submission.file_path)
      
      const fileName = submission.file_path.split('/').pop() || 'submission'
      const fileType = submission.file_type || 'application/octet-stream'
      
      files.push({
        fileName,
        fileType,
        buffer: fileBuffer,
      })

      this.logger.debug(`[prepareSubmissionFiles] File prepared: ${fileName} (${fileType}, ${fileBuffer.length} bytes)`)
    } catch (error) {
      this.logger.warn(`[prepareSubmissionFiles] Could not prepare file: ${error instanceof Error ? error.message : String(error)}`)
      // Continue without the file - don't fail the entire grading
    }

    return files
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
