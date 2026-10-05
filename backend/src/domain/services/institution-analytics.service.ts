import { Injectable, Logger } from '@nestjs/common';
import { Repository, MoreThan } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Course } from '../entities/course.entity';
import { CourseEnrollment } from '../entities/course-enrollment.entity';
import { Grade } from '../entities/grade.entity';
import { Submission } from '../entities/submission.entity';
import { User } from '../entities/user.entity';

/**
 * Institution Analytics Service
 *
 * Provides institution-level analytics including:
 * - Course count, active students count
 * - Submission statistics
 * - Grade distribution across courses
 * - Student outcome tracking
 *
 * Validates: Requirements 5.6, 1.5, 10
 */

export interface InstitutionAnalytics {
  institutionId: string;
  totalCourses: number;
  activeCourses: number;
  archivedCourses: number;
  totalStudents: number;
  activeStudents: number;
  totalInstructors: number;
  totalSubmissions: number;
  completionRate: number; // percentage
  averageGrade: number | null;
  gradeDistribution: {
    rangeStart: number;
    rangeEnd: number;
    percentage: number;
  }[];
  courseMetrics: CourseMetric[];
  studentOutcomes: StudentOutcome[];
  reportDate: Date;
}

export interface CourseMetric {
  courseId: string;
  courseCode: string;
  courseName: string;
  enrolledStudents: number;
  submissionCount: number;
  averageGrade: number | null;
  completionRate: number; // percentage
}

export interface StudentOutcome {
  studentId: string;
  studentName: string;
  coursesEnrolled: number;
  averageGrade: number | null;
  completionRate: number; // percentage
  status: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'BELOW_AVERAGE' | 'AT_RISK';
}

@Injectable()
export class InstitutionAnalyticsService {
  private readonly logger = new Logger(InstitutionAnalyticsService.name);

  constructor(
    @InjectRepository(Course)
    private courseRepository: Repository<Course>,
    @InjectRepository(CourseEnrollment)
    private enrollmentRepository: Repository<CourseEnrollment>,
    @InjectRepository(Grade)
    private gradeRepository: Repository<Grade>,
    @InjectRepository(Submission)
    private submissionRepository: Repository<Submission>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Get comprehensive institution-level analytics
   * Requirement: 5.6, 1.5
   */
  async getInstitutionAnalytics(
    institutionId: string,
    tenantId: string,
  ): Promise<InstitutionAnalytics> {
    try {
      // Get course metrics
      const [totalCourses, activeCourses, archivedCourses] =
        await Promise.all([
          this.courseRepository.count({
            where: { institution_id: institutionId },
          }),
          this.courseRepository.count({
            where: {
              institution_id: institutionId,
              status: 'ACTIVE',
            },
          }),
          this.courseRepository.count({
            where: {
              institution_id: institutionId,
              status: 'ARCHIVED',
            },
          }),
        ]);

      // Get student counts
      const [totalStudents, totalInstructors] = await Promise.all([
        this.countStudentsByInstitution(institutionId),
        this.countInstructorsByInstitution(institutionId),
      ]);

      const activeStudents = await this.countActiveStudents(institutionId);

      // Get submission statistics
      const submissions = await this.getInstitutionSubmissions(
        institutionId,
        tenantId,
      );
      const totalSubmissions = submissions.length;

      // Get all grades to calculate completion and distribution
      const allCourses = await this.courseRepository.find({
        where: { institution_id: institutionId },
      });

      let totalGrades = 0;
      let gradeCount = 0;
      const gradeDistribution: Map<string, number> = new Map();

      for (const course of allCourses) {
        const courseGrades = await this.gradeRepository.find({
          where: { submission: { assignment: { course_id: course.id } } },
          relations: ['submission', 'submission.assignment'],
        });

        for (const grade of courseGrades) {
          if (grade.final_score !== null) {
            const score = parseFloat(grade.final_score.toString());
            totalGrades += score;
            gradeCount++;

            // Categorize score into distribution buckets
            const bucket = Math.floor(score / 10) * 10;
            const key = `${bucket}-${bucket + 10}`;
            gradeDistribution.set(key, (gradeDistribution.get(key) || 0) + 1);
          }
        }
      }

      const averageGrade = gradeCount > 0 ? totalGrades / gradeCount : null;

      // Calculate completion rate
      const totalEnrollments = await this.enrollmentRepository.count({
        where: { role: 'STUDENT' },
      });
      const completionRate =
        totalEnrollments > 0
          ? Math.round(
            (submissions.length /
              (totalEnrollments *
                Math.max(1, allCourses.length))) *
            100,
          )
          : 0;

      // Get course metrics
      const courseMetrics = await this.getCourseMetrics(
        institutionId,
        tenantId,
      );

      // Get student outcomes
      const studentOutcomes = await this.getStudentOutcomes(
        institutionId,
        tenantId,
      );

      // Format grade distribution
      const formattedDistribution = Array.from(
        gradeDistribution.entries(),
      ).map(([range, count]) => {
        const [start] = range.split('-').map(Number);
        return {
          rangeStart: start,
          rangeEnd: start + 10,
          percentage: parseFloat(
            ((count / (gradeCount || 1)) * 100).toFixed(2),
          ),
        };
      });

      return {
        institutionId,
        totalCourses,
        activeCourses,
        archivedCourses,
        totalStudents,
        activeStudents,
        totalInstructors,
        totalSubmissions,
        completionRate,
        averageGrade: averageGrade
          ? parseFloat(averageGrade.toFixed(2))
          : null,
        gradeDistribution: formattedDistribution,
        courseMetrics,
        studentOutcomes,
        reportDate: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to get institution analytics for ${institutionId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get metrics for each course in the institution
   */
  private async getCourseMetrics(
    institutionId: string,
    tenantId: string,
  ): Promise<CourseMetric[]> {
    try {
      const courses = await this.courseRepository.find({
        where: { institution_id: institutionId },
      });

      const metrics: CourseMetric[] = [];

      for (const course of courses) {
        const enrolledStudents = await this.enrollmentRepository.count({
          where: {
            course_id: course.id,
            role: 'STUDENT',
          },
        });

        const submissions = await this.submissionRepository.count({
          where: { tenant_id: tenantId },
        });

        // Get average grade for course
        const grades = await this.gradeRepository.find({
          where: { submission: { assignment: { course_id: course.id } } },
          relations: ['submission', 'submission.assignment'],
        });

        let totalGrade = 0;
        let gradeCount = 0;

        for (const grade of grades) {
          if (grade.final_score !== null) {
            totalGrade += parseFloat(grade.final_score.toString());
            gradeCount++;
          }
        }

        const averageGrade = gradeCount > 0 ? totalGrade / gradeCount : null;
        const completionRate =
          enrolledStudents > 0
            ? Math.round((submissions / enrolledStudents) * 100)
            : 0;

        metrics.push({
          courseId: course.id,
          courseCode: course.code,
          courseName: course.title,
          enrolledStudents,
          submissionCount: submissions,
          averageGrade: averageGrade
            ? parseFloat(averageGrade.toFixed(2))
            : null,
          completionRate,
        });
      }

      return metrics;
    } catch (error) {
      this.logger.error(`Failed to get course metrics:`, error);
      throw error;
    }
  }

  /**
   * Get student outcomes and performance tracking
   * Requirement: 1.5
   */
  private async getStudentOutcomes(
    institutionId: string,
    tenantId: string,
  ): Promise<StudentOutcome[]> {
    try {
      // Get all students in the institution
      const enrollments = await this.enrollmentRepository.find({
        where: { role: 'STUDENT' },
        relations: ['user'],
      });

      const outcomes: StudentOutcome[] = [];

      // Track unique students
      const studentMap = new Map<string, Set<string>>();

      for (const enrollment of enrollments) {
        if (!studentMap.has(enrollment.user_id)) {
          studentMap.set(enrollment.user_id, new Set());
        }
        studentMap.get(enrollment.user_id).add(enrollment.course_id);
      }

      for (const [studentId, courseIds] of studentMap) {
        const submissions = await this.submissionRepository.find({
          where: { student_id: studentId, tenant_id: tenantId },
          relations: ['grades'],
        });

        let totalGrade = 0;
        let gradeCount = 0;

        for (const submission of submissions) {
          const grade = submission.grades?.[0];
          if (grade?.final_score) {
            totalGrade += parseFloat(grade.final_score.toString());
            gradeCount++;
          }
        }

        const averageGrade = gradeCount > 0 ? totalGrade / gradeCount : null;
        const completionRate =
          courseIds.size > 0
            ? Math.round((submissions.length / courseIds.size) * 100)
            : 0;

        // Determine status based on average grade
        let status: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'BELOW_AVERAGE' | 'AT_RISK';
        if (averageGrade === null || averageGrade < 60) {
          status = 'AT_RISK';
        } else if (averageGrade < 70) {
          status = 'BELOW_AVERAGE';
        } else if (averageGrade < 80) {
          status = 'AVERAGE';
        } else if (averageGrade < 90) {
          status = 'GOOD';
        } else {
          status = 'EXCELLENT';
        }

        const student = enrollments.find(
          (e) => e.user_id === studentId,
        )?.user;

        outcomes.push({
          studentId,
          studentName: student?.name || 'Unknown',
          coursesEnrolled: courseIds.size,
          averageGrade: averageGrade
            ? parseFloat(averageGrade.toFixed(2))
            : null,
          completionRate,
          status,
        });
      }

      return outcomes.sort((a, b) => {
        // Sort by status (at-risk first)
        const statusOrder = {
          AT_RISK: 0,
          BELOW_AVERAGE: 1,
          AVERAGE: 2,
          GOOD: 3,
          EXCELLENT: 4,
        };
        return statusOrder[a.status] - statusOrder[b.status];
      });
    } catch (error) {
      this.logger.error(`Failed to get student outcomes:`, error);
      throw error;
    }
  }

  /**
   * Count students in institution
   */
  private async countStudentsByInstitution(
    institutionId: string,
  ): Promise<number> {
    const enrollments = await this.enrollmentRepository.find({
      where: { role: 'STUDENT' },
    });
    const studentIds = new Set(enrollments.map((e) => e.user_id));
    return studentIds.size;
  }

  /**
   * Count instructors in institution
   */
  private async countInstructorsByInstitution(
    institutionId: string,
  ): Promise<number> {
    const enrollments = await this.enrollmentRepository.find({
      where: { role: 'INSTRUCTOR' },
    });
    const instructorIds = new Set(enrollments.map((e) => e.user_id));
    return instructorIds.size;
  }

  /**
   * Count active students (with recent submissions)
   */
  private async countActiveStudents(
    institutionId: string,
  ): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentSubmissions = await this.submissionRepository.find({
      where: {
        submitted_at: MoreThan(thirtyDaysAgo),
      },
    });

    const activeStudentIds = new Set(
      recentSubmissions.map((s) => s.student_id),
    );
    return activeStudentIds.size;
  }

  /**
   * Get all submissions for institution
   */
  private async getInstitutionSubmissions(
    institutionId: string,
    tenantId: string,
  ): Promise<Submission[]> {
    const courses = await this.courseRepository.find({
      where: { institution_id: institutionId },
    });

    const courseIds = courses.map((c) => c.id);

    if (courseIds.length === 0) return [];

    return this.submissionRepository.find({
      where: {
        tenant_id: tenantId,
      },
      relations: ['assignment'],
    });
  }
}
