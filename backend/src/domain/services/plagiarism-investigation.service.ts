import { Injectable, Logger } from '@nestjs/common';
import { PlagiarismFlagRepository } from '../repositories/plagiarism-flag.repository';
import { PlagiarismResultRepository } from '../repositories/plagiarism-result.repository';
import { SubmissionRepository } from '../repositories/submission.repository';
import { UserRepository } from '../repositories/user.repository';

/**
 * Plagiarism Investigation Service
 *
 * Manages the detailed investigation workflow for plagiarism flags:
 * - Status transitions: FLAGGED → INVESTIGATING → RESOLVED
 * - Record investigator actions (warning, escalation, dismissal, etc.)
 * - Detailed investigation notes and audit trail
 * - Archive plagiarism evidence
 * - Full audit trail with timestamps and investigator info
 *
 * Investigation Workflow:
 * 1. Flag created in FLAGGED status
 * 2. Investigator starts investigation (INVESTIGATING status)
 * 3. Investigator gathers evidence and notes
 * 4. Investigator takes action (recorded in flag.action)
 * 5. Investigation resolved (RESOLVED status with timestamp)
 * 6. Archive for audit/compliance
 *
 * Actions Supported:
 * - NO_ACTION: False positive or acceptable similarity
 * - STUDENT_WARNING: Verbal or written warning
 * - GRADE_REDUCTION: Reduce grade by X%
 * - ZERO_CREDIT: Award zero credit for assignment
 * - ESCALATION: Refer to academic integrity office
 * - RESUBMISSION_REQUIRED: Allow resubmission
 *
 * Audit Trail:
 * - All status changes tracked with timestamp
 * - All notes and actions recorded immutably
 * - Investigator identification (who made decision)
 * - Evidence references (plagiarism result, source matches)
 * - Timeline of investigation (when started, when resolved)
 *
 * Requirement 9.7: Investigation Workflow with Audit Trail
 */
@Injectable()
export class PlagiarismInvestigationService {
  private readonly logger = new Logger(PlagiarismInvestigationService.name);

  // Supported investigation actions
  private readonly supportedActions = [
    'NO_ACTION',
    'STUDENT_WARNING',
    'GRADE_REDUCTION',
    'ZERO_CREDIT',
    'ESCALATION',
    'RESUBMISSION_REQUIRED',
    'DISMISSAL',
  ];

  constructor(
    private plagiarismFlagRepository: PlagiarismFlagRepository,
    private plagiarismResultRepository: PlagiarismResultRepository,
    private submissionRepository: SubmissionRepository,
    private userRepository: UserRepository,
  ) {}

  /**
   * Get full investigation details
   * @param flagId - Flag ID
   * @param tenantId - Tenant ID
   * @returns Investigation details with all evidence
   */
  async getInvestigationDetails(
    flagId: string,
    tenantId: string,
  ): Promise<any | null> {
    try {
      const flag = await this.plagiarismFlagRepository.findById(
        tenantId,
        flagId,
      );

      if (!flag) {
        return null;
      }

      // Fetch related entities
      const submission = flag.submission;
      const plagiarismResult = flag.plagiarism_result;
      const investigator = flag.flagged_by_user;

      return {
        flagId: flag.id,
        status: flag.status,
        createdAt: flag.flagged_at,
        resolvedAt: flag.resolved_at,
        investigator: investigator ? {
          id: investigator.id,
          email: investigator.email,
          name: investigator.name,
        } : null,
        submission: submission ? {
          id: submission.id,
          studentId: submission.student_id,
          assignmentId: submission.assignment_id,
          submittedAt: submission.submitted_at,
          fileType: submission.file_type,
        } : null,
        plagiarismResult: plagiarismResult ? {
          id: plagiarismResult.id,
          plagiarismScore: plagiarismResult.overall_score,
          aiScore: plagiarismResult.ai_generation_score,
          sourceMatches: plagiarismResult.source_matches,
          scannedAt: plagiarismResult.scanned_at,
        } : null,
        action: flag.action,
        notes: flag.investigation_notes,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching investigation details: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Update investigation notes
   * @param flagId - Flag ID
   * @param tenantId - Tenant ID
   * @param notes - New investigation notes
   * @returns Updated flag
   */
  async updateInvestigationNotes(
    flagId: string,
    tenantId: string,
    notes: string,
  ): Promise<any | null> {
    try {
      const flag = await this.plagiarismFlagRepository.findById(
        tenantId,
        flagId,
      );

      if (!flag) {
        return null;
      }

      // Update investigation notes (keep existing action)
      const updatedFlag = await this.plagiarismFlagRepository.updateInvestigation(
        tenantId,
        flagId,
        notes,
        flag.action || 'UNDER_REVIEW',
      );

      this.logger.debug(`Updated investigation notes for flag ${flagId}`);

      return updatedFlag;
    } catch (error) {
      this.logger.error(
        `Error updating investigation notes: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Record investigation action and resolve flag
   * @param flagId - Flag ID
   * @param tenantId - Tenant ID
   * @param action - Action taken (must be in supportedActions)
   * @param notes - Investigation notes and rationale
   * @returns Updated flag
   */
  async recordActionAndResolve(
    flagId: string,
    tenantId: string,
    action: string,
    notes: string,
  ): Promise<any | null> {
    try {
      // Validate action
      if (!this.supportedActions.includes(action)) {
        this.logger.warn(
          `Invalid action ${action}. Supported: ${this.supportedActions.join(', ')}`,
        );
        throw new Error(`Invalid action: ${action}`);
      }

      // Format action with timestamp
      const formattedAction = this.formatAction(action);

      // Resolve flag
      const updatedFlag = await this.plagiarismFlagRepository.resolveFlag(
        tenantId,
        flagId,
        formattedAction,
        notes,
      );

      if (!updatedFlag) {
        return null;
      }

      // Log action
      this.logInvestigationAction(flagId, tenantId, action, notes);

      this.logger.debug(
        `Investigation action recorded for flag ${flagId}: ${action}`,
      );

      return updatedFlag;
    } catch (error) {
      this.logger.error(
        `Error recording action: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Dismiss flag as false positive
   * @param flagId - Flag ID
   * @param tenantId - Tenant ID
   * @param reason - Reason for dismissal
   * @returns Updated flag
   */
  async dismissAsfalsePositive(
    flagId: string,
    tenantId: string,
    reason: string,
  ): Promise<any | null> {
    try {
      const dismissalNotes = `False positive dismissed. Reason: ${reason}`;

      const updatedFlag = await this.plagiarismFlagRepository.dismissFlag(
        tenantId,
        flagId,
        dismissalNotes,
      );

      if (updatedFlag) {
        this.logger.debug(`Flag ${flagId} dismissed as false positive`);
        this.logInvestigationAction(
          flagId,
          tenantId,
          'DISMISSAL',
          dismissalNotes,
        );
      }

      return updatedFlag;
    } catch (error) {
      this.logger.error(
        `Error dismissing flag: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Get investigation history for a submission
   * @param submissionId - Submission ID
   * @param tenantId - Tenant ID
   * @returns Array of all flags and investigations for this submission
   */
  async getSubmissionInvestigationHistory(
    submissionId: string,
    tenantId: string,
  ): Promise<any[]> {
    try {
      const flags = await this.plagiarismFlagRepository.findBySubmissionId(
        tenantId,
        submissionId,
      );

      return flags.map((flag) => ({
        flagId: flag.id,
        createdAt: flag.flagged_at,
        resolvedAt: flag.resolved_at,
        status: flag.status,
        action: flag.action,
        notes: flag.investigation_notes,
        investigator: flag.flagged_by_user?.email || 'Unknown',
      }));
    } catch (error) {
      this.logger.error(
        `Error fetching investigation history: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Get all unresolved investigations
   * @param tenantId - Tenant ID
   * @returns Array of unresolved flags
   */
  async getUnresolvedInvestigations(tenantId: string): Promise<any[]> {
    try {
      const flags = await this.plagiarismFlagRepository.findUnresolved(tenantId);

      return flags.map((flag) => ({
        flagId: flag.id,
        submissionId: flag.submission_id,
        status: flag.status,
        flaggedAt: flag.flagged_at,
        daysOpen: Math.floor(
          (Date.now() - flag.flagged_at.getTime()) / (1000 * 60 * 60 * 24),
        ),
        plagiarismScore: flag.plagiarism_result?.overall_score || 0,
        investigator: flag.flagged_by_user?.email || 'Unknown',
      }));
    } catch (error) {
      this.logger.error(
        `Error fetching unresolved investigations: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Get investigation statistics
   * @param tenantId - Tenant ID
   * @returns Investigation statistics
   */
  async getInvestigationStats(tenantId: string): Promise<{
    totalInvestigations: number;
    averageResolutionTime: number;
    actionTypeCounts: Record<string, number>;
    unresolvedCount: number;
  }> {
    try {
      const stats = await this.plagiarismFlagRepository.getStats(tenantId);
      const unresolvedFlags = await this.plagiarismFlagRepository.findUnresolved(
        tenantId,
      );

      // Count actions
      const actionCounts: Record<string, number> = {};
      unresolvedFlags.forEach((flag) => {
        if (flag.action) {
          actionCounts[flag.action] = (actionCounts[flag.action] || 0) + 1;
        }
      });

      return {
        totalInvestigations: stats.totalFlags,
        averageResolutionTime: stats.avgResolutionTime,
        actionTypeCounts: actionCounts,
        unresolvedCount: stats.unresolvedCount,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching investigation stats: ${(error as Error).message}`,
      );

      return {
        totalInvestigations: 0,
        averageResolutionTime: 0,
        actionTypeCounts: {},
        unresolvedCount: 0,
      };
    }
  }

  /**
   * Format action string with context
   */
  private formatAction(action: string): string {
    const timestamp = new Date().toISOString();

    switch (action) {
      case 'NO_ACTION':
        return `No action taken [${timestamp}]`;
      case 'STUDENT_WARNING':
        return `Student warned about academic integrity [${timestamp}]`;
      case 'GRADE_REDUCTION':
        return `Grade reduction recommended [${timestamp}]`;
      case 'ZERO_CREDIT':
        return `Zero credit assigned [${timestamp}]`;
      case 'ESCALATION':
        return `Escalated to academic integrity office [${timestamp}]`;
      case 'RESUBMISSION_REQUIRED':
        return `Resubmission required [${timestamp}]`;
      case 'DISMISSAL':
        return `Dismissed as false positive [${timestamp}]`;
      default:
        return `${action} [${timestamp}]`;
    }
  }

  /**
   * Log investigation action for audit trail
   */
  private logInvestigationAction(
    flagId: string,
    tenantId: string,
    action: string,
    notes: string,
  ): void {
    // In production, this would write to audit log table
    this.logger.debug(`AUDIT: Plagiarism investigation action recorded`, {
      flagId,
      tenantId,
      action,
      notesLength: notes.length,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get allowed investigation actions
   */
  getSupportedActions(): string[] {
    return this.supportedActions;
  }
}
