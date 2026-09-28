# Property-Based Testing & Correctness Properties

## Overview

This document defines the correctness properties that the AI Grading System must satisfy, along with property-based testing strategies using PBT frameworks.

---

## Core Correctness Properties

### Property 1: Grading Consistency

**Statement**: For the same submission and rubric, the AI grader produces the same grade (or within ±2 points due to randomness).

`	ypescript
// Property: grade(submission, rubric) ˜ grade(submission, rubric)
// Variance tolerance: ±2 points (due to temperature in AI calls)

describe('Grading Consistency Property', () => {
  test('same submission graded twice produces similar results', async () => {
    const submission = { content: 'Student essay text...', type: 'essay' };
    const rubric = { criteria: [...], pointValue: 100 };

    const grade1 = await gradingService.grade(submission, rubric);
    const grade2 = await gradingService.grade(submission, rubric);

    // Scores within 2 points
    expect(Math.abs(grade1.score - grade2.score)).toBeLessThanOrEqual(2);
    
    // Confidence scores very similar
    expect(Math.abs(grade1.confidence - grade2.confidence)).toBeLessThanOrEqual(5);
    
    // Both grades have feedback
    expect(grade1.feedback.length).toBeGreaterThan(20);
    expect(grade2.feedback.length).toBeGreaterThan(20);
  });
});
`

### Property 2: Rubric Alignment

**Statement**: Every grade score is fully justified by the rubric criteria. No criterion is violated.

`	ypescript
// Property: For every rubric criterion, the feedback explains how the submission meets/fails that criterion
// Mathematically: ? criterion ? rubric.criteria ? feedback explains criterion alignment

describe('Rubric Alignment Property', () => {
  test('feedback addresses all rubric criteria', async () => {
    const rubric = {
      criteria: [
        { id: 'clarity', description: 'Writing is clear and well-organized', points: 20 },
        { id: 'depth', description: 'Ideas are well-developed with examples', points: 30 },
        { id: 'evidence', description: 'Claims supported by credible evidence', points: 30 },
        { id: 'mechanics', description: 'Grammar and spelling are correct', points: 20 },
      ],
      totalPoints: 100,
    };

    const submission = { /* essay content */ };
    const grade = await gradingService.grade(submission, rubric);

    // Check feedback mentions each criterion
    rubric.criteria.forEach(criterion => {
      const mentionedInFeedback = grade.feedback.toLowerCase().includes(criterion.id) ||
                                  grade.feedback.includes(criterion.description);
      expect(mentionedInFeedback).toBe(true);
    });

    // Check score breakdown aligns with criteria
    const scoreBreakdown = grade.rubricAlignment;
    let totalScore = 0;
    scoreBreakdown.forEach(alignment => {
      expect(alignment.score).toBeGreaterThanOrEqual(0);
      expect(alignment.score).toBeLessThanOrEqual(alignment.maxPoints);
      totalScore += alignment.score;
    });
    expect(totalScore).toBe(grade.score);
  });
});
`

### Property 3: Confidence Calibration

**Statement**: High-confidence grades are more likely to be correct than low-confidence grades.

`	ypescript
// Property: correlation(confidence, accuracy) > 0.6
// Grades with confidence > 80% should have <5% override rate
// Grades with confidence < 40% should have >20% override rate

describe('Confidence Calibration Property', () => {
  test('high-confidence grades have lower override rate', async () => {
    const submissions = await generateTestSubmissions(100);
    const results = await Promise.all(
      submissions.map(sub => gradingService.grade(sub, rubric))
    );

    // Partition by confidence
    const highConfidence = results.filter(r => r.confidence >= 80);
    const lowConfidence = results.filter(r => r.confidence < 40);

    // Simulate instructor reviews (override if grade seems wrong)
    const highConfidenceOverrides = await simulateInstructorReview(highConfidence);
    const lowConfidenceOverrides = await simulateInstructorReview(lowConfidence);

    const highOverrideRate = highConfidenceOverrides.length / highConfidence.length;
    const lowOverrideRate = lowConfidenceOverrides.length / lowConfidence.length;

    expect(highOverrideRate).toBeLessThan(0.05);  // <5% override
    expect(lowOverrideRate).toBeGreaterThan(0.15); // >15% override
  });
});
`

### Property 4: No Data Loss in Incremental Grading

**Statement**: Incremental grading never loses or overwrites previous grades. All submissions are preserved.

`	ypescript
// Property: ? submission_n ? ? grade_n AND ? i < n ? grade_i is preserved

describe('Incremental Grading Preservation Property', () => {
  test('all incremental submission grades are preserved', async () => {
    const assignment = { allowIncremental: true };
    
    // Student submits 5 times
    const submissions = [];
    for (let i = 1; i <= 5; i++) {
      const submission = await submissionService.submit({
        assignmentId,
        content: \Submission version \\,
        studentId,
      });
      submissions.push(submission);

      // Grade each
      const grade = await gradingService.grade(submission, rubric);
      expect(grade).toBeDefined();
    }

    // Verify all grades still exist and are not overwritten
    const retrievedGrades = await gradeRepository.findByAssignmentAndStudent(
      assignmentId,
      studentId,
    );

    expect(retrievedGrades.length).toBe(5);

    // Each grade corresponds to correct submission
    retrievedGrades.forEach((grade, index) => {
      expect(grade.submissionId).toBe(submissions[index].id);
      expect(grade.feedback).toContain(\ersion \\);
    });

    // Composite grade calculation is deterministic
    const compositeGrade1 = await gradeRepository.calculateCompositeGrade(
      assignmentId,
      studentId,
      'average',
    );
    const compositeGrade2 = await gradeRepository.calculateCompositeGrade(
      assignmentId,
      studentId,
      'average',
    );
    expect(compositeGrade1).toBe(compositeGrade2);
  });
});
`

### Property 5: Plagiarism Score Monotonicity

**Statement**: If submission A is a superset of submission B (contains all of B's content plus more original content), then plagiarism(A) = plagiarism(B).

`	ypescript
// Property: content(B) ? content(A) ? plagiarism_score(A) = plagiarism_score(B)

describe('Plagiarism Score Monotonicity Property', () => {
  test('adding original content reduces plagiarism score', async () => {
    const plagiarizedText = 'The quick brown fox jumps over the lazy dog.';
    const originalText = 'And the dog was very happy.';

    const submission1 = { content: plagiarizedText };
    const submission2 = { content: plagiarizedText + ' ' + originalText };

    const score1 = await plagiarismService.scan(submission1);
    const score2 = await plagiarismService.scan(submission2);

    expect(score2.plagiarismScore).toBeLessThanOrEqual(score1.plagiarismScore);
  });
});
`

### Property 6: AI Content Detection Accuracy

**Statement**: AI-generated content is flagged more reliably than human-written content.

`	ypescript
// Property: P(flaggedAsAI | isAI) > P(flaggedAsAI | isHuman)
// i.e., True Positive Rate > False Positive Rate

describe('AI Content Detection Accuracy Property', () => {
  test('AI content detected with higher accuracy than human content', async () => {
    const aiGeneratedSamples = [
      { content: generateWithGPT4('essay on climate change'), isAI: true },
      { content: generateWithGPT4('mathematical proof'), isAI: true },
    ];

    const humanWrittenSamples = [
      { content: humanWrittenEssay1, isAI: false },
      { content: humanWrittenEssay2, isAI: false },
    ];

    const allSamples = [...aiGeneratedSamples, ...humanWrittenSamples];
    const detectionResults = await Promise.all(
      allSamples.map(sample => aiDetectionService.detect(sample.content))
    );

    // Calculate TPR and FPR
    const truePositives = detectionResults.filter(
      (result, idx) => result.isAI && allSamples[idx].isAI
    ).length;
    const falsePositives = detectionResults.filter(
      (result, idx) => result.isAI && !allSamples[idx].isAI
    ).length;

    const tpr = truePositives / aiGeneratedSamples.length;
    const fpr = falsePositives / humanWrittenSamples.length;

    expect(tpr).toBeGreaterThan(0.8);  // Detect 80% of AI content
    expect(fpr).toBeLessThan(0.1);     // False alarm < 10%
    expect(tpr).toBeGreaterThan(fpr);  // TPR > FPR
  });
});
`

### Property 7: RBAC Enforcement

**Statement**: Users cannot access resources outside their permitted scope. Permission checks are enforced on every request.

`	ypescript
// Property: ? user, resource ? canAccess(user, resource) ? user has permission

describe('RBAC Enforcement Property', () => {
  test('student cannot access other student submissions', async () => {
    const student1 = await createUser({ role: Role.STUDENT });
    const student2 = await createUser({ role: Role.STUDENT });
    const submission1 = await submissionService.create({
      studentId: student1.id,
      assignmentId,
    });

    // Set user context to student2
    setCurrentUser(student2);

    // Try to access student1's submission
    expect(async () => {
      await submissionService.getSubmission(submission1.id);
    }).rejects.toThrow(ForbiddenException);
  });

  test('instructor cannot override grades without permission', async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const differentInstructor = await createUser({ role: Role.INSTRUCTOR });
    const grade = await gradeRepository.create({
      score: 85,
      createdBy: instructor.id,
    });

    setCurrentUser(differentInstructor);

    expect(async () => {
      await gradeService.overrideGrade(grade.id, { newScore: 90, rationale: '...' });
    }).rejects.toThrow(ForbiddenException);
  });
});
`

### Property 8: Audit Trail Immutability

**Statement**: Audit logs cannot be modified or deleted once created. All changes are logged.

`	ypescript
// Property: ? log ? auditLogs ? log.createdAt ? null AND log.modifiedAfterCreation = false

describe('Audit Trail Immutability Property', () => {
  test('audit logs are immutable', async () => {
    const gradingEvent = await auditLogger.logEvent({
      tenantId,
      eventType: 'grade_created',
      resourceId: gradeId,
    });

    // Try to modify
    expect(async () => {
      await auditRepository.update(gradingEvent.id, { resourceId: 'different-id' });
    }).rejects.toThrow();

    // Try to delete
    expect(async () => {
      await auditRepository.delete(gradingEvent.id);
    }).rejects.toThrow();

    // Verify log still exists unchanged
    const retrieved = await auditRepository.findById(gradingEvent.id);
    expect(retrieved).toEqual(gradingEvent);
  });
});
`

---

## PBT Generators

Use property-based testing to generate random test cases:

`	ypescript
import { arbitraryAssignmentWithSubmissions, arbitraryRubric, arbitrarySubmission } from './generators';

// Fast-check for generating random test data
describe('Property-Based Tests for Grading', () => {
  test('grade scores are always within valid range', () => {
    fc.assert(
      fc.property(arbitrarySubmission(), arbitraryRubric(), async (submission, rubric) => {
        const grade = await gradingService.grade(submission, rubric);
        expect(grade.score).toBeGreaterThanOrEqual(0);
        expect(grade.score).toBeLessThanOrEqual(rubric.pointValue);
      }),
      { numRuns: 100 }
    );
  });
});
`

---

## Test Coverage Target

- **Unit tests**: >80% coverage for all domain services
- **Integration tests**: All API endpoints with valid/invalid inputs
- **Property-based tests**: Core algorithms (grading, plagiarism, RBAC)
- **E2E tests**: Critical user workflows (submit ? grade ? view results)

---

## Running Tests

`ash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# Property-based tests
npm run test:property

# All tests with coverage
npm run test:coverage

# Watch mode
npm run test:watch
`

