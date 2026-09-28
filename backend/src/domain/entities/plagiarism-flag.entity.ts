import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Institution } from './institution.entity';
import { Submission } from './submission.entity';
import { PlagiarismResult } from './plagiarism-result.entity';
import { User } from './user.entity';

/**
 * PlagiarismFlag Entity
 *
 * Represents an investigation flag for a plagiarism concern.
 * Tracks the investigation workflow, actions taken, and resolution status.
 *
 * Multi-Tenancy:
 * - tenant_id: Tenant isolation via index
 * - institution_id: Foreign key to institutions table
 *
 * Investigation Workflow:
 * - status: Tracks state (FLAGGED, INVESTIGATING, RESOLVED, FALSE_POSITIVE)
 * - flagged_by_user_id: Instructor who flagged the submission
 * - investigation_notes: Details of the investigation
 * - action: Action taken in response to the flag
 * - resolved_at: When the investigation was concluded
 *
 * Acceptance Criteria:
 * ✓ Table created in grading schema
 * ✓ Tracks investigation status and workflow
 * ✓ Stores investigation notes and actions taken
 * ✓ Records timestamps for flagged and resolved events
 * ✓ Foreign keys with proper cascade/set null policies
 * ✓ Indices for efficient tenant-scoped querying
 *
 * Requirements Mapping:
 * - Requirement 9.6: Instructor review and action on plagiarism flags
 * - Requirement 9.7: Action recording and notification
 */
@Entity('plagiarism_flags', { schema: 'grading' })
@Index('idx_plagiarism_flags_tenant_id', ['tenant_id'])
@Index('idx_plagiarism_flags_submission_id', ['submission_id'])
@Index('idx_plagiarism_flags_plagiarism_result_id', ['plagiarism_result_id'])
@Index('idx_plagiarism_flags_flagged_by_user_id', ['flagged_by_user_id'])
@Index('idx_plagiarism_flags_status', ['status'])
@Index('idx_plagiarism_flags_flagged_at', ['flagged_at'])
export class PlagiarismFlag {
  /**
   * Primary Key: UUID
   * Global unique identifier for this plagiarism flag
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
   * References the institution this flag belongs to
   */
  @Column({ type: 'uuid', nullable: false })
  institution_id: string;

  /**
   * Submission ID: UUID
   * Foreign key to submissions table
   * References the submission that was flagged
   */
  @Column({ type: 'uuid', nullable: false })
  submission_id: string;

  /**
   * Plagiarism Result ID: UUID
   * Foreign key to plagiarism_results table
   * References the plagiarism scan result that triggered this flag
   */
  @Column({ type: 'uuid', nullable: false })
  plagiarism_result_id: string;

  /**
   * Flagged By User ID: UUID
   * Foreign key to users table
   * References the instructor or admin who flagged this submission
   */
  @Column({ type: 'uuid', nullable: false })
  flagged_by_user_id: string;

  /**
   * Status
   * Investigation status workflow
   * - FLAGGED: Initial flag created, awaiting investigation
   * - INVESTIGATING: Investigation is in progress
   * - RESOLVED: Investigation complete, action taken
   * - FALSE_POSITIVE: Investigation determined no violation occurred
   */
  @Column({
    type: 'enum',
    enum: ['FLAGGED', 'INVESTIGATING', 'RESOLVED', 'FALSE_POSITIVE'],
    nullable: false,
    default: 'FLAGGED',
  })
  status: 'FLAGGED' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE';

  /**
   * Action
   * Description of the action taken in response to the flag
   * Examples:
   * - "Student warned about academic integrity policy"
   * - "Grade reduced by 10 points"
   * - "Referred to academic integrity office"
   * - "No action - false positive"
   * - "Student provided source documentation"
   */
  @Column({ type: 'text', nullable: true })
  action: string | null;

  /**
   * Investigation Notes
   * Detailed notes about the investigation
   * Used to document findings, reasoning, and decision-making
   * Examples:
   * - "Reviewed submitted sources; student properly cited Wikipedia"
   * - "Student admitted to using assignment from previous semester"
   * - "Turnitin scan shows exact match to source but no violation policy"
   */
  @Column({ type: 'text', nullable: true })
  investigation_notes: string | null;

  /**
   * Flagged At
   * Timestamp when this flag was initially created
   * Immutable - set on creation
   */
  @Column({ type: 'timestamp', nullable: false })
  flagged_at: Date;

  /**
   * Resolved At
   * Timestamp when the investigation was concluded
   * Null while investigation is ongoing
   * Set when status changes to RESOLVED or FALSE_POSITIVE
   */
  @Column({ type: 'timestamp', nullable: true })
  resolved_at: Date | null;

  /**
   * Created At
   * Timestamp when this flag record was created (should match flagged_at)
   */
  @CreateDateColumn()
  created_at: Date;

  /**
   * Updated At
   * Timestamp of last modification (investigation notes, status, action, etc.)
   */
  @UpdateDateColumn()
  updated_at: Date;

  /**
   * Relations
   */

  /**
   * Submission
   * Many-to-one relationship with Submission entity
   * The submission that was flagged
   */
  @ManyToOne(
    () => Submission,
    (submission) => submission.plagiarism_flags,
    {
      onDelete: 'CASCADE',
      eager: false,
    },
  )
  @JoinColumn({
    name: 'submission_id',
    referencedColumnName: 'id',
  })
  submission: Submission;

  /**
   * Plagiarism Result
   * Many-to-one relationship with PlagiarismResult entity
   * The plagiarism scan result that prompted this flag
   */
  @ManyToOne(
    () => PlagiarismResult,
    (result) => result.plagiarism_flags,
    {
      onDelete: 'CASCADE',
      eager: false,
    },
  )
  @JoinColumn({
    name: 'plagiarism_result_id',
    referencedColumnName: 'id',
  })
  plagiarism_result: PlagiarismResult;

  /**
   * Flagged By User
   * Many-to-one relationship with User entity
   * The instructor/admin who created this flag
   */
  @ManyToOne(() => User, {
    onDelete: 'SET NULL',
    eager: false,
  })
  @JoinColumn({
    name: 'flagged_by_user_id',
    referencedColumnName: 'id',
  })
  flagged_by_user: User;

  /**
   * Institution
   * Many-to-one relationship with Institution entity
   */
  @ManyToOne(() => Institution, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({
    name: 'institution_id',
    referencedColumnName: 'id',
  })
  institution: Institution;
}
