import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add Content JSONB Field to Assignments
 *
 * This migration adds the `content` JSONB field to grading.assignments table.
 * The content field stores an array of question objects for multi-question assignments.
 *
 * Content structure:
 * {
 *   "questions": [
 *     {
 *       "id": "q-1",
 *       "type": "MULTIPLE_CHOICE",
 *       "prompt": "Question text",
 *       "pointValue": 10,
 *       "options": ["A", "B", "C"],
 *       "correctAnswer": "B"
 *     },
 *     ...
 *   ]
 * }
 */
export class AddContentJsonbToAssignments1735806000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add content JSONB column if it doesn't exist
    await queryRunner.query(`
      ALTER TABLE grading.assignments
      ADD COLUMN IF NOT EXISTS content JSONB DEFAULT '[]'::jsonb;
    `);

    // Create GIN index for JSONB query performance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_assignments_content 
      ON grading.assignments USING GIN (content);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the content column (cascade removes the index)
    await queryRunner.query(`
      ALTER TABLE grading.assignments
      DROP COLUMN IF EXISTS content CASCADE;
    `);
  }
}
