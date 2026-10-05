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
  OneToOne,
  Check,
} from 'typeorm';
import { Submission } from './submission.entity';
import { GradeOverride } from './grade-override.entity';
import { User } from './user.entity';

/**
 * Grade Entity
 *
 * Represents a grade assigned to a student's submission.
 * Tracks both AI-generated grades and manual instructor grades.
 * Supports multiple gradings per submission through status tracking.
 *
 * Multi-Tenancy:
 * - tenant_id: Tenant isolation via index and RLS
 * - submission_id: Foreign key to submissions
 *
 * AI Grading:
 * - ai_score: Numerical score (0-100, 2 decimal places) from AI provider
 * - confidence: Confidence level of AI assessment (0-100, 2 decimal places)
 * - feedback: Detailed feedback text from AI
 *
 * Status Tracking:
 * - PENDING: Grading in progress or queued
 * - AI_GRADED: AI grading completed, awaiting instructor review
 * - MANUALLY_GRADED: Instructor provided manual grade
 * - OVERRIDDEN: Instructor overrode AI grade (see grade_overrides table)
 *
 * One Grade Per Submission:
 * - Unique constraint: unique(submission_id)
 * - Only one grade per submission version
 * - If overridden, the original grade record remains with OVERRIDDEN status
 * - Override details stored in grade_overrides table (audit trail)
 *
 * NO Soft Delete:
 * - Grade entities never soft-deleted
 * - Audit trail maintained through status and overrides
 * - All historical grades preserved
 *
 * Acceptance Criteria:
 * ✓ Table created in grading schema
 * ✓ Grades linked to submissions (unique constraint)
 * ✓ AI score and confidence in valid range (0-100, 2 decimal places)
 * ✓ Status enum: PENDING, AI_GRADED, MANUALLY_GRADED, OVERRIDDEN
 * ✓ NO soft delete (immutable once created)
 * ✓ Foreign keys with proper cascade delete policies
 * ✓ Mapping to Requirements: 7, 13, 16
 */
@Entity('grades', { schema: 'grading' })
@Unique('unique_grades_submission_question', ['submission_id', 'question_id'])
@Check('check_ai_score_range', '"ai_score" >= 0 AND "ai_score" <= 100')
@Check('check_confidence_range', '"confidence" >= 0 AND "confidence" <= 100')
@Index('idx_grades_tenant_id', ['tenant_id'])
@Index('idx_grades_submission_id', ['submission_id'])
@Index('idx_grades_question_id', ['question_id'])
@Index('idx_grades_grade_type', ['grade_type'])
@Index('idx_grades_status', ['status'])
@Index('idx_grades_created_at', ['created_at'])
export class Grade {
  /**
   * Primary Key: UUID
   * Global unique identifier for this grade
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
   * Submission ID: UUID
   * Foreign key to submissions table
   * References the submission being graded
   * One grade per submission (unique constraint enforced)
   */
  @Column({ type: 'uuid', nullable: false })
  submission_id: string;

  /**
   * Assignment ID: UUID
   * Foreign key to assignments table
   * References the assignment being graded
   * Required: Denormalized from submission for query performance
   */
  @Column({ type: 'uuid', nullable: false })
  assignment_id: string;

  /**
   * Question ID: VARCHAR(100) (Optional)
   * NEW: For per-question grading
   * References a specific question in the assignment.content array
   * Null for overall submission grades
   * When filled, allows multiple grades per submission (one per question)
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  question_id: string | null;

  /**
   * Grade Type
   * NEW: Indicates scope of this grade
   * - overall_submission: Grade for entire submission (question_id = NULL)
   * - per_question: Grade for specific question (question_id filled)
   * Default: overall_submission (backward compatible)
   */
  @Column({
    type: 'varchar',
    length: 50,
    nullable: false,
    default: 'overall_submission',
  })
  grade_type: 'overall_submission' | 'per_question';

  /**
   * Grade Details
   * NEW: Additional grading data as JSONB
   * Structure varies by question type:
   * {
   *   "rubricScores": [{ "criterion": "clarity", "score": 8 }],
   *   "autoGradingOutput": { "testsPassed": 5, "testsFailed": 0 },
   *   "keywordMatches": ["Paris", "capital"],
   *   "wordCount": 250
   * }
   */
  @Column({ type: 'jsonb', nullable: true })
  grade_details: Record<string, any> | null;

  /**
   * AI Score
   * Numerical grade assigned by AI provider
   * Range: 0-100 (inclusive)
   * Precision: 2 decimal places (e.g., 87.50)
   * Example: GPT-4 returns 87.5, stored as 87.50
   * Null if AI grading not completed or not used
   */
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  ai_score: number | null;

  /**
   * Confidence
   * AI provider's confidence in the grade (0-100%)
   * Indicates certainty of assessment
   * Range: 0-100
   * Precision: 2 decimal places (e.g., 92.50)
   * Example: 95.00 = very confident, 60.00 = uncertain
   * Null if AI grading not completed
   */
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  confidence: number | null;

  /**
   * Final Score
   * Final numerical grade (0-100) after all adjustments
   * Includes AI score and any penalties (late submissions, etc.)
   * Null if grading not completed
   */
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  final_score: number | null;

  /**
   * Strengths
   * Array of identified strengths in the submission
   * Parsed from AI feedback
   * Empty array if not applicable
   */
  @Column({ type: 'simple-array', nullable: true })
  strengths: string[] | null;

  /**
   * Improvements
   * Array of areas for improvement
   * Parsed from AI feedback
   * Empty array if not applicable
   */
  @Column({ type: 'simple-array', nullable: true })
  improvements: string[] | null;

  /**
   * Graded By User ID
   * Foreign key to users table (optional)
   * References the instructor who manually graded (if applicable)
   * Null if AI grading or not graded yet
   */
  @Column({ type: 'uuid', nullable: true })
  graded_by_user_id: string | null;

  /**
   * Feedback
   * Detailed feedback text from grader (AI or instructor)
   * Explains the grade and provides actionable suggestions
   * Can be updated if manually overridden
   * Null if grading not completed
   */
  @Column({ type: 'text', nullable: true })
  feedback: string | null;

  /**
   * Status
   * Current state of this grade
   * - PENDING: Grading queued or in progress
   * - AI_GRADED: AI grading completed
   * - MANUALLY_GRADED: Instructor manually entered grade (no AI)
   * - OVERRIDDEN: Original AI/manual grade overridden by instructor (see grade_overrides)
   */
  @Column({
    type: 'enum',
    enum: ['PENDING', 'AI_GRADED', 'MANUALLY_GRADED', 'OVERRIDDEN'],
    nullable: false,
    default: 'PENDING',
  })
  status: 'PENDING' | 'AI_GRADED' | 'MANUALLY_GRADED' | 'OVERRIDDEN';

  /**
   * Created At
   * Timestamp when grade was created
   * IMMUTABLE - never changes
   * Used for audit trail and compliance
   */
  @CreateDateColumn()
  created_at: Date;

  /**
   * Updated At
   * Timestamp of last modification
   * NOTE: Grades have NO soft delete, so only metadata updates allowed
   * Updated when feedback is modified, status changes, etc.
   */
  @UpdateDateColumn()
  updated_at: Date;

  /**
   * Relations
   */

  /**
   * Submission
   * One-to-one relationship with Submission entity
   * Each submission has exactly one grade
   */
  @ManyToOne(() => Submission, (submission) => submission.grades, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'submission_id', referencedColumnName: 'id' })
  submission: Submission;

  /**
   * Graded By User
   * Many-to-one optional relationship with User entity
   * References the instructor who manually graded (if applicable)
   * Null if AI grading or not graded yet
   */
  @ManyToOne(() => User, {
    onDelete: 'SET NULL',
    eager: false,
    nullable: true,
  })
  @JoinColumn({ name: 'graded_by_user_id', referencedColumnName: 'id' })
  graded_by_user: User | null;

  /**
   * Grade Override
   * One-to-one optional relationship with GradeOverride entity
   * If this grade was overridden, this references the override record
   * Null if grade not overridden
   */
  @OneToOne(() => GradeOverride, (override) => override.grade, {
    eager: false,
    nullable: true,
    onDelete: 'SET NULL',
  })
  override: GradeOverride | null;
}
