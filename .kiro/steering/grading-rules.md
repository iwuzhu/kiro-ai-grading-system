# Grading Rules & Guarantees

## Core Grading Guarantees

All grading in the system must satisfy these non-negotiable rules:

### 1. Every Grade Must Have Explanation

`	ypescript
interface Grade {
  id: UUID;
  submissionId: UUID;
  score: number;              // 0-100 (or configured scale)
  feedback: string;           // Required: minimum 20 characters
  rubricAlignment: RubricCriteria[]; // Shows how score maps to rubric
  strengths: string[];        // At least 1 strength highlighted
  improvements: string[];     // At least 1 area for improvement
  codeComments?: CodeComment[]; // For code submissions
}

// Rule enforcement
if (!grade.feedback || grade.feedback.trim().length < 20) {
  throw new ValidationException('Feedback must be at least 20 characters');
}

if (grade.strengths.length === 0) {
  throw new ValidationException('Grade must highlight at least one strength');
}

if (grade.improvements.length === 0) {
  throw new ValidationException('Grade must suggest at least one area for improvement');
}
`

### 2. Every Grade Must Have Confidence Score

`	ypescript
interface Grade {
  confidence: number;         // 0-100%, required for AI grades
  confidenceReason: string;   // Why this confidence level
}

// AI grades must include confidence
if (grade.source === 'ai' && !grade.confidence) {
  throw new ValidationException('AI grades must include confidence score');
}

// Confidence interpretation
const confidenceInterpretation = {
  90-100: 'Very high confidence - rubric clearly maps to submission',
  70-89:  'High confidence - submission clearly aligns with criteria',
  50-69:  'Medium confidence - some ambiguity in rubric application',
  30-49:  'Low confidence - significant disagreement possible',
  0-29:   'Very low confidence - recommend instructor override',
};
`

### 3. Support Human Override

`	ypescript
@Injectable()
export class GradeOverrideService {
  async overrideGrade(
    gradeId: string,
    override: GradeOverride,
    tenantId: string,
  ): Promise<Grade> {
    // Fetch original grade
    const originalGrade = await this.gradeRepository.findById(gradeId, tenantId);
    if (!originalGrade) throw new NotFoundException('Grade', gradeId);

    // Validate override data
    if (override.newScore < 0 || override.newScore > 100) {
      throw new ValidationException('Override score must be 0-100');
    }

    if (!override.rationale || override.rationale.trim().length < 20) {
      throw new ValidationException('Override rationale required (min 20 chars)');
    }

    // Check permissions (instructor or admin only)
    const user = await this.userService.getCurrentUser();
    if (![Role.INSTRUCTOR, Role.ADMIN].includes(user.role)) {
      throw new ForbiddenException('Only instructors and admins can override grades');
    }

    // Check institutional policy for approvals
    const institution = await this.institutionRepository.findById(tenantId);
    if (institution.requiresGradeApproval && user.role === Role.INSTRUCTOR) {
      // Route to admin for approval
      return await this.routeForApproval(gradeId, override, tenantId);
    }

    // Create override record
    const updatedGrade = await this.gradeRepository.update(gradeId, {
      score: override.newScore,
      originalAIScore: originalGrade.score,
      originalAIConfidence: originalGrade.confidence,
      overriddenBy: user.id,
      overriddenAt: new Date(),
      overrideRationale: override.rationale,
      overrideApprovalStatus: institution.requiresGradeApproval ? 'pending' : 'approved',
    });

    // Log the override for audit trail
    await this.auditLogger.logEvent({
      tenantId,
      eventType: 'grade_override',
      resourceType: 'grade',
      resourceId: gradeId,
      actionDetails: {
        originalScore: originalGrade.score,
        overriddenScore: override.newScore,
        originalConfidence: originalGrade.confidence,
        rationale: override.rationale,
        requiresApproval: institution.requiresGradeApproval,
      },
    });

    return updatedGrade;
  }

  private async routeForApproval(
    gradeId: string,
    override: GradeOverride,
    tenantId: string,
  ): Promise<void> {
    // Create approval record
    await this.approvalRepository.create({
      gradeId,
      tenantId,
      overrideDetails: override,
      status: 'pending',
      createdAt: new Date(),
    });

    // Notify admin
    const admins = await this.userService.findAdmins(tenantId);
    for (const admin of admins) {
      await this.notificationService.notify({
        tenantId,
        recipientUserId: admin.id,
        message: 'Grade override awaiting approval',
        actionUrl: \/approvals/grades/\\,
      });
    }
  }
}
`

### 4. Store Complete Grading Trace

`	ypescript
interface GradingTrace {
  gradeId: UUID;
  submissionId: UUID;
  tenantId: UUID;
  
  // AI grading
  aiProvider: string;                  // 'openai', 'claude', 'bedrock'
  aiModel: string;                     // 'gpt-4o', 'claude-opus', etc.
  aiPrompt: string;                    // Full prompt sent to AI
  aiResponse: string;                  // Full response from AI
  aiScore: number;                     // Original AI score
  aiConfidence: number;                // Original AI confidence
  
  // Grading metadata
  rubricId: UUID;
  rubricVersion: number;               // Track rubric changes
  assignmentRequirements: string;      // Assignment description at time of grading
  
  // Human input
  instructorOverride?: {
    originalScore: number;
    overriddenScore: number;
    rationale: string;
    overriddenBy: UUID;
    overriddenAt: Date;
    approvalStatus: 'pending' | 'approved' | 'rejected';
  };
  
  // Timeline
  submittedAt: Date;
  gradedAt: Date;
  gradingDurationMs: number;           // Time taken for AI grading
  
  // Performance metrics
  tokenCount?: number;                 // For cost tracking
  apiLatency?: number;                 // AI provider response time
}

// Store trace for every grade
async storeGradingTrace(submission, grade, aiDetails, tenantId): Promise<void> {
  const trace: GradingTrace = {
    gradeId: grade.id,
    submissionId: submission.id,
    tenantId,
    aiProvider: aiDetails.provider,
    aiModel: aiDetails.model,
    aiPrompt: aiDetails.prompt,
    aiResponse: aiDetails.response,
    aiScore: aiDetails.score,
    aiConfidence: aiDetails.confidence,
    rubricId: submission.assignment.rubricId,
    rubricVersion: submission.assignment.rubricVersion,
    assignmentRequirements: submission.assignment.description,
    submittedAt: submission.submittedAt,
    gradedAt: new Date(),
    gradingDurationMs: aiDetails.duration,
    tokenCount: aiDetails.tokenCount,
    apiLatency: aiDetails.latency,
  };

  await this.tracingRepository.create(trace);
  
  // Preserve immutably in storage (e.g., S3 with versioning disabled)
  await this.s3.putObject({
    Bucket: 'grading-traces',
    Key: \\/\/trace.json\,
    Body: JSON.stringify(trace, null, 2),
    ServerSideEncryption: 'AES256',
  });
}
`

---

## Grading Workflow

### Single Submission Grading

`
1. Student submits work
   ?
2. System validates file (type, size, format)
   ?
3. AI grading triggered (if enabled)
   +- AI analyzes submission against rubric
   +- AI generates score + confidence
   +- AI generates feedback with explanations
   ?
4. Grade stored with trace
   +- Original AI score preserved
   +- Full prompt/response captured
   +- Audit event logged
   ?
5. Student notified (5-second SLA)
   +- Grade visible in dashboard
   +- Feedback displayed
   +- Confidence score shown
   ?
6. Instructor can:
   +- Review AI grade
   +- Override with rationale (if not approved)
   +- Re-grade manually
`

### Incremental Submission Grading

`
1. Student submits increment (before deadline)
   ?
2. Same validation + AI grading (if enabled)
   +- Grade each submission independently
   +- Link to previous submissions
   ?
3. Student sees:
   +- Current grade + confidence
   +- Comparative feedback (vs previous)
   +- Progress indicators
   ?
4. Instructor can:
   +- Provide progressive feedback
   +- Override at any point
   +- Select composite grade method:
      +- Final submission only
      +- Average of all submissions (default)
`

### Grade Visibility Timeline

`	ypescript
interface GradeVisibility {
  // Grades remain hidden until instructor releases them
  gradedAt: Date;
  releaseStatus: 'hidden' | 'released'; // Default: hidden
  releasedAt?: Date;
  releasedBy?: UUID;

  // Instructor can batch release grades
  async releaseGrades(
    assignmentId: string,
    releaseAll: boolean = false,
    tenantId: string,
  ): Promise<void> {
    const grades = releaseAll
      ? await this.gradeRepository.findByAssignment(assignmentId, tenantId)
      : await this.gradeRepository.findByAssignmentAndStatus(
          assignmentId,
          'approved',
          tenantId,
        );

    await Promise.all(
      grades.map(grade =>
        this.gradeRepository.update(grade.id, {
          releaseStatus: 'released',
          releasedAt: new Date(),
          releasedBy: getCurrentUserId(),
        })
      )
    );

    // Bulk notify students (5-second SLA)
    const studentIds = [...new Set(grades.map(g => g.submission.studentId))];
    await this.notificationService.notifyMultiple({
      tenantId,
      recipientUserIds: studentIds,
      message: 'Grades have been released',
      actionUrl: \/assignments/\/grades\,
    });
  }
}
`

---

## Grading State Machine

`
SUBMISSION_RECEIVED
    ?
VALIDATION_IN_PROGRESS
    +- Valid ? AI_GRADING_PENDING (if enabled)
    +- Invalid ? VALIDATION_FAILED (error to student)
    ?
AI_GRADING_IN_PROGRESS (60-second timeout)
    +- Success ? AI_GRADE_GENERATED
    +- Failure ? AI_GRADING_FAILED (alert instructor for manual)
    ?
AI_GRADE_GENERATED
    +- Instructor review option
    +- May override (if not requiring approval)
    +- Release decision pending
    ?
GRADE_RELEASED (visible to student)
    +- Student views grade + feedback + confidence
    +- May request clarification

OVERRIDE_PENDING_APPROVAL (if institutional policy requires)
    +- Admin review
    +- Approve ? OVERRIDE_APPROVED
    +- Reject ? OVERRIDE_REJECTED (back to original grade)
`

---

## Grading SLAs

- **Grading completion**: 60 seconds for 95% of submissions
- **Notification delivery**: 5 seconds for grade release
- **Plagiarism scan**: 120 seconds
- **Plagiarism flagging notification**: 10 seconds
- **Override approval**: 24 hours (or marked urgent for faster review)

