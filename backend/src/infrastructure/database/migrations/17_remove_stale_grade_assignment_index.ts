import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Remove Stale Grade Assignment Index
 *
 * Context:
 * - Grade entity was refactored to reference only Submission, not Assignment
 * - Assignment is now accessed via Submission.assignment
 * - The index idx_grades_assignment_id references a non-existent assignment_id column
 * - This causes TypeORM to fail on entity synchronization
 *
 * Action:
 * - Drop the stale idx_grades_assignment_id index
 * - No data loss (index only, not a column)
 *
 * Rationale:
 * - Assignment access pattern: Grade -> Submission -> Assignment
 * - Direct Grade.assignment_id relationship is no longer needed
 * - Simplifies schema and improves data integrity
 */
export class RemoveStaleGradeAssignmentIndex1735803600000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the index if it exists
    await queryRunner.query(
      `DROP INDEX IF EXISTS grading.idx_grades_assignment_id;`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate the index (for rollback)
    // Note: This assumes assignment_id column still exists in down scenario
    await queryRunner.query(
      `CREATE INDEX idx_grades_assignment_id ON grading.grades(assignment_id);`
    );
  }
}
