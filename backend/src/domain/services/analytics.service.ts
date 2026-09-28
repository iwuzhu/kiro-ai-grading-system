import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Grade } from '../entities/grade.entity';
import { Submission } from '../entities/submission.entity';
import { Assignment } from '../entities/assignment.entity';
import { Course } from '../entities/course.entity';
import { CourseEnrollment } from '../entities/course-enrollment.entity';
import { GradebookQueryService } from './gradebook-query.service';

/**
 * Analytics Service
 *
 * Provides course-level analytics including:
 * - Mean, median, quartiles, distribution of grades
 * - Identification of struggling students
 * - Submission completion rates
 * - Trend reports and grade progression
 *
 * Validates: Requirements 10.3, 10.5, 10.6, 10.7
 */

export interface CourseAnalytics {
  courseId: string;
  courseName: string;
  enrolledStudents: number;
  totalAssignments: number;
  gradeStatistics: GradeStatistics;
  submissionMetrics: SubmissionMetrics;
  strugglingStudents: StrugglingStudent[];
  submissionCompletionRate: number; // 0-100%
}

export interface GradeStatistics {
  mean: number;
  median: number;
  q1: number; // 25th percentile
  q3: number; // 75th percentile
  min: number;
  max: number;
  stdDev: number;
  distribution: GradeDistributionBucket[];
}

export interface GradeDistributionBucket {
  rangeStart: number;
  rangeEnd: number;
  count: number;
  percentage: number;
}

export interface SubmissionMetrics {
  totalSubmissions: number;
  submittedStudents: number;
  onTimeSubmissions: number;
  lateSubmissions: number;
  avgSubmissionsPerAssignment: number;
  avgSubmissionsPerStudent: number;
  submissionCompletionRate: number; // percentage
}

export interface StrugglingStudent {
  studentId: string;
  studentName: string;
  averageGrade: number | null;
  completionRate: number;
  submissionCount: number;
  flaggedAssignments: string[]; // titles of assignments with low grades
}

export interface TrendReport {
  courseId: string;
  reportDate: Date;
  weeklyAverageGrades: WeeklyTrend[];
  gradeTrend: 'improving' | 'declining' | 'stable';
  trendStrength: number; // -1.0 to 1.0 (declining to improving)
}

export interface WeeklyTrend {
  week: number;
  averageGrade: number | null;
  submissionsCount: number;
  averageConfidence: number | null;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(Grade)
    private gradeRepository: Repository<Grade>,
    @InjectRepository(Submission)
    private submissionRepository: Repository<Submission>,
    @InjectRepository(Assignment)
    private assignmentRepository: Repository<Assignment>,
    @InjectRepository(Course)
    private courseRepository: Repository<Course>,
    @InjectRepository(CourseEnrollment)
    private enrollmentRepository: Repository<CourseEnrollment>,
    private gradebookQueryService: GradebookQueryService,
  ) {}

  /**
   * Get comprehensive course analytics
   * Requirement 10.3, 10.5, 10.6
   */
  async getCourseAnalytics(
    courseId: string,
    tenantId: string,
    performanceThreshold: number = 70,
  ): Promise<CourseAnalytics> {
    try {
      // Get course info
      const course = await this.courseRepository.findOneBy({
        id: courseId,
        tenant_id: tenantId,
      });

      if (!course) {
        throw new Error(`Course ${courseId} not found`);
      }

      // Get enrolled students count
      const enrolledStudents = await this.enrollmentRepository.count({
        where: {
          course_id: courseId,
          role: 'STUDENT',
        },
      });

      // Get assignments count
      const totalAssignments = await this.assignmentRepository.count({
        where: {
          course_id: courseId,
          tenant_id: tenantId,
        },
      });

      // Get grade statistics
      const gradeStatistics = await this.calculateGradeStatistics(
        courseId,
        tenantId,
      );

      // Get submission metrics
      const submissionMetrics = await this.calculateSubmissionMetrics(
        courseId,
        tenantId,
      );

      // Get struggling students
      const strugglingStudents =
        await this.identifyStrugglingStudents(
          courseId,
          tenantId,
          performanceThreshold,
        );

      return {
        courseId,
        courseName: course.title,
        enrolledStudents,
        totalAssignments,
        gradeStatistics,
        submissionMetrics,
        strugglingStudents,
        submissionCompletionRate: submissionMetrics.submissionCompletionRate,
      };
    } catch (error) {
      this.logger.error(
        `Failed to calculate course analytics for ${courseId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Calculate grade distribution and statistics
   */
  private async calculateGradeStatistics(
    courseId: string,
    tenantId: string,
  ): Promise<GradeStatistics> {
    try {
      // Get all grades for the course
      const query = this.gradeRepository
        .createQueryBuilder('grade')
        .innerJoin(
          'grade.submission',
          'submission',
          'submission.tenant_id = :tenantId',
        )
        .innerJoin(
          'grade.assignment',
          'assignment',
          'assignment.course_id = :courseId',
        )
        .where('grade.final_score IS NOT NULL')
        .setParameter('tenantId', tenantId)
        .setParameter('courseId', courseId);

      const grades = await query
        .select('grade.final_score', 'score')
        .getRawMany();

      const scores = grades
        .map((g) => parseFloat(g.score.toString()))
        .sort((a, b) => a - b);

      if (scores.length === 0) {
        return {
          mean: 0,
          median: 0,
          q1: 0,
          q3: 0,
          min: 0,
          max: 0,
          stdDev: 0,
          distribution: [],
        };
      }

      // Calculate statistics
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const median =
        scores.length % 2 === 0
          ? (scores[scores.length / 2 - 1] + scores[scores.length / 2]) / 2
          : scores[Math.floor(scores.length / 2)];

      const q1Index = Math.floor(scores.length / 4);
      const q1 = scores[q1Index];

      const q3Index = Math.floor((scores.length * 3) / 4);
      const q3 = scores[q3Index];

      const variance =
        scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) /
        scores.length;
      const stdDev = Math.sqrt(variance);

      // Calculate distribution buckets (0-10, 10-20, ..., 90-100)
      const distribution: GradeDistributionBucket[] = [];
      for (let i = 0; i < 10; i++) {
        const rangeStart = i * 10;
        const rangeEnd = (i + 1) * 10;
        const count = scores.filter(
          (s) => s >= rangeStart && s < rangeEnd,
        ).length;
        distribution.push({
          rangeStart,
          rangeEnd,
          count,
          percentage: parseFloat(((count / scores.length) * 100).toFixed(2)),
        });
      }

      return {
        mean: parseFloat(mean.toFixed(2)),
        median: parseFloat(median.toFixed(2)),
        q1: parseFloat(q1.toFixed(2)),
        q3: parseFloat(q3.toFixed(2)),
        min: parseFloat(scores[0].toFixed(2)),
        max: parseFloat(scores[scores.length - 1].toFixed(2)),
        stdDev: parseFloat(stdDev.toFixed(2)),
        distribution,
      };
    } catch (error) {
      this.logger.error(
        `Failed to calculate grade statistics for course ${courseId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Calculate submission completion metrics
   */
  private async calculateSubmissionMetrics(
    courseId: string,
    tenantId: string,
  ): Promise<SubmissionMetrics> {
    try {
      // Get all assignments for the course
      const assignments = await this.assignmentRepository.find({
        where: {
          course_id: courseId,
          tenant_id: tenantId,
        },
      });

      if (assignments.length === 0) {
        return {
          totalSubmissions: 0,
          submittedStudents: 0,
          onTimeSubmissions: 0,
          lateSubmissions: 0,
          avgSubmissionsPerAssignment: 0,
          avgSubmissionsPerStudent: 0,
          submissionCompletionRate: 0,
        };
      }

      // Get all submissions for the course
      const submissions = await this.submissionRepository.find({
        where: {
          tenant_id: tenantId,
        },
        relations: ['assignment'],
      });

      const courseSubmissions = submissions.filter((s) =>
        assignments.find((a) => a.id === s.assignment_id),
      );

      // Get enrolled students
      const enrollments = await this.enrollmentRepository.find({
        where: {
          course_id: courseId,
          role: 'STUDENT',
        },
      });

      const enrolledStudentIds = new Set(enrollments.map((e) => e.user_id));
      const submittedStudentIds = new Set(
        courseSubmissions.map((s) => s.student_id),
      );

      const onTimeSubmissions = courseSubmissions.filter(
        (s) => !s.is_late,
      ).length;
      const lateSubmissions = courseSubmissions.filter(
        (s) => s.is_late,
      ).length;

      const avgSubmissionsPerAssignment =
        courseSubmissions.length > 0
          ? parseFloat(
            (
              courseSubmissions.length / assignments.length
            ).toFixed(2),
          )
          : 0;

      const avgSubmissionsPerStudent =
        submittedStudentIds.size > 0
          ? parseFloat(
            (
              courseSubmissions.length / submittedStudentIds.size
            ).toFixed(2),
          )
          : 0;

      const submissionCompletionRate =
        enrolledStudentIds.size > 0
          ? Math.round(
            (submittedStudentIds.size / enrolledStudentIds.size) * 100,
          )
          : 0;

      return {
        totalSubmissions: courseSubmissions.length,
        submittedStudents: submittedStudentIds.size,
        onTimeSubmissions,
        lateSubmissions,
        avgSubmissionsPerAssignment,
        avgSubmissionsPerStudent,
        submissionCompletionRate,
      };
    } catch (error) {
      this.logger.error(
        `Failed to calculate submission metrics for course ${courseId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Identify students performing below threshold
   * Requirement 10.5
   */
  private async identifyStrugglingStudents(
    courseId: string,
    tenantId: string,
    performanceThreshold: number,
  ): Promise<StrugglingStudent[]> {
    try {
      // Get all enrolled students
      const enrollments = await this.enrollmentRepository.find({
        where: {
          course_id: courseId,
          role: 'STUDENT',
        },
        relations: ['user'],
      });

      const strugglingStudents: StrugglingStudent[] = [];

      for (const enrollment of enrollments) {
        // Get student's grades
        const studentSubmissions = await this.submissionRepository.find({
          where: {
            student_id: enrollment.user_id,
            tenant_id: tenantId,
          },
          relations: ['grades', 'assignment'],
        });

        let totalGrade = 0;
        let gradeCount = 0;
        const assignmentsWithLowGrades: string[] = [];

        for (const submission of studentSubmissions) {
          const grade = submission.grades?.[0];
          if (grade?.final_score) {
            const score = parseFloat(grade.final_score.toString());
            totalGrade += score;
            gradeCount++;

            if (score < performanceThreshold) {
              assignmentsWithLowGrades.push(submission.assignment.title);
            }
          }
        }

        const averageGrade = gradeCount > 0 ? totalGrade / gradeCount : null;

        if (averageGrade === null || averageGrade < performanceThreshold) {
          const allAssignments = await this.assignmentRepository.count({
            where: {
              course_id: courseId,
              tenant_id: tenantId,
            },
          });

          const completionRate =
            allAssignments > 0
              ? Math.round((studentSubmissions.length / allAssignments) * 100)
              : 0;

          strugglingStudents.push({
            studentId: enrollment.user_id,
            studentName: enrollment.user.name,
            averageGrade: averageGrade
              ? parseFloat(averageGrade.toFixed(2))
              : null,
            completionRate,
            submissionCount: studentSubmissions.length,
            flaggedAssignments: assignmentsWithLowGrades,
          });
        }
      }

      return strugglingStudents.sort(
        (a, b) => (a.averageGrade ?? 0) - (b.averageGrade ?? 0),
      );
    } catch (error) {
      this.logger.error(
        `Failed to identify struggling students for course ${courseId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Generate grade trend report for a course
   * Requirement 10.6
   */
  async generateTrendReport(
    courseId: string,
    tenantId: string,
  ): Promise<TrendReport> {
    try {
      // Get all assignments sorted by creation date
      const assignments = await this.assignmentRepository.find({
        where: {
          course_id: courseId,
          tenant_id: tenantId,
        },
        order: { created_at: 'ASC' },
      });

      const weeklyTrends: WeeklyTrend[] = [];

      for (const [index, assignment] of assignments.entries()) {
        const week = Math.floor(index / 3) + 1; // Group assignments into weeks

        // Get grades for this assignment
        const grades = await this.gradeRepository.find({
          where: {
            assignment_id: assignment.id,
          },
          relations: ['submission'],
        });

        // Filter for final scores only
        const scoresWithValue = grades
          .filter((g) => g.final_score !== null)
          .map((g) => parseFloat(g.final_score!.toString()));

        const averageGrade =
          scoresWithValue.length > 0
            ? parseFloat(
              (
                scoresWithValue.reduce((a, b) => a + b, 0) /
                scoresWithValue.length
              ).toFixed(2),
            )
            : null;

        const confidenceValues = grades
          .filter((g) => g.confidence !== null)
          .map((g) => parseFloat(g.confidence!.toString()));

        const averageConfidence =
          confidenceValues.length > 0
            ? parseFloat(
              (
                confidenceValues.reduce((a, b) => a + b, 0) /
                confidenceValues.length
              ).toFixed(2),
            )
            : null;

        // Merge weeks
        const existingWeek = weeklyTrends.find((w) => w.week === week);
        if (existingWeek) {
          if (averageGrade !== null) {
            existingWeek.averageGrade =
              (
                (existingWeek.averageGrade ?? 0) +
                averageGrade
              ) / 2;
          }
          existingWeek.submissionsCount += grades.length;
          if (averageConfidence !== null) {
            existingWeek.averageConfidence =
              (
                (existingWeek.averageConfidence ?? 0) +
                averageConfidence
              ) / 2;
          }
        } else {
          weeklyTrends.push({
            week,
            averageGrade,
            submissionsCount: grades.length,
            averageConfidence,
          });
        }
      }

      // Determine trend
      let trendStrength = 0;
      if (weeklyTrends.length >= 2) {
        const firstHalf = weeklyTrends.slice(
          0,
          Math.floor(weeklyTrends.length / 2),
        );
        const secondHalf = weeklyTrends.slice(
          Math.floor(weeklyTrends.length / 2),
        );

        const firstAvg =
          firstHalf.reduce((sum, w) => sum + (w.averageGrade ?? 0), 0) /
          firstHalf.length;
        const secondAvg =
          secondHalf.reduce((sum, w) => sum + (w.averageGrade ?? 0), 0) /
          secondHalf.length;

        trendStrength = (secondAvg - firstAvg) / 100;
      }

      let trend: 'improving' | 'declining' | 'stable';
      if (trendStrength > 0.05) {
        trend = 'improving';
      } else if (trendStrength < -0.05) {
        trend = 'declining';
      } else {
        trend = 'stable';
      }

      return {
        courseId,
        reportDate: new Date(),
        weeklyAverageGrades: weeklyTrends,
        gradeTrend: trend,
        trendStrength: parseFloat(trendStrength.toFixed(2)),
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate trend report for course ${courseId}:`,
        error,
      );
      throw error;
    }
  }
}
