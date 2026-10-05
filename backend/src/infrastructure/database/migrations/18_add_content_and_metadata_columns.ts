import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add Content Column to Assignments and Submissions
 *
 * Simple migration to add the missing JSONB content columns
 * that should have been created in migration 15 but may not have run.
 *
 * ASSIGNMENTS: stores multi-question array structure
 * SUBMISSIONS: stores answers array structure
 */
export class AddContentAndMetadataColumns1735804000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ===== ASSIGNMENTS TABLE =====
    // Check if content column already exists
    const assignmentContentExists = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'grading' 
      AND table_name = 'assignments' 
      AND column_name = 'content'
    `);

    if (assignmentContentExists.length === 0) {
      // Column doesn't exist, add it
      await queryRunner.query(`
        ALTER TABLE grading.assignments
        ADD COLUMN content JSONB DEFAULT '[]'::jsonb;
      `);

      // Create GIN index for JSONB queries
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_assignments_content 
        ON grading.assignments USING GIN (content);
      `);
    }

    // ===== SUBMISSIONS TABLE =====
    // Check if content column already exists
    const submissionContentExists = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'grading' 
      AND table_name = 'submissions' 
      AND column_name = 'content'
    `);

    if (submissionContentExists.length === 0) {
      // Column doesn't exist, add it
      await queryRunner.query(`
        ALTER TABLE grading.submissions
        ADD COLUMN content JSONB DEFAULT '{"answers": []}'::jsonb;
      `);

      // Create GIN index for JSONB queries
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_submissions_content 
        ON grading.submissions USING GIN (content);
      `);
    }

    // Check if answer_status column exists
    const answerStatusExists = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'grading' 
      AND table_name = 'submissions' 
      AND column_name = 'answer_status'
    `);

    if (answerStatusExists.length === 0) {
      // Add answer_status column
      await queryRunner.query(`
        ALTER TABLE grading.submissions
        ADD COLUMN answer_status VARCHAR(50) DEFAULT 'submitted'
          CHECK (answer_status IN ('in_progress', 'submitted', 'graded'));
      `);

      // Create index
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_submissions_answer_status 
        ON grading.submissions(answer_status);
      `);
    }

    // Check if question_count column exists
    const questionCountExists = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'grading' 
      AND table_name = 'submissions' 
      AND column_name = 'question_count'
    `);

    if (questionCountExists.length === 0) {
      // Add question_count column
      await queryRunner.query(`
        ALTER TABLE grading.submissions
        ADD COLUMN question_count INTEGER DEFAULT 0;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the columns (cascade to indexes)
    await queryRunner.query(`
      ALTER TABLE grading.assignments
      DROP COLUMN IF EXISTS content CASCADE;
    `);

    await queryRunner.query(`
      ALTER TABLE grading.submissions
      DROP COLUMN IF EXISTS content CASCADE,
      DROP COLUMN IF EXISTS answer_status CASCADE,
      DROP COLUMN IF EXISTS question_count CASCADE;
    `);
  }
}
