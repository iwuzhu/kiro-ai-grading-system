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
  ForeignKey,
} from 'typeorm';
import { Institution } from './institution.entity';
import { Course } from './course.entity';
import { CourseEnrollment } from './course-enrollment.entity';

/**
 * User Entity
 *
 * Represents a user account in the grading system.
 * Users belong to institutions and can have various roles (admin, instructor, student).
 *
 * Multi-Tenancy:
 * - tenant_id: Tenant isolation via unique constraint (tenant_id, email)
 * - institution_id: Foreign key to institutions table
 *
 * Authentication:
 * - password_hash: For local authentication (optional if using SSO)
 * - sso_provider/sso_id: For single sign-on integration
 *
 * Acceptance Criteria:
 * ✓ Table created in grading schema
 * ✓ Tenant-unique email constraint: unique(tenant_id, email)
 * ✓ SSO constraint: unique(tenant_id, sso_provider, sso_id)
 * ✓ Role enumeration: ADMIN, INSTRUCTOR, STUDENT
 * ✓ Status tracking: ACTIVE, INACTIVE, INVITED
 * ✓ Permissions array for fine-grained access control
 * ✓ Foreign key to institutions with cascade delete
 */
@Entity('users', { schema: 'grading' })
@Unique('unique_user_email', ['tenant_id', 'email'])
@Unique('unique_user_sso', ['tenant_id', 'sso_provider', 'sso_id'])
@Index('idx_users_tenant_id', ['tenant_id'])
@Index('idx_users_role', ['role'])
@Index('idx_users_tenant_email', ['tenant_id', 'email'])
@Index('idx_users_status', ['status'])
export class User {
  /**
   * Primary Key: UUID
   * Global unique identifier for this user
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
   * References the institution this user belongs to
   */
  @Column({ type: 'uuid', nullable: false })
  institution_id: string;

  /**
   * Email
   * User's email address
   * Unique within tenant (different tenants can have same email)
   * Used for authentication and communication
   */
  @Column({ type: 'varchar', length: 255, nullable: false })
  email: string;

  /**
   * Name
   * User's full name or display name
   */
  @Column({ type: 'varchar', length: 255, nullable: false })
  name: string;

  /**
   * Role
   * User's primary role in the system
   * - ADMIN: Full access to institution settings and all courses
   * - INSTRUCTOR: Can create courses, submit grades, view submissions
   * - STUDENT: Can submit work, view feedback on submissions
   */
  @Column({
    type: 'enum',
    enum: ['ADMIN', 'INSTRUCTOR', 'STUDENT'],
    nullable: false,
  })
  role: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT';

  /**
   * Password Hash
   * Bcrypt hash of user's password (optional if SSO is used)
   * Null for SSO-only accounts
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  password_hash: string | null;

  /**
   * SSO Provider
   * External authentication provider
   * Options: 'okta', 'azure', 'google'
   * Null if using local authentication
   */
  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    enum: ['okta', 'azure', 'google'],
  })
  sso_provider: 'okta' | 'azure' | 'google' | null;

  /**
   * SSO ID
   * External user ID from SSO provider
   * Example: okta user ID, Azure object ID, Google subject
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  sso_id: string | null;

  /**
   * Status
   * User account status
   * - ACTIVE: User can log in and access system
   * - INACTIVE: User account is disabled (soft-deleted users)
   * - INVITED: User has been invited but hasn't accepted (not yet active)
   */
  @Column({
    type: 'enum',
    enum: ['ACTIVE', 'INACTIVE', 'INVITED'],
    nullable: false,
    default: 'INVITED',
  })
  status: 'ACTIVE' | 'INACTIVE' | 'INVITED';

  /**
   * Permissions
   * Array of permission codes for fine-grained access control
   * Examples:
   * - 'view:submissions'
   * - 'create:assignments'
   * - 'override:grades'
   * - 'manage:plagiarism'
   * - 'view:analytics'
   */
  @Column({
    type: 'text',
    array: true,
    nullable: false,
    default: () => 'ARRAY[]::text[]',
  })
  permissions: string[];

  /**
   * Created At
   * Timestamp when user was created
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
  @ManyToOne(() => Institution, (institution) => institution.users, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'institution_id', referencedColumnName: 'id' })
  institution: Institution;

  /**
   * Courses Created
   * Courses created by this user (instructor)
   */
  @OneToMany(() => Course, (course) => course.created_by_user, {
    onDelete: 'SET NULL',
  })
  courses_created: Course[];

  /**
   * Course Enrollments
   * Courses this user is enrolled in
   */
  @OneToMany(() => CourseEnrollment, (enrollment) => enrollment.user, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  enrollments: CourseEnrollment[];
}
