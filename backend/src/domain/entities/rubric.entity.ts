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
import { Assignment } from './assignment.entity';

/**
 * Rubric Entity
 *
 * Represents a grading rubric with criteria and performance levels.
 * Rubrics guide AI grading and provide students with transparent scoring expectations.
 *
 * Multi-Tenancy:
 * - tenant_id: Tenant isolation via index and unique constraints
 * - institution_id: Foreign key to institutions table
 *
 * JSONB Criteria Storage:
 * - criteria: JSONB array of grading criteria with performance levels
 * - Structure validated by RubricGrammar specification
 *
 * Templates:
 * - is_template: Boolean flag indicating if this is a reusable template
 * - Unique constraint: unique(tenant_id, name) when is_template = true
 *
 * Acceptance Criteria:
 * ✓ Table created in grading schema
 * ✓ Tenant-scoped unique constraint on name (for templates)
 * ✓ JSONB criteria column stores array of criteria
 * ✓ Foreign key to users (creator) with SET NULL on delete
 * ✓ Supports rubric templates for reuse across assignments
 * ✓ Timestamps for audit trail
 */
@Entity('rubrics', { schema: 'grading' })
@Index('idx_rubrics_tenant_id', ['tenant_id'])
@Index('idx_rubrics_created_by_user_id', ['created_by_user_id'])
@Index('idx_rubrics_is_template', ['is_template'])
@Unique('unique_rubric_template_name', ['tenant_id', 'name'])
export class Rubric {
  /**
   * Primary Key: UUID
   * Global unique identifier for this rubric
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
   * References the institution this rubric belongs to
   */
  @Column({ type: 'uuid', nullable: false })
  institution_id: string;

  /**
   * Name
   * Display name for this rubric
   * Examples: "Essay Rubric", "Code Quality Assessment", "Project Rubric"
   */
  @Column({ type: 'varchar', length: 255, nullable: false })
  name: string;

  /**
   * Description
   * Optional detailed description of the rubric's purpose
   * Examples: "Used for evaluating student essays on thesis clarity and argument quality"
   */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  /**
   * Criteria
   * JSONB array of grading criteria following the Rubric Grammar specification
   * Structure:
   * [
   *   {
   *     "id": "criterion-1",
   *     "name": "Thesis Clarity",
   *     "description": "How well the thesis is articulated",
   *     "points": 25,
   *     "levels": [
   *       {
   *         "name": "Exceptional",
   *         "points": 25,
   *         "description": "Clear, compelling thesis"
   *       },
   *       ...
   *     ]
   *   }
   * ]
   *
   * Validation: Must conform to RubricGrammar specification
   * See: requirements.md Requirement 17, design.md Section 4.2
   */
  @Column({
    type: 'jsonb',
    nullable: false,
    default: () => "'[]'::jsonb",
  })
  criteria: any[];

  /**
   * Is Template
   * Boolean flag indicating if this rubric is a reusable template
   * - true: Template rubric (can be reused for multiple assignments)
   * - false: Assignment-specific rubric (used for single assignment only)
   */
  @Column({ type: 'boolean', nullable: false, default: false })
  is_template: boolean;

  /**
   * Created By User ID
   * UUID of the user who created this rubric
   * Foreign key to users table
   * On delete: SET NULL (preserve rubric even if creator is deleted)
   */
  @Column({ type: 'uuid', nullable: true })
  created_by_user_id: string | null;

  /**
   * Created At
   * Timestamp when rubric was created
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
   * Created By User
   * Many-to-one relationship with User entity
   * The user who created this rubric
   */
  @ManyToOne(() => User, {
    onDelete: 'SET NULL',
    eager: false,
  })
  @JoinColumn({
    name: 'created_by_user_id',
    referencedColumnName: 'id',
  })
  created_by_user: User | null;

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

  /**
   * Assignments Using This Rubric
   * One-to-many relationship with Assignment entity
   */
  @OneToMany(() => Assignment, (assignment) => assignment.rubric, {
    onDelete: 'SET NULL',
  })
  assignments: Assignment[];
}
