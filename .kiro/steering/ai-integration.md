# AI Integration Standards

## Supported AI Providers

The system supports pluggable AI grading and content detection via three providers:

1. **OpenAI** (Primary)
   - GPT-4o for grading analysis
   - Text-davinci-003 for feedback generation
   - Moderation API for content detection

2. **Claude** (Anthropic)
   - Claude 3 Opus for grading
   - Supports longer context windows for large submissions

3. **Amazon Bedrock**
   - Titan for text analysis
   - Claude integration via Bedrock

---

## AI Provider Configuration

`	ypescript
// config/ai-providers.ts
export interface AIProviderConfig {
  provider: 'openai' | 'claude' | 'bedrock';
  apiKey: string;
  maxRetries: number;
  timeout: number; // milliseconds
  costPerToken?: number; // For billing tracking
}

// Environment-driven configuration
const aiConfig: AIProviderConfig = {
  provider: process.env.AI_PROVIDER || 'openai',
  apiKey: process.env.AI_API_KEY,
  maxRetries: parseInt(process.env.AI_MAX_RETRIES) || 3,
  timeout: parseInt(process.env.AI_TIMEOUT) || 60000,
};
`

---

## Grading AI Pipeline

### Grading Prompt Structure

`	ypescript
interface GradingPrompt {
  rubric: RubricJSON;           // Structured rubric
  submission: SubmissionContent; // Student's work
  assignmentDetails: string;     // Assignment description
  gradingScale: GradingScale;   // Institution's scale (0-100, A-F, etc.)
  feedbackTone: FeedbackTone;   // formal | approachable | encouraging
}

// Example prompt construction
const gradingPrompt = \
You are an expert educator grading a student assignment.

ASSIGNMENT: \

RUBRIC:
\

STUDENT SUBMISSION:
\

REQUIREMENTS:
1. Provide a numerical grade (0-100) based on the rubric
2. Provide a confidence score (0-100) indicating certainty
3. Generate detailed feedback explaining the grade
4. Highlight strengths and areas for improvement
5. For code submissions, provide specific line-by-line comments

RESPONSE FORMAT (JSON):
{
  "grade": 85,
  "confidence": 0.92,
  "feedback": "...",
  "strengths": [...],
  "improvements": [...],
  "codeComments": [
    { "line": 42, "comment": "..." }
  ]
}
\;
`

### Grading Service Implementation

`	ypescript
@Injectable()
export class GradingService {
  constructor(
    private aiProvider: AIProviderService,
    private rubricRepository: RubricRepository,
    private auditLogger: AuditLogger,
  ) {}

  async gradeSubmission(
    submission: Submission,
    assignment: Assignment,
    tenantId: string,
  ): Promise<GradingResult> {
    try {
      // Build grading prompt
      const rubric = await this.rubricRepository.findById(assignment.rubricId, tenantId);
      const prompt = this.buildGradingPrompt(submission, assignment, rubric);

      // Call AI provider with retry logic
      const result = await this.aiProvider.callWithRetry(
        'grading',
        prompt,
        { temperature: 0.2, maxTokens: 1000 },
      );

      // Validate and parse response
      const gradingResult = this.parseGradingResponse(result);
      
      // Store grading trace for audit
      await this.auditLogger.logGradingEvent({
        tenantId,
        submissionId: submission.id,
        assignmentId: assignment.id,
        aiProvider: this.aiProvider.getProviderName(),
        prompt: prompt,
        response: result,
        parsedGrade: gradingResult.grade,
        confidence: gradingResult.confidence,
        timestamp: new Date(),
      });

      return gradingResult;
    } catch (error) {
      // Log error and alert instructor
      await this.auditLogger.logGradingError({
        tenantId,
        submissionId: submission.id,
        error: error.message,
        timestamp: new Date(),
      });
      throw new GradingFailureException(error.message);
    }
  }

  private buildGradingPrompt(submission, assignment, rubric): string {
    // Implementation details...
  }

  private parseGradingResponse(response: string): GradingResult {
    // Parse JSON response and validate
    const parsed = JSON.parse(response);
    
    // Validate grade is 0-100
    if (parsed.grade < 0 || parsed.grade > 100) {
      throw new ValidationException('Grade must be 0-100');
    }
    
    // Validate confidence is 0-1 (or 0-100)
    if (parsed.confidence < 0 || parsed.confidence > 100) {
      throw new ValidationException('Confidence must be 0-100');
    }
    
    return {
      grade: Math.round(parsed.grade * 100) / 100, // Round to 2 decimals
      confidence: Math.round(parsed.confidence * 100) / 100,
      feedback: parsed.feedback,
      strengths: parsed.strengths || [],
      improvements: parsed.improvements || [],
      codeComments: parsed.codeComments || [],
    };
  }
}
`

---

## Feedback Generation

### Feedback Tone Customization

`	ypescript
interface FeedbackOptions {
  tone: 'formal' | 'approachable' | 'encouraging';
  detailLevel: 'brief' | 'standard' | 'detailed';
  includeCodeExamples: boolean;
}

// Tone examples
const tonePrompts = {
  formal: 'Use professional academic language.',
  approachable: 'Use conversational, friendly language.',
  encouraging: 'Emphasize growth opportunities and potential.',
};

const detailPrompts = {
  brief: 'Provide 2-3 sentences per feedback item.',
  standard: 'Provide 1-2 paragraphs per feedback item.',
  detailed: 'Provide comprehensive 2-3 paragraph explanations with examples.',
};
`

### Incremental Feedback

For assignments with multiple submissions:

`	ypescript
async generateIncrementalFeedback(
  previousSubmission: Submission,
  currentSubmission: Submission,
  assignment: Assignment,
): Promise<IncrementalFeedback> {
  const previousGrade = previousSubmission.grade?.score || 0;
  const previousFeedback = previousSubmission.grade?.feedback || '';

  const prompt = \
Previous submission grade: \
Previous feedback: \

Current submission: \

Provide feedback acknowledging the previous submission and highlighting:
1. What improved
2. What still needs work
3. Specific suggestions for the next revision
\;

  const result = await this.aiProvider.call('feedback', prompt);
  
  return {
    previousGrade,
    currentGrade: ..., // New grade
    progressIndicators: [...],
    acknowledgment: ...,
    nextSteps: [...],
  };
}
`

---

## Error Handling & Fallback

### Retry Strategy

`	ypescript
async callWithRetry(
  task: string,
  prompt: string,
  options: AICallOptions,
): Promise<string> {
  let lastError: Error;
  
  for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
    try {
      return await this.callAI(task, prompt, options);
    } catch (error) {
      lastError = error;
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt) * 1000;
      await this.sleep(delay);
      
      // Don't retry on validation errors
      if (error instanceof ValidationException) throw error;
    }
  }
  
  throw new AIServiceException(\Failed after \ retries: \\);
}
`

### Fallback to Manual Grading

When AI grading fails:

`	ypescript
async gradeSubmission(submission, assignment, tenantId) {
  try {
    return await this.aiService.grade(submission, assignment);
  } catch (error) {
    // Log error and alert instructor
    await this.notificationService.alertInstructor({
      tenantId,
      instructorId: assignment.createdByUserId,
      message: \AI grading failed for submission \. Please grade manually.\,
      severity: 'high',
    });
    
    // Mark as pending manual grading
    await this.submissionRepository.update(submission.id, {
      status: 'pending_manual_grading',
      aiGradingError: error.message,
    });
    
    throw new GradingFailureException('AI grading failed. Instructor alerted for manual grading.');
  }
}
`

---

## Cost Management

### Token Tracking

`	ypescript
@Injectable()
export class TokenTrackingService {
  async trackApiCall(
    tenantId: string,
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): Promise<void> {
    const cost = this.calculateCost(provider, model, inputTokens, outputTokens);
    
    await this.usageRepository.create({
      tenantId,
      provider,
      model,
      inputTokens,
      outputTokens,
      cost,
      createdAt: new Date(),
    });
  }

  private calculateCost(provider: string, model: string, inputTokens: number, outputTokens: number): number {
    const rates = {
      'openai:gpt-4o': { input: 0.005, output: 0.015 },
      'claude:opus': { input: 0.015, output: 0.075 },
      'bedrock:titan': { input: 0.0005, output: 0.0015 },
    };
    
    const rate = rates[\\:\\];
    return (inputTokens * rate.input + outputTokens * rate.output) / 1000;
  }
}
`

---

## Provider Selection Strategy

Allow institutions to choose their preferred AI provider:

`	ypescript
// Admin can configure per institution
const institutionConfig = {
  tenantId: '...',
  aiProvider: 'openai',           // Default provider
  aiModel: 'gpt-4o',               // Specific model
  feedbackTone: 'approachable',    // Default feedback tone
  costLimit: 1000,                 // Monthly cost limit (optional)
};

// Use provider from config
async gradeForInstitution(submission, assignment, tenantId) {
  const config = await this.institutionConfigRepository.findByTenant(tenantId);
  const provider = this.aiProviderFactory.create(config.aiProvider);
  
  return await provider.grade(submission, assignment);
}
`

