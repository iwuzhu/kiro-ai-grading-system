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
  Check,
} from 'typeorm';
import { Course } from './course.entity';
import { User } from './user.entity';
import { Rubric } from './rubric.entity';
import { Submission } from './submission.entity';
import { PlagiarismResult } from './plagiarism-result.entity';

/**
 * Assignment Entity
 *
 * Represents an assignment or task assigned to students within a course.
 * Supports multiple assignment types (essay, code, quiz, short-answer, file).
 * Optional rubric attachment for structured grading.
 *
 * Multi-Tenancy:
 * - tenant_id: Tenant isolation via unique constraint (tenant_id, course_id, title)
 * - course_id: Foreign key to courses table
 *
 * Deadlines:
 * - soft_deadline: Submission accepted with late penalty after this date
 * - hard_deadline: Submission rejected after this date
 * - Constraint: soft_deadline < hard_deadline
 *
 * Late Penalties:
 * - late_penalty_percent: Percentage deduction for late submissions (0-100)
 * - Default: 0 (no penalty)
 *
 * Incremental Submissions:
 * - allow_incremental: If true, students can submit multiple versions before deadline
 * - Each version graded separately if AI grading enabled
 *
 * Acceptance Criteria:
 * ✓ Table created in grading schema
 * ✓ All tables have tenant_id, timestamps, soft delete support
 * ✓ Assignment type enum: ESSAY, CODE, QUIZ, SHORT_ANSWER, FILE
 * ✓ Rubric support optional (rubric_id can be NULL)
 * ✓ Unique constraint: unique(tenant_id, course_id, title)
 * ✓ Deadline constraint: soft_deadline < hard_deadline
 * ✓ Late penalty validated: 0-100
 * ✓ Foreign keys with proper cascade delete policies
 * ✓ Mapping to Requirements: 5, 6, 7, 13, 16
 */
@Entity('assignments', { schema: 'grading' })
@Unique('unique_assignment_course_title', ['tenant_id', 'course_id', 'title'])
@Check('check_soft_deadline_before_hard', '"soft_deadline" < "hard_deadline"')
@Check('check_late_penalty_range', '"late_penalty_percent" >= 0 AND "late_penalty_percent" <= 100')
@Index('idx_assignments_tenant_id', ['tenant_id'])
@Index('idx_assignments_course_id', ['course_id'])
@Index('idx_assignments_rubric_id', ['rubric_id'])
@Index('idx_assignments_created_by_user_id', ['created_by_user_id'])
@Index('idx_assignments_created_at', ['created_at'])
export class Assignment {
  /**
   * Primary Key: UUID
   * Global unique identifier for this assignment
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
   * References the course this assignment belongs to
   */
  @Column({ type: 'uuid', nullable: false })
  course_id: string;

  /**
   * Rubric ID: UUID (Optional)
   * Foreign key to rubrics table
   * References the rubric used for grading
   * Null if no rubric is attached (free-form grading)
   */
  @Column({ type: 'uuid', nullable: true })
  rubric_id: string | null;

  /**
   * Title
   * Assignment name/title (e.g., 'Midterm Essay', 'Final Project')
   * Unique within tenant + course
   */
  @Column({ type: 'varchar', length: 255, nullable: false })
  title: string;

  /**
   * Description
   * Long-form assignment description
   * Instructions, requirements, grading criteria
   */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  /**
   * Point Value
   * Maximum points this assignment is worth
   * Used for grade scaling and reporting
   */
  @Column({
    type: 'decimal',
    precision: 8,
    scale: 2,
    nullable: true,
  })
  point_value: number | null;

  /**
   * Type
   * Assignment submission type
   * - ESSAY: Written essay/prose submission
   * - CODE: Source code submission
   * - QUIZ: Multiple choice or short answer quiz
   * - SHORT_ANSWER: Brief written response
   * - FILE: Generic file upload (PDF, document, etc.)
   */
  @Column({
    type: 'enum',
    enum: ['ESSAY', 'CODE', 'QUIZ', 'SHORT_ANSWER', 'FILE'],
    nullable: false,
    default: 'ESSAY',
  })
  type: 'ESSAY' | 'CODE' | 'QUIZ' | 'SHORT_ANSWER' | 'FILE';

  /**
   * Allow Incremental
   * If true, students can submit multiple versions before deadline
   * Each version tracked separately and graded independently
   * Default: false (only one submission per student)
   */
  @Column({ type: 'boolean', nullable: false, default: false })
  allow_incremental: boolean;

  /**
   * Soft Deadline
   * Submission after this date flagged as late
   * Late penalty applied if configured
   * Must be before hard_deadline
   */
  @Column({ type: 'timestamp with time zone', nullable: true })
  soft_deadline: Date | null;

  /**
   * Hard Deadline
   * Submission after this date rejected
   * No submissions accepted after this timestamp
   * Must be after soft_deadline if both are set
   */
  @Column({ type: 'timestamp with time zone', nullable: true })
  hard_deadline: Date | null;

  /**
   * Published At
   * Timestamp when assignment was published to students
   * Null if unpublished (draft state)
   */
  @Column({ type: 'timestamp with time zone', nullable: true })
  published_at: Date | null;

  /**
   * Published By User ID
   * Foreign key to users table
   * References the user who published the assignment
   * Null if unpublished
   */
  @Column({ type: 'uuid', nullable: true })
  published_by_user_id: string | null;

  /**
   * Late Penalty Percent
   * Percentage deduction for late submissions
   * Range: 0-100
   * Example: 10 = 10 points deducted per submission after soft deadline
   * Default: 0 (no penalty)
   */
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: false,
    default: 0,
  })
  late_penalty_percent: number;

  /**
   * Created By User ID: UUID
   * Foreign key to users table
   * References the instructor who created this assignment
   */
  @Column({ type: 'uuid', nullable: false })
  created_by_user_id: string;

  /**
   * Created At
   * Timestamp when assignment was created
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
   * Course
   * Many-to-one relationship with Course entity
   */
  @ManyToOne(() => Course, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'course_id', referencedColumnName: 'id' })
  course: Course;

  /**
   * Rubric
   * Many-to-one relationship with Rubric entity
   * Optional: can be NULL for unstructured grading
   */
  @ManyToOne(() => Rubric, {
    onDelete: 'SET NULL',
    eager: false,
    nullable: true,
  })
  @JoinColumn({ name: 'rubric_id', referencedColumnName: 'id' })
  rubric: Rubric | null;

  /**
   * Created By User
   * Many-to-one relationship with User entity
   * References the instructor who created the assignment
   */
  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'created_by_user_id', referencedColumnName: 'id' })
  created_by_user: User;

  /**
   * Submissions
   * One-to-many relationship with Submission entity
   * All student submissions for this assignment
   */
  @OneToMany(() => Submission, (submission) => submission.assignment, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  submissions: Submission[];

  /**
   * Plagiarism Results
   * One-to-many relationship with PlagiarismResult entity
   * Plagiarism scan results for all submissions of this assignment
   */
  @OneToMany(
    () => PlagiarismResult,
    (plagiarismResult) => plagiarismResult.assignment,
    {
      cascade: true,
      onDelete: 'CASCADE',
    },
  )
  plagiarism_results: PlagiarismResult[];
}
