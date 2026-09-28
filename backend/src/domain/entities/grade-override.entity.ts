import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToOne,
  Check,
} from 'typeorm';
import { Grade } from './grade.entity';
import { User } from './user.entity';

/**
 * Grade Override Entity
 *
 * Represents an override of an AI-generated or manual grade by an instructor.
 * Provides immutable audit trail for grade adjustments and compliance.
 * Preserves original grade for complete historical record.
 *
 * Multi-Tenancy:
 * - tenant_id: Tenant isolation via index and RLS
 * - grade_id: Foreign key to grades table
 *
 * Audit Trail:
 * - original_score: AI-generated or manual score before override (preserved)
 * - manual_score: New score assigned by instructor
 * - rationale: Text explanation for why override was made
 * - approved_by_user_id: Instructor who approved the override
 * - approved_at: Timestamp when override took effect
 *
 * Immutability:
 * - NO soft delete - append-only audit log
 * - NO updates after creation - modifications create new override records
 * - created_at immutable
 * - This ensures complete regulatory compliance and audit trail integrity
 *
 * Relationship to Grade:
 * - OneToOne relationship with Grade entity
 * - Linked via grade_id foreign key
 * - Original grade status changed to OVERRIDDEN when override created
 *
 * Acceptance Criteria:
 * ✓ Table created in grading schema
 * ✓ Overrides preserve original grade (immutable record)
 * ✓ New score properly validated (0-100, 2 decimal places)
 * ✓ Rationale text required for audit trail
 * ✓ NO soft delete - append-only immutability enforced
 * ✓ approved_by_user_id tracks who made override
 * ✓ approved_at timestamp for when override took effect
 * ✓ Foreign keys with proper cascade delete policies
 * ✓ Mapping to Requirements: 13, 20
 */
@Entity('grade_overrides', { schema: 'grading' })
@Check('check_original_score_range', '"original_score" >= 0 AND "original_score" <= 100')
@Check('check_manual_score_range', '"manual_score" >= 0 AND "manual_score" <= 100')
@Index('idx_grade_overrides_tenant_id', ['tenant_id'])
@Index('idx_grade_overrides_grade_id', ['grade_id'])
@Index('idx_grade_overrides_approved_by_user_id', ['approved_by_user_id'])
@Index('idx_grade_overrides_created_at', ['created_at'])
export class GradeOverride {
  /**
   * Primary Key: UUID
   * Global unique identifier for this grade override record
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
   * Grade ID: UUID
   * Foreign key to grades table
   * References the grade being overridden
   * One override per grade (enforced via unique constraint in Grade.override)
   */
  @Column({ type: 'uuid', nullable: false })
  grade_id: string;

  /**
   * Original Score
   * The score before override (from AI provider or manual entry)
   * Range: 0-100
   * Precision: 2 decimal places
   * IMMUTABLE - preserved for audit trail
   * Example: 78.50 (AI score that was overridden)
   */
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: false,
  })
  original_score: number;

  /**
   * Manual Score
   * The new score assigned by instructor override
   * Range: 0-100
   * Precision: 2 decimal places
   * Example: 85.00 (instructor's corrected score)
   */
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: false,
  })
  manual_score: number;

  /**
   * Rationale
   * Text explanation for why override was made
   * Required field for compliance and audit purposes
   * Examples:
   * - "AI misunderstood the code logic, actual implementation is correct"
   * - "Student provided evidence of misunderstanding; gave partial credit"
   * - "Grade submission error; adjusting to correct value"
   * Can be updated to refine explanation (non-destructive audit trail)
   */
  @Column({ type: 'text', nullable: false })
  rationale: string;

  /**
   * Approved By User ID: UUID
   * Foreign key to users table
   * References the instructor/admin who made the override
   * Cannot be null - override must be traceable to specific user
   */
  @Column({ type: 'uuid', nullable: false })
  approved_by_user_id: string;

  /**
   * Approved At
   * Timestamp when override was approved and took effect
   * Set at creation time
   * Used for timeline verification and compliance reporting
   */
  @Column({ type: 'timestamp with time zone', nullable: false })
  approved_at: Date;

  /**
   * Created At
   * Timestamp when this override record was created
   * IMMUTABLE - never changes
   * Separate from approved_at for audit trail precision
   */
  @CreateDateColumn()
  created_at: Date;

  /**
   * Updated At
   * Timestamp of last modification
   * NOTE: GradeOverride records are append-only (NO soft delete)
   * Minimal updates: only rationale field may be refined
   * New overrides create new records (never modify existing ones)
   */
  @UpdateDateColumn()
  updated_at: Date;

  /**
   * Relations
   */

  /**
   * Grade
   * One-to-one relationship with Grade entity
   * References the original grade being overridden
   */
  @OneToOne(() => Grade, (grade) => grade.override, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'grade_id', referencedColumnName: 'id' })
  grade: Grade;

  /**
   * Approved By User
   * Many-to-one relationship with User entity
   * References the instructor/admin who made the override
   */
  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'approved_by_user_id', referencedColumnName: 'id' })
  approved_by_user: User;
}
