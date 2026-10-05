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
import { Assignment } from './assignment.entity';
import { User } from './user.entity';
import { Grade } from './grade.entity';
import { PlagiarismFlag } from './plagiarism-flag.entity';
import { PlagiarismResult } from './plagiarism-result.entity';

/**
 * Submission Entity
 *
 * Represents a student submission for an assignment.
 * Supports incremental/versioned submissions (multiple submission versions per student per assignment).
 * Each submission version tracked separately with own timestamp and metadata.
 *
 * Multi-Tenancy:
 * - tenant_id: Tenant isolation via index and RLS
 * - assignment_id, student_id: Identify submission
 *
 * Versioning Support:
 * - version: Incremental counter for each submission by same student on same assignment
 * - Constraint: unique(assignment_id, student_id, version)
 * - First submission has version=1, second version=2, etc.
 * - Enables incremental submission workflow with separate grading per version
 *
 * Late Submission Tracking:
 * - is_late: Boolean flag set based on soft/hard deadline comparison
 * - submitted_at: Immutable timestamp of submission (set at creation)
 *
 * File Storage:
 * - file_path: S3 path or URL to submitted file
 * - file_type: File extension (pdf, docx, py, js, etc.)
 * - Example: s3://bucket/tenant_id/assignment_id/student_id/version1.pdf
 *
 * Acceptance Criteria:
 * ✓ Table created in grading schema
 * ✓ All tables have tenant_id, timestamps, soft delete support
 * ✓ Submission versioning supported (version counter)
 * ✓ Unique constraint: unique(assignment_id, student_id, version)
 * ✓ submitted_at immutable after creation
 * ✓ is_late calculated and set at submission time
 * ✓ Foreign keys with proper cascade delete policies
 * ✓ Mapping to Requirements: 6, 12, 16
 */
@Entity('submissions', { schema: 'grading' })
@Unique('unique_submission_version', ['assignment_id', 'student_id', 'version'])
@Check('check_version_positive', '"version" > 0')
@Index('idx_submissions_tenant_id', ['tenant_id'])
@Index('idx_submissions_assignment_id', ['assignment_id'])
@Index('idx_submissions_student_id', ['student_id'])
@Index('idx_submissions_assignment_student', ['assignment_id', 'student_id'])
@Index('idx_submissions_created_at', ['created_at'])
@Index('idx_submissions_submitted_at', ['submitted_at'])
@Index('idx_submissions_is_late', ['is_late'])
export class Submission {
  /**
   * Primary Key: UUID
   * Global unique identifier for this submission
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
   * Assignment ID: UUID
   * Foreign key to assignments table
   * References the assignment this submission is for
   */
  @Column({ type: 'uuid', nullable: false })
  assignment_id: string;

  /**
   * Student ID: UUID
   * Foreign key to users table
   * References the student who submitted the work
   */
  @Column({ type: 'uuid', nullable: false })
  student_id: string;

  /**
   * Version
   * Incremental version number for this student's submissions
   * - First submission: version = 1
   * - Second submission (if incremental): version = 2
   * - Unique within (assignment_id, student_id)
   * - Enables tracking of submission history
   */
  @Column({ type: 'integer', nullable: false, default: 1 })
  version: number;

  /**
   * Is Incremental
   * Flag indicating if this is an incremental (non-final) submission
   * - true: Incremental submission before final deadline (gets preliminary grade)
   * - false: Final submission (gets graded for record)
   * Default: false
   */
  @Column({ type: 'boolean', nullable: false, default: false })
  is_incremental: boolean;

  /**
   * File Path
   * S3 path or URL to the submitted file
   * Format: s3://bucket/tenant_id/assignment_id/student_id/v1.pdf
   * Supports both S3 URIs and HTTP/HTTPS URLs
   * Null for quiz-type submissions (inline content)
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  file_path: string | null;

  /**
   * File Type
   * File extension indicating the file format
   * Examples: pdf, docx, txt, py, js, java, cpp
   * Used for validation and routing to appropriate AI provider
   * Null for submissions without files
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  file_type: string | null;

  /**
   * Content: JSONB Object with Answers Array
   * 
   * NEW: Replaces old TEXT content field with JSONB structure
   * 
   * Structure:
   * {
   *   "answers": [
   *     {
   *       "questionId": "q-1",
   *       "type": "MULTIPLE_CHOICE",
   *       "answer": "B",  // Type depends on question type
   *       "files": [],    // For file-based questions
   *       "submittedAt": "2024-10-01T12:30:00Z"
   *     },
   *     {
   *       "questionId": "q-2",
   *       "type": "ESSAY",
   *       "answer": "Long essay text here...",
   *       "submittedAt": "2024-10-01T12:30:00Z"
   *     }
   *   ],
   *   "startedAt": "2024-10-01T12:00:00Z",
   *   "completedAt": "2024-10-01T12:30:00Z"
   * }
   * 
   * Allows multiple answers per submission (one per question)
   * Stores files as S3 URIs rather than inline
   */
  @Column({
    type: 'jsonb',
    nullable: false,
    default: () => "'{\"answers\": []}'::jsonb",
  })
  content: Record<string, any>;

  /**
   * Answer Status
   * NEW: Tracks submission progress state
   * - in_progress: Student is still answering questions
   * - submitted: All answers submitted, ready for grading
   * - graded: Grading completed
   */
  @Column({
    type: 'varchar',
    length: 50,
    nullable: false,
    default: 'submitted',
  })
  answer_status: 'in_progress' | 'submitted' | 'graded';

  /**
   * Question Count
   * NEW: Cached count of answered questions for performance
   * Dynamically calculated from content.answers.length
   */
  @Column({ type: 'integer', nullable: false, default: 0 })
  question_count: number;

  /**
   * Is Late
   * Flag indicating if this submission was submitted after soft deadline
   * - true: Submitted after soft_deadline (late penalty applies)
   * - false: Submitted before or at soft_deadline
   * Set at submission time based on current timestamp vs assignment deadlines
   */
  @Column({ type: 'boolean', nullable: false, default: false })
  is_late: boolean;

  /**
   * Submitted At
   * IMMUTABLE timestamp of submission (set at creation, cannot change)
   * Used for:
   * - Late determination (comparison with soft_deadline)
   * - Audit trail verification
   * - Deadline compliance confirmation
   * Set once at submission creation, never updated
   */
  @Column({
    type: 'timestamp with time zone',
    nullable: false,
    update: false,
  })
  submitted_at: Date;

  /**
   * Created At
   * Timestamp when submission record was created
   * Note: Same as submitted_at for most cases, but distinct for clarity
   */
  @CreateDateColumn()
  created_at: Date;

  /**
   * Updated At
   * Timestamp of last modification
   * Updated when grading status changes, etc.
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
   * Assignment
   * Many-to-one relationship with Assignment entity
   */
  @ManyToOne(() => Assignment, (assignment) => assignment.submissions, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'assignment_id', referencedColumnName: 'id' })
  assignment: Assignment;

  /**
   * Student
   * Many-to-one relationship with User entity
   * References the student who submitted the work
   */
  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'student_id', referencedColumnName: 'id' })
  student: User;

  /**
   * Grades
   * One-to-many relationship with Grade entity
   * One or more grades for this submission version
   * Initial version typically has one grade per grader
   */
  @OneToMany(() => Grade, (grade) => grade.submission, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  grades: Grade[];

  /**
   * Plagiarism Flags
   * One-to-many relationship with PlagiarismFlag entity
   * Tracks investigation flags for this submission
   */
  @OneToMany(
    () => PlagiarismFlag,
    (plagiarismFlag) => plagiarismFlag.submission,
    {
      cascade: true,
      onDelete: 'CASCADE',
    },
  )
  plagiarism_flags: PlagiarismFlag[];

  /**
   * Plagiarism Results
   * One-to-many relationship with PlagiarismResult entity
   * Plagiarism scan results for this submission
   */
  @OneToMany(
    () => PlagiarismResult,
    (result) => result.submission,
    {
      cascade: true,
      onDelete: 'CASCADE',
    },
  )
  plagiarism_results: PlagiarismResult[];
}
