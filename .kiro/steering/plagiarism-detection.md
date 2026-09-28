# Plagiarism Detection & AI Content Detection Standards

## Plagiarism Detection Architecture

The system integrates with plagiarism detection services and maintains an institutional submission corpus.

### Supported Plagiarism Services

1. **Turnitin API** (Primary)
   - Industry-standard plagiarism detection
   - Large external database (40+ billion documents)
   - Institutional plagiarism repository

2. **Copyscape / Similar Services**
   - Web-based similarity checking
   - Backup for Turnitin

3. **Local Similarity Detection**
   - In-house string matching against institutional database
   - Fallback when external services unavailable

---

## Plagiarism Scoring

### Score Calculation

`	ypescript
interface PlagiarismScore {
  overallScore: number;           // 0-100%
  aiGenerationScore: number;      // 0-100%
  sourceMatches: SourceMatch[];   // Matched sources
  suspiciousRegions: TextRegion[]; // High-similarity sections
  timestamp: Date;
}

interface SourceMatch {
  sourceUrl?: string;
  sourceTitle?: string;
  matchPercentage: number;        // 0-100%
  matchedContent: string;         // Excerpt from submission
  sourceContent: string;          // Excerpt from source
  matchType: 'exact' | 'paraphrased' | 'citation_missing';
}

// Plagiarism score is weighted:
// - Exact matches: 100% similarity weight
// - Paraphrased content: 60% similarity weight
// - Missing citations: 80% similarity weight
`

### Example Score Calculation

`	ypescript
async calculatePlagiarismScore(submission: Submission): Promise<PlagiarismScore> {
  // Submit to Turnitin and get matches
  const turnitinMatches = await this.turnitinService.checkSimilarity(
    submission.content,
    submission.tenantId,
  );

  // Check institutional database
  const institutionalMatches = await this.localRepository.findSimilarSubmissions(
    submission.content,
    submission.tenantId,
  );

  // Calculate weighted score
  const allMatches = [...turnitinMatches, ...institutionalMatches];
  const overallScore = this.calculateWeightedScore(allMatches);

  // Separate AI-generated content detection
  const aiScore = await this.detectAIGeneratedContent(submission.content);

  return {
    overallScore,           // Plagiarism score 0-100%
    aiGenerationScore,      // AI content likelihood 0-100%
    sourceMatches: allMatches,
    suspiciousRegions: this.identifySuspiciousRegions(allMatches),
    timestamp: new Date(),
  };
}

private calculateWeightedScore(matches: SourceMatch[]): number {
  if (matches.length === 0) return 0;

  let totalWeight = 0;
  let totalScore = 0;

  matches.forEach(match => {
    const weight = match.matchType === 'exact' ? 1.0 :
                   match.matchType === 'paraphrased' ? 0.6 :
                   0.8; // missing citation

    totalScore += match.matchPercentage * weight;
    totalWeight += weight;
  });

  return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
}
`

---

## AI Content Detection

### AI Generation Detection Methods

`	ypescript
interface AIDetectionResult {
  aiGenerationScore: number;       // 0-100% likelihood
  detectionMethod: string;         // 'openai' | 'claude' | 'local'
  suspiciousPatterns: string[];    // Indicators of AI generation
  confidence: number;              // 0-100%
}

// Multiple detection methods
async detectAIGeneratedContent(content: string): Promise<AIDetectionResult> {
  // Method 1: OpenAI Moderation API
  const openaiResult = await this.openaiModerationService.checkContent(content);

  // Method 2: Statistical analysis (entropy, sentence structure)
  const statisticalResult = this.analyzeStatisticalPatterns(content);

  // Method 3: Pattern matching (common AI phrases, formatting)
  const patternResult = this.matchKnownAIPatterns(content);

  // Combine results
  const aiScore = (
    openaiResult.score * 0.5 +      // 50% weight
    statisticalResult.score * 0.3 + // 30% weight
    patternResult.score * 0.2       // 20% weight
  );

  return {
    aiGenerationScore: Math.round(aiScore * 100),
    detectionMethod: 'hybrid',
    suspiciousPatterns: [
      ...openaiResult.patterns,
      ...statisticalResult.patterns,
      ...patternResult.patterns,
    ],
    confidence: Math.round(
      (openaiResult.confidence + statisticalResult.confidence + patternResult.confidence) / 3 * 100
    ),
  };
}

// Statistical patterns indicating AI generation
private analyzeStatisticalPatterns(content: string): { score: number, patterns: string[] } {
  const patterns: string[] = [];
  let score = 0;

  // Entropy analysis: AI-generated text often has unusual token distribution
  const entropy = this.calculateEntropy(content);
  if (entropy > 5.5) {
    patterns.push('Unusual entropy pattern typical of AI generation');
    score += 0.2;
  }

  // Sentence length variance: Human text has more variation
  const variance = this.calculateSentenceLengthVariance(content);
  if (variance < 20) {
    patterns.push('Low sentence length variance (AI characteristic)');
    score += 0.15;
  }

  // Common filler phrases: 'In conclusion', 'Furthermore', 'It is important to note'
  const fillerCount = this.countFillerPhrases(content);
  if (fillerCount > 10) {
    patterns.push('Excessive use of filler phrases');
    score += 0.15;
  }

  // Lack of contractions: Human text uses contractions more
  const contractionRatio = this.calculateContractionRatio(content);
  if (contractionRatio < 0.05) {
    patterns.push('Lack of contractions (AI characteristic)');
    score += 0.15;
  }

  return { score: Math.min(score, 1), patterns };
}
`

---

## Plagiarism Workflow

### Detection & Flagging

`	ypescript
@Injectable()
export class PlagiarismDetectionService {
  constructor(
    private turnitinService: TurnitinService,
    private aiDetectionService: AIDetectionService,
    private notificationService: NotificationService,
    private auditLogger: AuditLogger,
  ) {}

  async scanSubmission(
    submission: Submission,
    assignment: Assignment,
    tenantId: string,
  ): Promise<void> {
    try {
      // Get institutional configuration
      const config = await this.institutionConfigRepository.findByTenant(tenantId);
      const plagiarismThreshold = config.plagiarismThreshold || 20; // Default 20%

      // Run plagiarism detection (120-second SLA)
      const startTime = Date.now();
      const plagiarismResult = await this.turnitinService.checkSimilarity(
        submission.content,
        tenantId,
      );
      const detectionTime = Date.now() - startTime;

      // Run AI detection in parallel
      const aiResult = await this.aiDetectionService.detectAIContent(submission.content);

      // Store results
      await this.plagiarismResultRepository.create({
        submissionId: submission.id,
        tenantId,
        overallScore: plagiarismResult.overallScore,
        aiGenerationScore: aiResult.aiGenerationScore,
        sourceMatches: plagiarismResult.sourceMatches,
        suspiciousRegions: plagiarismResult.suspiciousRegions,
        detectionTime,
        scannedAt: new Date(),
      });

      // Check thresholds and flag if necessary
      if (plagiarismResult.overallScore > plagiarismThreshold) {
        await this.flagPlagiarism(
          submission,
          plagiarismResult,
          aiResult,
          tenantId,
          assignment.createdByUserId,
        );
      }

      // Log the scanning event
      await this.auditLogger.logEvent({
        tenantId,
        eventType: 'plagiarism_scanned',
        resourceType: 'submission',
        resourceId: submission.id,
        actionDetails: {
          plagiarismScore: plagiarismResult.overallScore,
          aiScore: aiResult.aiGenerationScore,
          flagged: plagiarismResult.overallScore > plagiarismThreshold,
          detectionTime,
        },
      });

    } catch (error) {
      // Log error and alert instructor
      await this.auditLogger.logEvent({
        tenantId,
        eventType: 'plagiarism_scan_error',
        actionDetails: {
          submissionId: submission.id,
          error: error.message,
        },
      });

      await this.notificationService.alertInstructor({
        tenantId,
        instructorId: assignment.createdByUserId,
        message: \Plagiarism scan failed for submission \: \\,
        severity: 'medium',
      });
    }
  }

  private async flagPlagiarism(
    submission: Submission,
    plagiarismResult: PlagiarismResult,
    aiResult: AIDetectionResult,
    tenantId: string,
    instructorId: string,
  ): Promise<void> {
    // Create plagiarism flag
    await this.plagiarismFlagRepository.create({
      submissionId: submission.id,
      tenantId,
      plagiarismScore: plagiarismResult.overallScore,
      aiScore: aiResult.aiGenerationScore,
      status: 'pending_investigation', // pending_investigation | dismissed | confirmed
      evidencePreserved: true,
      flaggedAt: new Date(),
    });

    // Notify instructor (10-second SLA)
    await this.notificationService.notify({
      tenantId,
      recipientUserId: instructorId,
      type: 'plagiarism_flag',
      severity: plagiarismResult.overallScore > 80 ? 'high' : 'medium',
      message: \Submission \ flagged for plagiarism (\%)\,
      actionUrl: \/plagiarism/investigations/\\,
      delayMs: 0, // Immediate delivery
    });
  }
}
`

### Investigation & Action

`	ypescript
interface PlagiarismInvestigation {
  flagId: UUID;
  submissionId: UUID;
  plagiarismScore: number;
  aiScore: number;
  sourceMatches: SourceMatch[];
  instructorNotes: string;
  action: 'warning' | 'investigation' | 'dismissed' | 'escalation';
  actionReason: string;
  studentNotified: boolean;
  takenAt: Date;
  takenByUserId: UUID;
}

// Instructor can take action
async investigatePlagiarism(
  flagId: string,
  investigation: PlagiarismInvestigation,
  tenantId: string,
): Promise<void> {
  const flag = await this.plagiarismFlagRepository.findById(flagId, tenantId);

  // Update flag status
  await this.plagiarismFlagRepository.update(flagId, {
    status: 'confirmed',
    instructorNotes: investigation.instructorNotes,
    actionTaken: investigation.action,
    actionReason: investigation.actionReason,
    updatedAt: new Date(),
  });

  // Notify student if appropriate
  if (investigation.action !== 'dismissed') {
    const studentNotification = {
      tenantId,
      studentId: flag.submission.studentId,
      message: \Your submission has been flagged for academic integrity concerns. Your instructor will follow up.\,
      type: 'plagiarism_warning',
    };

    await this.notificationService.notify(studentNotification);
  }

  // Log the investigation
  await this.auditLogger.logEvent({
    tenantId,
    eventType: 'plagiarism_investigated',
    resourceType: 'plagiarism_flag',
    resourceId: flagId,
    actionDetails: investigation,
  });
}
`

---

## Institutional Plagiarism Corpus

### Building the Corpus

`	ypescript
async addSubmissionToCorpus(submission: Submission, tenantId: string): Promise<void> {
  // Add accepted/final submissions to the institutional repository
  await this.corpusRepository.create({
    tenantId,
    submissionId: submission.id,
    content: submission.content,
    courseId: submission.assignment.courseId,
    studentId: submission.studentId,
    submittedAt: submission.submittedAt,
    // Indexed for full-text search and similarity
  });
}

// Corpus search during plagiarism detection
async searchCorpus(content: string, tenantId: string): Promise<SimilarityMatch[]> {
  // Use PostgreSQL full-text search or Elasticsearch
  return await this.db.query(\
    SELECT id, content, similarity(content, \) as similarity_score
    FROM plagiarism_corpus
    WHERE tenant_id = \
    AND similarity(content, \) > 0.4
    ORDER BY similarity_score DESC
    LIMIT 10
  \, [content, tenantId]);
}
`

### Privacy & Retention

- Submissions in corpus are associated with student ID (not names/emails)
- Retain for 3 years per institutional policy
- Support corpus cleanup/purge when requested
- Anonymize historical data for research purposes

---

## Configuration & Thresholds

`	ypescript
interface InstitutionPlagiarismConfig {
  tenantId: UUID;
  defaultThreshold: number;              // 0-100%, default 20%
  aiContentThreshold: number;            // 0-100%, default 30%
  enableAIDetection: boolean;            // Default true
  automaticActions: {
    aboveThreshold: 'alert_only' | 'alert_and_reduce_score' | 'auto_review';
    scoreReduction?: number;             // 0-50 points
  };
  enableInstitutionalCorpus: boolean;    // Default true
  corpusRetentionDays: number;           // Default 1095 (3 years)
}
`

