import { Injectable } from '@nestjs/common';
import { GradeRepository } from '../repositories/grade.repository';
import { SubmissionRepository } from '../repositories/submission.repository';
import { Grade } from '../entities/grade.entity';
import { Submission } from '../entities/submission.entity';

/**
 * Incremental Grade Aggregation Service (Task 3.11)
 *
 * Aggregates grades from multiple incremental submissions.
 * Tracks grade progression and calculates composite grades.
 *
 * Aggregation Strategies:
 * - Average: Mean of all submission grades (default)
 * - Final Only: Only the final submission grade
 * - Weighted: Weighted average by version
 *
 * Requirements Met:
 * ✓ 3.11: Incremental Grading Aggregation
 * ✓ 16: Incremental grading workflow
 * ✓ Property Test: No Data Loss (all grades preserved)
 */
@Injectable()
export class IncrementalGradeAggregationService {
  constructor(
    private gradeRepository: GradeRepository,
    private submissionRepository: SubmissionRepository,
  ) {}

  /**
   * Calculate composite grade from multiple submissions
   *
   * Default strategy: Average of all submission scores
   * Preserves individual submission grades separately
   *
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @param studentId - Student ID
   * @param strategy - Aggregation strategy (default: 'average')
   * @returns Composite grade information
   */
  async calculateCompositeGrade(
    tenantId: string,
    assignmentId: string,
    studentId: string,
    strategy: 'average' | 'final_only' | 'weighted' = 'average',
  ): Promise<{
    composite_score: number;
    strategy: string;
    individual_grades: Array<{
      version: number;
      score: number;
      submitted_at: Date;
    }>;
    progression: number[];
  }> {
    // Get all submissions
    const submissions = await this.submissionRepository.findByAssignmentAndStudent(
      studentId,
      assignmentId,
      tenantId,
    );

    if (submissions.length === 0) {
      return {
        composite_score: 0,
        strategy,
        individual_grades: [],
        progression: [],
      };
    }

    // Get grades for each submission
    const gradesWithSubmissions: Array<{
      submission: Submission;
      grade: Grade | null;
    }> = [];

    for (const submission of submissions) {
      const grade = await this.gradeRepository.findOne({
        where: {
          tenant_id: tenantId,
          submission_id: submission.id,
        },
      });

      gradesWithSubmissions.push({ submission, grade });
    }

    // Extract individual grades
    const individualGrades = gradesWithSubmissions
      .filter(g => g.grade && g.grade.final_score !== null)
      .map(g => ({
        version: g.submission.version,
        score: g.grade!.final_score!,
        submitted_at: g.submission.submitted_at,
      }));

    // Calculate composite score based on strategy
    const compositeScore = this.aggregateGrades(
      individualGrades.map(g => g.score),
      strategy,
    );

    // Get progression (grade trend)
    const progression = individualGrades.map(g => g.score);

    return {
      composite_score: Number(compositeScore.toFixed(2)),
      strategy,
      individual_grades: individualGrades,
      progression,
    };
  }

  /**
   * Aggregate grades using specified strategy
   * @private
   */
  private aggregateGrades(
    scores: number[],
    strategy: 'average' | 'final_only' | 'weighted',
  ): number {
    if (scores.length === 0) {
      return 0;
    }

    switch (strategy) {
      case 'final_only':
        return scores[scores.length - 1];

      case 'weighted':
        // Newer submissions weighted more heavily
        let totalWeight = 0;
        let weightedSum = 0;

        scores.forEach((score, index) => {
          const weight = index + 1; // Linear weights: 1, 2, 3, ...
          weightedSum += score * weight;
          totalWeight += weight;
        });

        return weightedSum / totalWeight;

      case 'average':
      default:
        return scores.reduce((a, b) => a + b, 0) / scores.length;
    }
  }

  /**
   * Get grade progression for a student
   * Shows improvement over submission versions
   *
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @param studentId - Student ID
   * @returns Grade progression data
   */
  async getGradeProgression(
    tenantId: string,
    assignmentId: string,
    studentId: string,
  ): Promise<{
    versions: Array<{
      version: number;
      score: number | null;
      feedback_length: number;
      submitted_at: Date;
    }>;
    trend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
    improvement: number; // Percentage improvement from first to last
  }> {
    const submissions = await this.submissionRepository.findByAssignmentAndStudent(
      studentId,
      assignmentId,
      tenantId,
    );

    const versionData = [];
    let firstScore = null;
    let lastScore = null;

    for (const submission of submissions) {
      const grade = await this.gradeRepository.findOne({
        where: {
          tenant_id: tenantId,
          submission_id: submission.id,
        },
      });

      const score = grade?.final_score || null;
      const feedbackLength = grade?.feedback?.length || 0;

      versionData.push({
        version: submission.version,
        score,
        feedback_length: feedbackLength,
        submitted_at: submission.submitted_at,
      });

      if (firstScore === null && score !== null) {
        firstScore = score;
      }
      if (score !== null) {
        lastScore = score;
      }
    }

    // Determine trend
    let trend: 'improving' | 'declining' | 'stable' | 'insufficient_data' =
      'insufficient_data';

    if (versionData.length >= 2) {
      const scores = versionData.map(v => v.score).filter(s => s !== null);

      if (scores.length >= 2) {
        const changes = [];
        for (let i = 1; i < scores.length; i++) {
          changes.push(scores[i] - scores[i - 1]);
        }

        const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;

        if (avgChange > 2) {
          trend = 'improving';
        } else if (avgChange < -2) {
          trend = 'declining';
        } else {
          trend = 'stable';
        }
      }
    }

    // Calculate improvement
    const improvement =
      firstScore !== null && lastScore !== null
        ? ((lastScore - firstScore) / firstScore) * 100
        : 0;

    return {
      versions: versionData,
      trend,
      improvement: Number(improvement.toFixed(1)),
    };
  }

  /**
   * Verify no data loss in aggregation
   * Property Test: No Data Loss
   *
   * Ensures all individual grades preserved when calculating composite
   *
   * @param tenantId - Tenant ID
   * @param assignmentId - Assignment ID
   * @param studentId - Student ID
   * @returns true if no data loss detected
   */
  async verifyNoDataLoss(
    tenantId: string,
    assignmentId: string,
    studentId: string,
  ): Promise<boolean> {
    const submissions = await this.submissionRepository.findByAssignmentAndStudent(
      studentId,
      assignmentId,
      tenantId,
    );

    const grades = await Promise.all(
      submissions.map(s =>
        this.gradeRepository.findOne({
          where: {
            tenant_id: tenantId,
            submission_id: s.id,
          },
        }),
      ),
    );

    // Check all grades exist and have scores
    const gradedSubmissions = submissions.filter((_, i) => grades[i] !== null);
    const allHaveScores = gradedSubmissions.every(
      (_, i) => grades[submissions.indexOf(_)].final_score !== null,
    );

    // Verify counts match
    const gradesCount = grades.filter(g => g !== null).length;
    const expectCount = submissions.length;

    return allHaveScores && gradesCount === expectCount;
  }

  /**
   * Get aggregation statistics for an assignment
   */
  async getAggregationStats(
    tenantId: string,
    assignmentId: string,
  ): Promise<{
    total_students: number;
    with_multiple_submissions: number;
    avg_composite_score: number;
    std_dev: number;
  }> {
    const submissions = await this.submissionRepository.findByAssignment(
      assignmentId,
      tenantId,
    );

    const studentIds = new Set(submissions.map(s => s.student_id));
    const studentStats = [];

    for (const studentId of studentIds) {
      const comp = await this.calculateCompositeGrade(
        tenantId,
        assignmentId,
        studentId,
      );

      if (comp.composite_score > 0) {
        studentStats.push({
          composite_score: comp.composite_score,
          versions: comp.individual_grades.length,
        });
      }
    }

    const compositeScores = studentStats.map(s => s.composite_score);
    const avgScore =
      compositeScores.length > 0
        ? compositeScores.reduce((a, b) => a + b, 0) / compositeScores.length
        : 0;

    // Calculate standard deviation
    const variance =
      compositeScores.length > 0
        ? compositeScores.reduce(
            (sum, score) => sum + Math.pow(score - avgScore, 2),
            0,
          ) / compositeScores.length
        : 0;
    const stdDev = Math.sqrt(variance);

    return {
      total_students: studentIds.size,
      with_multiple_submissions: studentStats.filter(s => s.versions > 1).length,
      avg_composite_score: Number(avgScore.toFixed(2)),
      std_dev: Number(stdDev.toFixed(2)),
    };
  }
}
