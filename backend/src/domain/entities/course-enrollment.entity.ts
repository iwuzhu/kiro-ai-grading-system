import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Course } from './course.entity';
import { User } from './user.entity';

/**
 * Course Enrollment Entity
 *
 * Represents the relationship between a user and a course.
 * Tracks enrollment status, role (instructor vs student), and enrollment dates.
 *
 * Multi-Tenancy:
 * - tenant_id: Tenant isolation
 * - Enrollments are always scoped to a specific tenant and institution
 *
 * Enrollment Lifecycle:
 * - enrolled_at: When user joined the course
 * - unenrolled_at: When user left the course (null = still enrolled)
 *
 * Acceptance Criteria:
 * ✓ Table created in grading schema
 * ✓ Unique constraint: unique(course_id, user_id) - prevent duplicate enrollment
 * ✓ Role enumeration: INSTRUCTOR, STUDENT
 * ✓ Enrollment date tracking
 * ✓ Unenrollment date tracking (optional)
 * ✓ Foreign keys to courses and users with cascade delete
 */
@Entity('course_enrollments', { schema: 'grading' })
@Unique('unique_course_user_enrollment', ['course_id', 'user_id'])
@Index('idx_enrollments_tenant_id', ['tenant_id'])
@Index('idx_enrollments_course_id', ['course_id'])
@Index('idx_enrollments_user_id', ['user_id'])
@Index('idx_enrollments_role', ['role'])
@Index('idx_enrollments_active', ['unenrolled_at'], {
  where: 'unenrolled_at IS NULL',
})
export class CourseEnrollment {
  /**
   * Primary Key: UUID
   * Global unique identifier for this enrollment
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Tenant ID: UUID
   * Logical tenant identifier
   * Used for Row-Level Security policies and multi-tenancy isolation
   */
  @Column({ type: 'uuid', nullable: false })
  tenant_id: string;

  /**
   * Course ID: UUID
   * Foreign key to courses table
   * References the course this user is enrolled in
   */
  @Column({ type: 'uuid', nullable: false })
  course_id: string;

  /**
   * User ID: UUID
   * Foreign key to users table
   * References the user who is enrolled
   */
  @Column({ type: 'uuid', nullable: false })
  user_id: string;

  /**
   * Role
   * User's role in this specific course enrollment
   * - INSTRUCTOR: Course instructor, can grade and view all submissions
   * - STUDENT: Student, can submit work and view feedback
   * Note: This may differ from user.role for cross-institution instructors
   */
  @Column({
    type: 'enum',
    enum: ['INSTRUCTOR', 'STUDENT'],
    nullable: false,
    default: 'STUDENT',
  })
  role: 'INSTRUCTOR' | 'STUDENT';

  /**
   * Enrolled At
   * Timestamp when user enrolled in course
   * System-generated timestamp of enrollment
   */
  @CreateDateColumn()
  enrolled_at: Date;

  /**
   * Unenrolled At
   * Timestamp when user unenrolled from course
   * Null = user is currently enrolled
   * When populated = user has dropped or been removed from course
   */
  @Column({ type: 'timestamp', nullable: true })
  unenrolled_at: Date | null;

  /**
   * Created At
   * Timestamp when enrollment record was created
   */
  @CreateDateColumn()
  created_at: Date;

  /**
   * Updated At
   * Timestamp of last modification
   */
  @UpdateDateColumn()
  updated_at: Date;

  /**
   * Relations
   */

  /**
   * Course
   * Many-to-one relationship with Course entity
   */
  @ManyToOne(() => Course, (course) => course.enrollments, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'course_id', referencedColumnName: 'id' })
  course: Course;

  /**
   * User
   * Many-to-one relationship with User entity
   */
  @ManyToOne(() => User, (user) => user.enrollments, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  user: User;
}
