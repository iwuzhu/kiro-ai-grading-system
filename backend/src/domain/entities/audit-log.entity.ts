import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * AuditLog Entity
 *
 * Represents an immutable audit trail entry for compliance tracking.
 * All significant events (grade changes, plagiarism flags, user actions) are logged here.
 * 
 * Properties:
 * - Immutable: Cannot be updated or deleted after creation
 * - Tenant-isolated: Each log is scoped to a specific institution
 * - JSONB payload: Flexible action_details for event-specific context
 * - Comprehensive: Tracks actor, resource, event type, and detailed context
 *
 * Event Types:
 * - user_login, user_logout, user_password_changed
 * - grade_created, grade_override, grade_released, grade_deleted
 * - plagiarism_scanned, plagiarism_flagged, plagiarism_investigated
 * - submission_received, submission_incremental_received
 * - user_created, user_role_changed, user_permissions_changed
 * - institution_created, institution_settings_changed
 * - compliance_report_generated, data_export_requested, data_deletion_requested
 */
@Entity({ name: 'audit_logs', schema: 'grading' })
@Index('idx_grading_audit_logs_tenant_event', ['tenant_id', 'event_type', 'created_at'])
@Index('idx_grading_audit_logs_actor', ['tenant_id', 'actor_user_id', 'created_at'])
@Index('idx_grading_audit_logs_resource', ['tenant_id', 'resource_type', 'resource_id', 'created_at'])
@Index('idx_grading_audit_logs_created_at', ['created_at'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'varchar', length: 100 })
  event_type: string;

  @Column({ type: 'uuid', nullable: true })
  actor_user_id: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  resource_type: string | null;

  @Column({ type: 'uuid', nullable: true })
  resource_id: string | null;

  @Column({ type: 'jsonb', nullable: true })
  action_details: Record<string, any> | null;

  @Column({ type: 'inet', nullable: true })
  ip_address: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}

/**
 * Event-specific payload types for action_details JSONB
 */

export interface GradeCreatedDetails {
  submissionId: string;
  assignmentId: string;
  rubricId?: string;
  aiProvider?: string;
  aiModel?: string;
  aiScore?: number;
  aiConfidence?: number;
  score: number;
  confidence?: number;
  feedback: string;
  tokenCount?: number;
  latency?: number;
}

export interface GradeOverrideDetails {
  originalScore: number;
  overriddenScore: number;
  originalConfidence?: number;
  rationale: string;
  requiresApproval?: boolean;
  submissionId?: string;
  rubricId?: string;
}

export interface PlagiarismFlaggedDetails {
  plagiarismScore: number;
  aiGenerationScore?: number;
  sourceMatches?: number;
  flaggedAsHighRisk: boolean;
  investigationStatus?: string;
}

export interface PlagiarismInvestigatedDetails {
  plagiarismScore: number;
  investigationStatus: 'dismissed' | 'warning' | 'investigation' | 'escalation';
  investigatorNotes?: string;
  actionReason?: string;
}

export interface SubmissionReceivedDetails {
  assignmentId: string;
  studentId: string;
  submissionCount?: number;
  isIncremental?: boolean;
  fileSize?: number;
  fileName?: string;
}

export interface UserRoleChangedDetails {
  userId: string;
  previousRole: string;
  newRole: string;
  changedByUserId: string;
}

export interface InstitutionSettingsChangedDetails {
  settingKey: string;
  previousValue: any;
  newValue: any;
  description?: string;
}
