import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  Unique,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Institution } from './institution.entity';
import { User } from './user.entity';
import { CourseEnrollment } from './course-enrollment.entity';

/**
 * Course Entity
 *
 * Represents a course within an institution.
 * Courses contain assignments and student enrollments.
 *
 * Multi-Tenancy:
 * - tenant_id: Tenant isolation via unique constraint (tenant_id, code)
 * - institution_id: Foreign key to institutions table
 *
 * Course Management:
 * - code: Tenant-unique course code (e.g., 'CS101')
 * - status: Lifecycle state (DRAFT, ACTIVE, ARCHIVED)
 * - semester dates: Optional academic period
 *
 * Acceptance Criteria:
 * ✓ Table created in grading schema
 * ✓ Tenant-unique course code: unique(tenant_id, code)
 * ✓ Status enumeration: DRAFT, ACTIVE, ARCHIVED
 * ✓ Foreign key to institutions with cascade delete
 * ✓ Foreign key to users (created_by_user_id)
 * ✓ Semester date tracking
 * ✓ Soft delete support
 */
@Entity('courses', { schema: 'grading' })
@Unique('unique_course_code', ['tenant_id', 'code'])
@Index('idx_courses_tenant_id', ['tenant_id'])
@Index('idx_courses_institution_id', ['institution_id'])
@Index('idx_courses_created_by_user_id', ['created_by_user_id'])
@Index('idx_courses_status', ['status'])
export class Course {
  /**
   * Primary Key: UUID
   * Global unique identifier for this course
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
   * Institution ID: UUID
   * Foreign key to institutions table
   * References the institution this course belongs to
   */
  @Column({ type: 'uuid', nullable: false })
  institution_id: string;

  /**
   * Course Code
   * Unique course identifier within tenant (e.g., 'CS101', 'MATH201')
   * Tenant-unique to support multiple institutions with same course codes
   */
  @Column({ type: 'varchar', length: 50, nullable: false })
  code: string;

  /**
   * Course Title
   * Display name for the course (e.g., 'Introduction to Computer Science')
   */
  @Column({ type: 'varchar', length: 255, nullable: false })
  title: string;

  /**
   * Course Description
   * Long-form description of course content and objectives
   * Optional field for detailed course information
   */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  /**
   * Created By User ID: UUID
   * Foreign key to users table
   * References the instructor who created this course
   * Can be NULL if course was created by system
   */
  @Column({ type: 'uuid', nullable: true })
  created_by_user_id: string | null;

  /**
   * Status
   * Course lifecycle state
   * - DRAFT: Course is being set up, not visible to students
   * - ACTIVE: Course is currently running, visible and accepting enrollments
   * - ARCHIVED: Course is finished, students can view but not submit new work
   */
  @Column({
    type: 'enum',
    enum: ['DRAFT', 'ACTIVE', 'ARCHIVED'],
    nullable: false,
    default: 'DRAFT',
  })
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

  /**
   * Semester Start Date
   * Optional: Academic period start date
   * Format: ISO 8601 date (YYYY-MM-DD)
   */
  @Column({ type: 'date', nullable: true })
  semester_start: Date | null;

  /**
   * Semester End Date
   * Optional: Academic period end date
   * Format: ISO 8601 date (YYYY-MM-DD)
   * Constraint: Must be >= semester_start if both are provided
   */
  @Column({ type: 'date', nullable: true })
  semester_end: Date | null;

  /**
   * Created At
   * Timestamp when course was created
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
   * Deleted At
   * Soft delete timestamp (null = active)
   * Supports archival without losing historical data
   */
  @DeleteDateColumn({ nullable: true })
  deleted_at: Date | null;

  /**
   * Relations
   */

  /**
   * Institution
   * Many-to-one relationship with Institution entity
   */
  @ManyToOne(() => Institution, (institution) => institution.courses, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'institution_id', referencedColumnName: 'id' })
  institution: Institution;

  /**
   * Created By User
   * Many-to-one relationship with User entity
   * References the instructor who created the course
   * Can be null if course was created by system
   */
  @ManyToOne(() => User, (user) => user.courses_created, {
    onDelete: 'SET NULL',
    eager: false,
    nullable: true,
  })
  @JoinColumn({ name: 'created_by_user_id', referencedColumnName: 'id' })
  created_by_user: User | null;

  /**
   * Enrollments
   * One-to-many relationship with CourseEnrollment entity
   * All students and instructors enrolled in this course
   */
  @OneToMany(() => CourseEnrollment, (enrollment) => enrollment.course, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  enrollments: CourseEnrollment[];
}
