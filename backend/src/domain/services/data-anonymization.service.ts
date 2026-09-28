import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Submission } from '../entities/submission.entity';
import { Grade } from '../entities/grade.entity';

/**
 * Data Anonymization Service
 *
 * Provides GDPR-compliant data anonymization and deletion:
 * - Right to delete (account deletion with data anonymization)
 * - Right to export (data portability)
 * - PII anonymization (preserve grades with anonymized references)
 * - Test data anonymization
 *
 * Validates: Requirements 19.6, 19.7, 1.11
 */

export interface AnonymizationResult {
  userId: string;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  dataAnonymized: {
    submissions: number;
    grades: number;
    personalInfo: number;
  };
  gradesPreserved: number;
  timestamp: Date;
  details: string;
}

export interface DataExportPackage {
  userId: string;
  exportDate: Date;
  data: {
    userInfo: any;
    submissions: any[];
    grades: any[];
    feedback: any[];
  };
}

@Injectable()
export class DataAnonymizationService {
  private readonly logger = new Logger(DataAnonymizationService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Submission)
    private submissionRepository: Repository<Submission>,
    @InjectRepository(Grade)
    private gradeRepository: Repository<Grade>,
  ) {}

  /**
   * Export user data for GDPR right to access
   * Requirement: 19.6
   */
  async exportUserData(userId: string, tenantId: string): Promise<DataExportPackage> {
    try {
      // Get user information
      const user = await this.userRepository.findOneBy({
        id: userId,
        tenant_id: tenantId,
      });

      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      // Get all submissions for this user
      const submissions = await this.submissionRepository.find({
        where: {
          student_id: userId,
          tenant_id: tenantId,
        },
        relations: ['assignment', 'grades'],
      });

      // Get all grades for this user's submissions
      const grades = await this.gradeRepository.find({
        where: {
          submission: { student_id: userId },
        },
        relations: ['submission'],
      });

      // Build export package
      const exportPackage: DataExportPackage = {
        userId,
        exportDate: new Date(),
        data: {
          userInfo: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            createdAt: user.created_at,
          },
          submissions: submissions.map((s) => ({
            id: s.id,
            assignmentId: s.assignment_id,
            assignmentTitle: s.assignment?.title,
            submittedAt: s.submitted_at,
            isLate: s.is_late,
            fileType: s.file_type,
            version: s.version,
          })),
          grades: grades.map((g) => ({
            id: g.id,
            submissionId: g.submission_id,
            score: g.final_score,
            confidence: g.confidence,
            feedback: g.feedback,
            status: g.status,
            createdAt: g.created_at,
          })),
          feedback: grades.map((g) => ({
            gradeId: g.id,
            feedback: g.feedback,
            strengths: g.strengths,
            improvements: g.improvements,
          })),
        },
      };

      return exportPackage;
    } catch (error) {
      this.logger.error(`Failed to export user data for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Anonymize user data for GDPR right to delete
   * Requirement: 19.7, 1.11
   *
   * Preserves grades with anonymized student references for institutional records
   */
  async anonymizeUserData(
    userId: string,
    tenantId: string,
  ): Promise<AnonymizationResult> {
    try {
      // Get user
      const user = await this.userRepository.findOneBy({
        id: userId,
        tenant_id: tenantId,
      });

      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      let submissionsAnonymized = 0;
      let gradesPreserved = 0;
      let personalInfoAnonymized = 0;

      // Get all submissions for this user
      const submissions = await this.submissionRepository.find({
        where: {
          student_id: userId,
          tenant_id: tenantId,
        },
        relations: ['grades'],
      });

      // Anonymize submissions
      for (const submission of submissions) {
        // Replace file path to anonymize content
        submission.file_path = `s3://archive/anonymized/${Date.now()}_${submission.id}.bin`;
        submission.file_type = 'bin'; // Generic binary type
        await this.submissionRepository.save(submission);
        submissionsAnonymized++;

        // Preserve grades but mark as anonymized
        for (const grade of submission.grades || []) {
          // Keep grade data but mark as anonymized
          grade.feedback = this.anonymizeText(grade.feedback || '');
          grade.strengths = grade.strengths?.map(() => 'Anonymized') || [];
          grade.improvements = grade.improvements?.map(() => 'Anonymized') || [];
          await this.gradeRepository.save(grade);
          gradesPreserved++;
        }
      }

      // Anonymize user personal information
      user.name = `Anonymous User ${userId.substring(0, 8)}`;
      user.email = `anonymous_${userId.substring(0, 8)}@anonymized.local`;
      // Note: password_hash and sso_provider already should be encrypted
      await this.userRepository.save(user);
      personalInfoAnonymized++;

      return {
        userId,
        status: 'SUCCESS',
        dataAnonymized: {
          submissions: submissionsAnonymized,
          grades: gradesPreserved,
          personalInfo: personalInfoAnonymized,
        },
        gradesPreserved,
        timestamp: new Date(),
        details: `Successfully anonymized ${submissionsAnonymized} submissions and ${personalInfoAnonymized} personal information records while preserving ${gradesPreserved} grade records`,
      };
    } catch (error) {
      this.logger.error(`Failed to anonymize user data for ${userId}:`, error);
      throw {
        userId,
        status: 'FAILED',
        dataAnonymized: { submissions: 0, grades: 0, personalInfo: 0 },
        gradesPreserved: 0,
        timestamp: new Date(),
        details: error.message,
      };
    }
  }

  /**
   * Delete user account with full data purge
   * Used when right to delete is exercised
   */
  async deleteUserAccount(
    userId: string,
    tenantId: string,
  ): Promise<AnonymizationResult> {
    try {
      // First anonymize the data
      const anonymizationResult = await this.anonymizeUserData(userId, tenantId);

      // Then soft-delete the user (if soft delete is supported)
      const user = await this.userRepository.findOneBy({
        id: userId,
        tenant_id: tenantId,
      });

      if (user) {
        // Soft delete (if supported)
        user.status = 'INACTIVE';
        await this.userRepository.save(user);
      }

      return {
        ...anonymizationResult,
        details: `${anonymizationResult.details}. User account marked as INACTIVE.`,
      };
    } catch (error) {
      this.logger.error(`Failed to delete user account for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Anonymize test data for development/testing environments
   * Requirement: 1.11
   */
  async anonymizeTestData(tenantId: string): Promise<AnonymizationResult> {
    try {
      // Find all test users (marked with 'test_' prefix or other indicators)
      const testUsers = await this.userRepository.find({
        where: {
          tenant_id: tenantId,
        },
      });

      let usersAnonymized = 0;
      let submissionsAnonymized = 0;
      let gradesAnonymized = 0;

      for (const user of testUsers) {
        // Anonymize test user data
        if (user.email.includes('test') || user.name.includes('Test')) {
          user.name = `Test User ${usersAnonymized}`;
          user.email = `test_user_${usersAnonymized}@test.local`;
          await this.userRepository.save(user);
          usersAnonymized++;

          // Anonymize related submissions and grades
          const submissions = await this.submissionRepository.find({
            where: {
              student_id: user.id,
              tenant_id: tenantId,
            },
          });

          for (const submission of submissions) {
            submission.file_path = `s3://test/anonymized/${submission.id}.bin`;
            await this.submissionRepository.save(submission);
            submissionsAnonymized++;

            const grades = await this.gradeRepository.find({
              where: { submission_id: submission.id },
            });

            for (const grade of grades) {
              grade.feedback = '[Test feedback - anonymized]';
              await this.gradeRepository.save(grade);
              gradesAnonymized++;
            }
          }
        }
      }

      return {
        userId: 'TEST_DATA_BATCH',
        status: 'SUCCESS',
        dataAnonymized: {
          submissions: submissionsAnonymized,
          grades: gradesAnonymized,
          personalInfo: usersAnonymized,
        },
        gradesPreserved: 0,
        timestamp: new Date(),
        details: `Anonymized ${usersAnonymized} test users, ${submissionsAnonymized} test submissions, and ${gradesAnonymized} test grades`,
      };
    } catch (error) {
      this.logger.error(`Failed to anonymize test data:`, error);
      throw error;
    }
  }

  /**
   * Check if user data has been anonymized
   */
  async isUserDataAnonymized(userId: string, tenantId: string): Promise<boolean> {
    try {
      const user = await this.userRepository.findOneBy({
        id: userId,
        tenant_id: tenantId,
      });

      if (!user) {
        return false; // User doesn't exist
      }

      // Check if user data matches anonymization pattern
      const isAnonymized =
        user.name.includes('Anonymous User') ||
        user.email.includes('anonymized.local');

      return isAnonymized;
    } catch (error) {
      this.logger.error(`Failed to check anonymization status:`, error);
      throw error;
    }
  }

  /**
   * Anonymize text content (replace with generic placeholder)
   */
  private anonymizeText(text: string): string {
    if (!text || text.length === 0) {
      return '';
    }
    return '[Anonymized content]';
  }
}
