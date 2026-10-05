import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPublishedStatusToAssignments1704067200000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add published_status column to assignments table
    await queryRunner.query(
      `ALTER TABLE grading.assignments 
       ADD COLUMN IF NOT EXISTS published_status VARCHAR(50) DEFAULT 'draft' NOT NULL;`
    );

    // Create index on published_status for filtering
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_assignments_published_status 
       ON grading.assignments(published_status);`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the index
    await queryRunner.query(
      `DROP INDEX IF EXISTS grading.idx_assignments_published_status;`
    );

    // Remove the published_status column
    await queryRunner.query(
      `ALTER TABLE grading.assignments DROP COLUMN IF EXISTS published_status;`
    );
  }
}
