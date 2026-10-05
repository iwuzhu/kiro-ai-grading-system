import { Injectable } from '@nestjs/common';
import { DataSource, Repository, IsNull } from 'typeorm';
import { CourseEnrollment } from '../entities/course-enrollment.entity';

/**
 * Course Enrollment Repository
 *
 * Data access layer for CourseEnrollment entity.
 * Handles all database operations related to course enrollments.
 *
 * Key Responsibilities:
 * - CRUD operations for enrollments
 * - Tenant-scoped queries
 * - Enrollment status queries (active, inactive)
 * - User enrollment lookups by course
 * - Enrollment history
 *
 * Multi-Tenancy Pattern:
 * - All queries filter by tenant_id for isolation
 * - Enrollments are always scoped to a tenant
 * - Unique constraint: unique(course_id, user_id)
 *
 * Acceptance Criteria:
 * ✓ Implements tenant-scoped query methods
 * ✓ Prevents duplicate enrollments via unique constraint
 * ✓ Supports enrollment date tracking
 * ✓ Supports unenrollment tracking
 */
@Injectable()
export class CourseEnrollmentRepository extends Repository<CourseEnrollment> {
  constructor(private dataSource: DataSource) {
    super(CourseEnrollment, dataSource.manager);
  }

  /**
   * Find enrollment by course and user
   * @param tenantId - The tenant ID
   * @param courseId - The course ID
   * @param userId - The user ID
   * @returns Enrollment or null if not found
   */
  async findByCourseAndUser(
    tenantId: string,
    courseId: string,
    userId: string,
  ): Promise<CourseEnrollment | null> {
    return this.findOne({
      where: {
        tenant_id: tenantId,
        course_id: courseId,
        user_id: userId,
      },
      relations: ['course', 'user'],
    });
  }

  /**
   * Find enrollment (alias for findByCourseAndUser)
   * @param tenantId - The tenant ID
   * @param courseId - The course ID
   * @param userId - The user ID
   * @returns Enrollment or null if not found
   */
  async findEnrollment(
    tenantId: string,
    courseId: string,
    userId: string,
  ): Promise<CourseEnrollment | null> {
    return this.findByCourseAndUser(tenantId, courseId, userId);
  }

  /**
   * Find all active enrollments for a course
   * @param tenantId - The tenant ID
   * @param courseId - The course ID
   * @returns Array of active enrollments (not unenrolled)
   */
  async findActiveByCourse(
    tenantId: string,
    courseId: string,
  ): Promise<CourseEnrollment[]> {
    return this.find({
      where: {
        tenant_id: tenantId,
        course_id: courseId,
        unenrolled_at: IsNull(),
      },
      relations: ['user'],
      order: { enrolled_at: 'ASC' as const },
    });
  }

  /**
   * Find all students enrolled in a course
   * @param tenantId - The tenant ID
   * @param courseId - The course ID
   * @returns Array of student enrollments (active only)
   */
  async findStudentsByCourse(
    tenantId: string,
    courseId: string,
  ): Promise<CourseEnrollment[]> {
    return this.find({
      where: {
        tenant_id: tenantId,
        course_id: courseId,
        role: 'STUDENT' as const,
        unenrolled_at: IsNull(),
      },
      relations: ['user'],
      order: { enrolled_at: 'ASC' as const },
    });
  }

  /**
   * Find all instructors enrolled in a course
   * @param tenantId - The tenant ID
   * @param courseId - The course ID
   * @returns Array of instructor enrollments (active only)
   */
  async findInstructorsByCourse(
    tenantId: string,
    courseId: string,
  ): Promise<CourseEnrollment[]> {
    return this.find({
      where: {
        tenant_id: tenantId,
        course_id: courseId,
        role: 'INSTRUCTOR' as const,
        unenrolled_at: IsNull(),
      },
      relations: ['user'],
      order: { enrolled_at: 'ASC' as const },
    });
  }

  /**
   * Find all courses a user is enrolled in
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param activeOnly - Only return active enrollments (default: true)
   * @returns Array of enrollments
   */
  async findByUser(
    tenantId: string,
    userId: string,
    activeOnly: boolean = true,
  ): Promise<CourseEnrollment[]> {
    const query = {
      where: {
        tenant_id: tenantId,
        user_id: userId,
        ...(activeOnly && { unenrolled_at: IsNull() }),
      },
      relations: ['course', 'course.institution'],
      order: { enrolled_at: 'DESC' as const },
    };

    return this.find(query);
  }

  /**
   * Find courses where user is an instructor
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param activeOnly - Only return active enrollments (default: true)
   * @returns Array of course enrollments
   */
  async findInstructorCourses(
    tenantId: string,
    userId: string,
    activeOnly: boolean = true,
  ): Promise<CourseEnrollment[]> {
    const query = {
      where: {
        tenant_id: tenantId,
        user_id: userId,
        role: 'INSTRUCTOR' as const,
        ...(activeOnly && { unenrolled_at: IsNull() }),
      },
      relations: ['course', 'course.institution'],
      order: { enrolled_at: 'DESC' as const },
    };

    return this.find(query);
  }

  /**
   * Find courses where user is a student
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param activeOnly - Only return active enrollments (default: true)
   * @returns Array of course enrollments
   */
  async findStudentCourses(
    tenantId: string,
    userId: string,
    activeOnly: boolean = true,
  ): Promise<CourseEnrollment[]> {
    const query = {
      where: {
        tenant_id: tenantId,
        user_id: userId,
        role: 'STUDENT' as const,
        ...(activeOnly && { unenrolled_at: IsNull() }),
      },
      relations: ['course', 'course.institution'],
      order: { enrolled_at: 'DESC' as const },
    };

    return this.find(query);
  }

  /**
   * Create a new enrollment
   * @param data - Enrollment creation data
   * @returns Created enrollment
   */
  async createEnrollment(data: {
    tenant_id: string;
    course_id: string;
    user_id: string;
    role: 'INSTRUCTOR' | 'STUDENT';
  }): Promise<CourseEnrollment> {
    const enrollment = this.create({
      tenant_id: data.tenant_id,
      course_id: data.course_id,
      user_id: data.user_id,
      role: data.role,
      enrolled_at: new Date(),
      unenrolled_at: null,
    });

    return this.save(enrollment);
  }

  /**
   * Update enrollment role
   * @param tenantId - Tenant ID
   * @param courseId - Course ID
   * @param userId - User ID
   * @param role - New role
   * @returns Updated enrollment
   */
  async updateRole(
    tenantId: string,
    courseId: string,
    userId: string,
    role: 'INSTRUCTOR' | 'STUDENT',
  ): Promise<CourseEnrollment | null> {
    const enrollment = await this.findByCourseAndUser(
      tenantId,
      courseId,
      userId,
    );
    if (!enrollment) {
      return null;
    }

    enrollment.role = role;
    return this.save(enrollment);
  }

  /**
   * Unenroll user from course
   * @param tenantId - Tenant ID
   * @param courseId - Course ID
   * @param userId - User ID
   * @returns Updated enrollment
   */
  async unenroll(
    tenantId: string,
    courseId: string,
    userId: string,
  ): Promise<CourseEnrollment | null> {
    const enrollment = await this.findByCourseAndUser(
      tenantId,
      courseId,
      userId,
    );
    if (!enrollment) {
      return null;
    }

    enrollment.unenrolled_at = new Date();
    return this.save(enrollment);
  }

  /**
   * Re-enroll user in course (after unenrollment)
   * @param tenantId - Tenant ID
   * @param courseId - Course ID
   * @param userId - User ID
   * @returns Updated enrollment
   */
  async reenroll(
    tenantId: string,
    courseId: string,
    userId: string,
  ): Promise<CourseEnrollment | null> {
    const enrollment = await this.findByCourseAndUser(
      tenantId,
      courseId,
      userId,
    );
    if (!enrollment) {
      return null;
    }

    enrollment.unenrolled_at = null;
    return this.save(enrollment);
  }

  /**
   * Get enrollment count for a course (active only)
   * @param tenantId - Tenant ID
   * @param courseId - Course ID
   * @returns Enrollment count
   */
  async getEnrollmentCount(tenantId: string, courseId: string): Promise<number> {
    return this.count({
      where: {
        tenant_id: tenantId,
        course_id: courseId,
        unenrolled_at: IsNull(),
      },
    });
  }

  /**
   * Get student count for a course (active only)
   * @param tenantId - Tenant ID
   * @param courseId - Course ID
   * @returns Student count
   */
  async getStudentCount(tenantId: string, courseId: string): Promise<number> {
    return this.count({
      where: {
        tenant_id: tenantId,
        course_id: courseId,
        role: 'STUDENT',
        unenrolled_at: IsNull(),
      },
    });
  }

  /**
   * Get instructor count for a course (active only)
   * @param tenantId - Tenant ID
   * @param courseId - Course ID
   * @returns Instructor count
   */
  async getInstructorCount(tenantId: string, courseId: string): Promise<number> {
    return this.count({
      where: {
        tenant_id: tenantId,
        course_id: courseId,
        role: 'INSTRUCTOR',
        unenrolled_at: IsNull(),
      },
    });
  }

  /**
   * Find active enrollments by role in a course
   * @param tenantId - Tenant ID
   * @param courseId - Course ID
   * @param role - Role to filter by
   * @returns Array of enrollments
   */
  async findActiveByRole(
    tenantId: string,
    courseId: string,
    role: 'INSTRUCTOR' | 'STUDENT',
  ): Promise<CourseEnrollment[]> {
    return this.find({
      where: {
        tenant_id: tenantId,
        course_id: courseId,
        role: role,
        unenrolled_at: IsNull(),
      },
      relations: ['user'],
      order: { enrolled_at: 'ASC' as const },
    });
  }

  /**
   * Find all courses for a user with active enrollments
   * @param tenantId - Tenant ID
   * @param userId - User ID
   * @returns Array of course enrollments
   */
  async findCoursesForUser(
    tenantId: string,
    userId: string,
  ): Promise<CourseEnrollment[]> {
    return this.find({
      where: {
        tenant_id: tenantId,
        user_id: userId,
        unenrolled_at: IsNull(),
      },
      relations: ['course', 'course.institution'],
      order: { enrolled_at: 'DESC' as const },
    });
  }
}
