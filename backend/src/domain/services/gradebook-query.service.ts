import { Injectable, Logger } from '@nestjs/common';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Submission } from '../entities/submission.entity';
import { Grade } from '../entities/grade.entity';
import { Assignment } from '../entities/assignment.entity';
import { CourseEnrollment } from '../entities/course-enrollment.entity';
import { User } from '../entities/user.entity';
import { Course } from '../entities/course.entity';

/**
 * Gradebook Query Service
 *
 * Provides efficient queries for gradebook display, including:
 * - Aggregate submissions and grades per student
 * - Filtering and sorting by student, grade, completion status
 * - Course grade calculation (final grades)
 * - Grade distribution analytics
 *
 * Validates: Requirements 10.1, 10.2, 10.3, 10.6, 18.1, 18.2, 18.6
 */

export interface GradebookEntry {
  studentId: string;
  studentName: string;
  studentEmail: string;
  courseGrade: number | null;
  completionRate: number; // 0-100%
  assignmentGrades: AssignmentGrade[];
}

export interface AssignmentGrade {
  assignmentId: string;
  assignmentTitle: string;
  assignmentPointValue: number;
  submissionCount: number;
  latestGrade: number | null;
  finalGrade: number | null;
  confidence: number | null;
  submittedAt: Date | null;
  isLate: boolean;
  feedback: string | null;
}

export interface GradebookQueryOptions {
  courseId: string;
  tenantId: string;
  sortBy?: 'name' | 'grade' | 'completion'; // default: name
  sortOrder?: 'ASC' | 'DESC'; // default: ASC
  filterByStatus?: 'complete' | 'incomplete' | 'all'; // default: all
  skipCount?: number;
  takeCount?: number;
}

export interface GradeDistribution {
  mean: number;
  median: number;
  q1: number; // 25th percentile
  q3: number; // 75th percentile
  min: number;
  max: number;
  stdDev: number;
}

export interface StudentProgressData {
  studentId: string;
  studentName: string;
  submissionCompletionRate: number; // percentage of assignments submitted
  averageGrade: number | null;
  gradeTrend: GradeTrendPoint[];
}

export interface GradeTrendPoint {
  assignmentOrder: number;
  grade: number | null;
  submittedAt: Date;
}

@Injectable()
export class GradebookQueryService {
  private readonly logger = new Logger(GradebookQueryService.name);

  constructor(
    @InjectRepository(Submission)
    private submissionRepository: Repository<Submission>,
    @InjectRepository(Grade)
    private gradeRepository: Repository<Grade>,
    @InjectRepository(Assignment)
    private assignmentRepository: Repository<Assignment>,
    @InjectRepository(CourseEnrollment)
    private enrollmentRepository: Repository<CourseEnrollment>,
    @InjectRepository(Course)
    private courseRepository: Repository<Course>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Get gradebook for a course with optional filtering and sorting
   * Requirement 10.2, 10.6, 18.1, 18.2
   */
  async getGradebook(
    options: GradebookQueryOptions,
  ): Promise<{ entries: GradebookEntry[]; total: number }> {
    const {
      courseId,
      tenantId,
      sortBy = 'name',
      sortOrder = 'ASC',
      filterByStatus = 'all',
      skipCount = 0,
      takeCount = 50,
    } = options;

    try {
      // Get all enrolled students for the course
      const enrollments = await this.enrollmentRepository.find({
        where: {
          course_id: courseId,
          role: 'STUDENT',
        },
        relations: ['user', 'course'],
      });

      const studentIds = enrollments.map((e) => e.user_id);

      // Get all assignments for the course
      const assignments = await this.assignmentRepository.find({
        where: {
          course_id: courseId,
          tenant_id: tenantId,
        },
        order: { created_at: 'ASC' },
      });

      // Build gradebook entries
      let entries: GradebookEntry[] = [];

      for (const enrollment of enrollments) {
        const entry = await this.buildGradebookEntry(
          enrollment.user,
          courseId,
          tenantId,
          assignments,
        );
        entries.push(entry);
      }

      // Apply filtering
      if (filterByStatus === 'complete') {
        entries = entries.filter((e) => e.completionRate === 100);
      } else if (filterByStatus === 'incomplete') {
        entries = entries.filter((e) => e.completionRate < 100);
      }

      // Apply sorting
      entries.sort((a, b) => {
        let compareVal = 0;

        if (sortBy === 'name') {
          compareVal = a.studentName.localeCompare(b.studentName);
        } else if (sortBy === 'grade') {
          const gradeA = a.courseGrade ?? -1;
          const gradeB = b.courseGrade ?? -1;
          compareVal = gradeA - gradeB;
        } else if (sortBy === 'completion') {
          compareVal = a.completionRate - b.completionRate;
        }

        return sortOrder === 'DESC' ? -compareVal : compareVal;
      });

      const total = entries.length;

      // Apply pagination
      entries = entries.slice(skipCount, skipCount + takeCount);

      return { entries, total };
    } catch (error) {
      this.logger.error(`Failed to get gradebook for course ${courseId}:`, error);
      throw error;
    }
  }

  /**
   * Build a single gradebook entry for a student
   */
  private async buildGradebookEntry(
    student: User,
    courseId: string,
    tenantId: string,
    assignments: Assignment[],
  ): Promise<GradebookEntry> {
    const assignmentGrades: AssignmentGrade[] = [];
    let totalGradePoints = 0;
    let totalPossiblePoints = 0;
    let completedAssignments = 0;

    for (const assignment of assignments) {
      // Get latest submission for this student/assignment
      const submission = await this.submissionRepository.findOne({
        where: {
          assignment_id: assignment.id,
          student_id: student.id,
          tenant_id: tenantId,
        },
        order: { version: 'DESC' },
        relations: ['grades'],
      });

      const grade = submission?.grades?.[0] || null;

      if (submission && grade) {
        assignmentGrades.push({
          assignmentId: assignment.id,
          assignmentTitle: assignment.title,
          assignmentPointValue: assignment.point_value,
          submissionCount: await this.getSubmissionVersionCount(
            assignment.id,
            student.id,
            tenantId,
          ),
          latestGrade: grade.final_score ? parseFloat(grade.final_score.toString()) : null,
          finalGrade: grade.final_score ? parseFloat(grade.final_score.toString()) : null,
          confidence: grade.confidence ? parseFloat(grade.confidence.toString()) : null,
          submittedAt: submission.submitted_at,
          isLate: submission.is_late,
          feedback: grade.feedback,
        });

        if (grade.final_score) {
          totalGradePoints += parseFloat(grade.final_score.toString());
          completedAssignments++;
        }

        totalPossiblePoints += assignment.point_value;
      } else {
        // No submission - add empty entry
        assignmentGrades.push({
          assignmentId: assignment.id,
          assignmentTitle: assignment.title,
          assignmentPointValue: assignment.point_value,
          submissionCount: 0,
          latestGrade: null,
          finalGrade: null,
          confidence: null,
          submittedAt: null,
          isLate: false,
          feedback: null,
        });
      }
    }

    // Calculate course grade (weighted by points)
    let courseGrade: number | null = null;
    if (totalPossiblePoints > 0) {
      courseGrade = parseFloat(
        ((totalGradePoints / totalPossiblePoints) * 100).toFixed(2),
      );
    }

    // Calculate completion rate
    const completionRate =
      assignments.length > 0
        ? Math.round((completedAssignments / assignments.length) * 100)
        : 0;

    return {
      studentId: student.id,
      studentName: student.name,
      studentEmail: student.email,
      courseGrade,
      completionRate,
      assignmentGrades,
    };
  }

  /**
   * Get count of submissions for a student/assignment
   */
  private async getSubmissionVersionCount(
    assignmentId: string,
    studentId: string,
    tenantId: string,
  ): Promise<number> {
    return this.submissionRepository.count({
      where: {
        assignment_id: assignmentId,
        student_id: studentId,
        tenant_id: tenantId,
      },
    });
  }

  /**
   * Get grade distribution statistics for a course
   * Requirement 10.3, 18.2
   */
  async getGradeDistribution(
    courseId: string,
    tenantId: string,
    assignmentId?: string,
  ): Promise<GradeDistribution> {
    try {
      let query = this.gradeRepository
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

      if (assignmentId) {
        query = query.andWhere('grade.assignment_id = :assignmentId')
          .setParameter('assignmentId', assignmentId);
      }

      const grades = await query
        .select('grade.final_score', 'score')
        .getRawMany();

      const scores = grades.map((g) => parseFloat(g.score.toString())).sort((a, b) => a - b);

      if (scores.length === 0) {
        return {
          mean: 0,
          median: 0,
          q1: 0,
          q3: 0,
          min: 0,
          max: 0,
          stdDev: 0,
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

      return {
        mean: parseFloat(mean.toFixed(2)),
        median: parseFloat(median.toFixed(2)),
        q1: parseFloat(q1.toFixed(2)),
        q3: parseFloat(q3.toFixed(2)),
        min: parseFloat(scores[0].toFixed(2)),
        max: parseFloat(scores[scores.length - 1].toFixed(2)),
        stdDev: parseFloat(stdDev.toFixed(2)),
      };
    } catch (error) {
      this.logger.error(
        `Failed to calculate grade distribution for course ${courseId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get student progress data with trend analysis
   * Requirement 10.1, 10.4, 10.5, 10.6
   */
  async getStudentProgress(
    courseId: string,
    studentId: string,
    tenantId: string,
  ): Promise<StudentProgressData> {
    try {
      // Get student info
      const student = await this.userRepository.findOneBy({
        id: studentId,
        tenant_id: tenantId,
      });

      if (!student) {
        throw new Error(`Student ${studentId} not found`);
      }

      // Get all assignments for the course
      const assignments = await this.assignmentRepository.find({
        where: {
          course_id: courseId,
          tenant_id: tenantId,
        },
        order: { created_at: 'ASC' },
      });

      // Get submissions and grades for the student
      const submissions = await this.submissionRepository.find({
        where: {
          student_id: studentId,
          tenant_id: tenantId,
        },
        relations: ['grades', 'assignment'],
        order: { assignment: { created_at: 'ASC' } },
      });

      let totalGrade = 0;
      let completedAssignments = 0;
      const gradeTrend: GradeTrendPoint[] = [];

      let assignmentOrder = 0;
      for (const assignment of assignments) {
        assignmentOrder++;
        const submission = submissions.find(
          (s) => s.assignment_id === assignment.id,
        );

        if (submission?.grades?.[0]?.final_score) {
          const grade = submission.grades[0];
          totalGrade += parseFloat(grade.final_score.toString());
          completedAssignments++;

          gradeTrend.push({
            assignmentOrder,
            grade: parseFloat(grade.final_score.toString()),
            submittedAt: submission.submitted_at,
          });
        } else {
          gradeTrend.push({
            assignmentOrder,
            grade: null,
            submittedAt: submission?.submitted_at || new Date(),
          });
        }
      }

      const submissionCompletionRate =
        assignments.length > 0
          ? Math.round((completedAssignments / assignments.length) * 100)
          : 0;
      const averageGrade =
        completedAssignments > 0
          ? parseFloat((totalGrade / completedAssignments).toFixed(2))
          : null;

      return {
        studentId,
        studentName: student.name,
        submissionCompletionRate,
        averageGrade,
        gradeTrend,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get student progress for ${studentId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Identify struggling students below a performance threshold
   * Requirement 10.5
   */
  async getStrugglingStudents(
    courseId: string,
    tenantId: string,
    performanceThreshold: number = 70,
  ): Promise<StudentProgressData[]> {
    try {
      // Get all enrolled students
      const enrollments = await this.enrollmentRepository.find({
        where: {
          course_id: courseId,
          role: 'STUDENT',
        },
        relations: ['user'],
      });

      const strugglingStudents: StudentProgressData[] = [];

      for (const enrollment of enrollments) {
        const progress = await this.getStudentProgress(
          courseId,
          enrollment.user_id,
          tenantId,
        );

        if (
          progress.averageGrade === null ||
          progress.averageGrade < performanceThreshold
        ) {
          strugglingStudents.push(progress);
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
}
