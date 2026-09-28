import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  Unique,
  OneToMany,
} from 'typeorm';
import { User } from './user.entity';
import { Course } from './course.entity';

/**
 * Institution Entity
 *
 * Represents a tenant in the multi-tenant grading system.
 * Each institution is an isolated organization with its own users, courses, and grading data.
 *
 * Multi-Tenancy:
 * - tenant_id: Unique identifier for this institution (maps to institution.id)
 * - All institution data is isolated via Row-Level Security policies
 *
 * Acceptance Criteria:
 * ✓ Table created in grading schema
 * ✓ tenant_id uniquely identified via unique constraint with domain
 * ✓ Timezone support for institution-specific time calculations
 * ✓ Settings stored as JSONB for flexible configuration
 * ✓ AI provider configuration for external service routing
 * ✓ Plagiarism threshold for detection sensitivity
 */
@Entity('institutions', { schema: 'grading' })
@Unique('unique_institution_domain', ['domain'])
@Unique('unique_institution_tenant_id', ['tenant_id'])
@Index('idx_institutions_tenant_id', ['tenant_id'])
export class Institution {
  /**
   * Primary Key: UUID
   * Global unique identifier for this institution
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Tenant ID: UUID
   * Logical tenant identifier (typically same as id for institutions)
   * Used by Row-Level Security policies for data isolation
   */
  @Column({ type: 'uuid', nullable: false })
  tenant_id: string;

  /**
   * Institution Name
   * Display name for the organization
   */
  @Column({ type: 'varchar', length: 255, nullable: false })
  name: string;

  /**
   * Domain
   * Globally unique domain identifier (e.g., university.edu)
   * Used for white-label deployment and domain-based routing
   */
  @Column({ type: 'varchar', length: 255, nullable: false, unique: true })
  domain: string;

  /**
   * Timezone
   * Institution's timezone for deadline calculations and reporting
   * Format: IANA timezone (e.g., 'America/New_York', 'UTC')
   * Default: 'UTC'
   */
  @Column({ type: 'varchar', length: 50, nullable: false, default: 'UTC' })
  timezone: string;

  /**
   * Plagiarism Threshold
   * Percentage threshold for plagiarism detection (0-100)
   * Scores >= this threshold are flagged as potential plagiarism
   * Default: 75
   */
  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: false,
    default: 75,
  })
  plagiarism_threshold: number;

  /**
   * AI Provider
   * External AI service used for grading and analysis
   * Options: 'openai', 'claude', 'bedrock'
   * Default: 'openai'
   */
  @Column({
    type: 'varchar',
    length: 50,
    nullable: false,
    default: 'openai',
  })
  ai_provider: 'openai' | 'claude' | 'bedrock';

  /**
   * Settings
   * Flexible JSONB configuration for institution-specific settings
   * Examples:
   * {
   *   "allow_anonymous_submissions": true,
   *   "require_plagiarism_check": true,
   *   "email_notifications_enabled": false,
   *   "max_file_upload_size_mb": 50
   * }
   */
  @Column({ type: 'jsonb', nullable: true, default: {} })
  settings: Record<string, any>;

  /**
   * Created At
   * Timestamp when institution was created
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
   * Users in this institution
   * One institution has many users
   * Cascade delete: User records are deleted when institution is deleted
   */
  @OneToMany(() => User, (user) => user.institution, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  users: User[];

  /**
   * Courses in this institution
   * One institution has many courses
   * Cascade delete: Course records are deleted when institution is deleted
   */
  @OneToMany(() => Course, (course) => course.institution, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  courses: Course[];
}
