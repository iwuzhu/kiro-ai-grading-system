import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { CourseEnrollmentRepository } from '../repositories/course-enrollment.repository';
import { CourseRepository } from '../repositories/course.repository';
import { UserRepository } from '../repositories/user.repository';

/**
 * Course Enrollment Service
 *
 * Orchestrates student enrollment workflows including:
 * - Individual student enrollment
 * - Bulk CSV enrollment
 * - Enrollment removal with history preservation
 * - Enrollment status queries
 *
 * Acceptance Criteria:
 * ✓ Individual student enrollment by email
 * ✓ Bulk CSV import with validation
 * ✓ Enrollment removal preserves submission history
 * ✓ Enrolled students see course in list
 * ✓ History preserved for compliance
 */
@Injectable()
export class CourseEnrollmentService {
  constructor(
    private readonly enrollmentRepository: CourseEnrollmentRepository,
    private readonly courseRepository: CourseRepository,
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Enroll a single student by email
   * @param tenantId - Tenant ID
   * @param courseId - Course ID
   * @param studentEmail - Student email
   * @returns Enrollment record
   */
  async enrollStudentByEmail(
    tenantId: string,
    courseId: string,
    studentEmail: string,
  ): Promise<any> {
    // Find student by email
    const student = await this.userRepository.findByEmail(tenantId, studentEmail);
    if (!student) {
      throw new NotFoundException(
        `Student with email "${studentEmail}" not found in this institution`,
      );
    }

    // Enroll the student by ID
    return this.enrollStudent(tenantId, courseId, student.id);
  }

  /**
   * Enroll a single student in a course
   * @param tenantId - Tenant ID
   * @param courseId - Course ID
   * @param studentId - Student user ID
   * @returns Enrollment record
   */
  async enrollStudent(
    tenantId: string,
    courseId: string,
    studentId: string,
  ): Promise<any> {
    // Verify course exists and belongs to tenant
    const course = await this.courseRepository.findById(tenantId, courseId);
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Verify user exists and belongs to tenant
    const user = await this.userRepository.findById(tenantId, studentId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== 'STUDENT' && user.role !== 'INSTRUCTOR') {
      throw new BadRequestException(
        'Only students and instructors can be enrolled',
      );
    }

    // Check if already enrolled
    const existing = await this.enrollmentRepository.findEnrollment(
      tenantId,
      courseId,
      studentId,
    );

    if (existing && !existing.unenrolled_at) {
      throw new BadRequestException('User already enrolled in course');
    }

    // Create or update enrollment
    const enrollment = await this.enrollmentRepository.createEnrollment({
      tenant_id: tenantId,
      course_id: courseId,
      user_id: studentId,
      role: user.role as 'INSTRUCTOR' | 'STUDENT',
    });

    return enrollment;
  }

  /**
   * Enroll students from CSV
   * @param tenantId - Tenant ID
   * @param courseId - Course ID
   * @param csvData - Array of {email} or {email, role}
   * @returns Object with successes and failures
   */
  async enrollStudentsFromCSV(
    tenantId: string,
    courseId: string,
    csvData: Array<{ email: string; role?: string }>,
  ): Promise<{
    enrolled: number;
    failed: Array<{ email: string; reason: string }>;
  }> {
    const results = {
      enrolled: 0,
      failed: [] as Array<{ email: string; reason: string }>,
    };

    // Verify course exists
    const course = await this.courseRepository.findById(tenantId, courseId);
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    for (const row of csvData) {
      const { email, role } = row;

      // Validate email
      if (!email || !this.isValidEmail(email)) {
        results.failed.push({
          email: email || '(empty)',
          reason: 'Invalid email format',
        });
        continue;
      }

      try {
        // Find user by email
        const user = await this.userRepository.findByEmail(tenantId, email);
        if (!user) {
          results.failed.push({
            email,
            reason: 'User not found in institution',
          });
          continue;
        }

        // Enroll user
        await this.enrollStudent(tenantId, courseId, user.id);
        results.enrolled++;
      } catch (error) {
        results.failed.push({
          email,
          reason: error.message || 'Enrollment failed',
        });
      }
    }

    return results;
  }

  /**
   * Remove a student from a course
   * Preserves enrollment history and submission history
   * @param tenantId - Tenant ID
   * @param courseId - Course ID
   * @param studentId - Student user ID
   * @returns Updated enrollment
   */
  async unenrollStudent(
    tenantId: string,
    courseId: string,
    studentId: string,
  ): Promise<any> {
    // Verify course exists
    const course = await this.courseRepository.findById(tenantId, courseId);
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Find enrollment
    const enrollment = await this.enrollmentRepository.findEnrollment(
      tenantId,
      courseId,
      studentId,
    );

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    if (enrollment.unenrolled_at) {
      throw new BadRequestException('User is already unenrolled');
    }

    // Mark as unenrolled (soft delete, preserves history)
    enrollment.unenrolled_at = new Date();
    return this.enrollmentRepository.save(enrollment);
  }

  /**
   * Get all enrolled students in a course
   * @param tenantId - Tenant ID
   * @param courseId - Course ID
   * @returns Array of active enrollments
   */
  async getEnrolledStudents(
    tenantId: string,
    courseId: string,
  ): Promise<any[]> {
    return this.enrollmentRepository.findActiveByRole(
      tenantId,
      courseId,
      'STUDENT',
    );
  }

  /**
   * Get all enrolled instructors in a course
   * @param tenantId - Tenant ID
   * @param courseId - Course ID
   * @returns Array of instructor enrollments
   */
  async getEnrolledInstructors(
    tenantId: string,
    courseId: string,
  ): Promise<any[]> {
    return this.enrollmentRepository.findActiveByRole(
      tenantId,
      courseId,
      'INSTRUCTOR',
    );
  }

  /**
   * Check if user is enrolled in course
   * @param tenantId - Tenant ID
   * @param courseId - Course ID
   * @param userId - User ID
   * @returns true if actively enrolled
   */
  async isEnrolled(
    tenantId: string,
    courseId: string,
    userId: string,
  ): Promise<boolean> {
    const enrollment = await this.enrollmentRepository.findEnrollment(
      tenantId,
      courseId,
      userId,
    );

    return !!enrollment && !enrollment.unenrolled_at;
  }

  /**
   * Get enrollment role
   * @param tenantId - Tenant ID
   * @param courseId - Course ID
   * @param userId - User ID
   * @returns Role if enrolled, null otherwise
   */
  async getEnrollmentRole(
    tenantId: string,
    courseId: string,
    userId: string,
  ): Promise<'STUDENT' | 'INSTRUCTOR' | null> {
    const enrollment = await this.enrollmentRepository.findEnrollment(
      tenantId,
      courseId,
      userId,
    );

    if (!enrollment || enrollment.unenrolled_at) {
      return null;
    }

    return enrollment.role;
  }

  /**
   * Get courses for a student
   * @param tenantId - Tenant ID
   * @param studentId - Student user ID
   * @returns Array of enrolled courses
   */
  async getStudentCourses(
    tenantId: string,
    studentId: string,
  ): Promise<any[]> {
    return this.enrollmentRepository.findCoursesForUser(
      tenantId,
      studentId,
    );
  }

  /**
   * Get courses for an instructor (owned or co-taught)
   * @param tenantId - Tenant ID
   * @param instructorId - Instructor user ID
   * @returns Array of courses
   */
  async getInstructorCourses(
    tenantId: string,
    instructorId: string,
  ): Promise<any[]> {
    return this.enrollmentRepository.findCoursesForUser(
      tenantId,
      instructorId,
    );
  }

  /**
   * Validate email format
   * @param email - Email address
   * @returns true if valid email
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
