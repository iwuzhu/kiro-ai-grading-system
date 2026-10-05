import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Update Assignments and Submissions Schema
 *
 * Converts the assignment and submission tables to use JSONB content fields:
 *
 * ASSIGNMENTS:
 * - Remove: type ENUM (old single-question architecture)
 * - Ensure: content JSONB with array of question objects
 *   Structure: { questions: [{ id, type, prompt, pointValue, ... }] }
 *
 * SUBMISSIONS:
 * - Convert: content from TEXT to JSONB
 * - Ensure: content has answers array structure
 *   Structure: { answers: [{ questionId, type, answer, submittedAt }] }
 *
 * This completes the multi-question JSON architecture:
 * - Questions stored in assignments.content
 * - Answers stored in submissions.content
 * - Grades link to submissions (not assignments directly)
 */
export class UpdateAssignmentsSubmissionsSchema1735805000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ===== ASSIGNMENTS TABLE UPDATES =====

    // Check if type column exists
    const typeColumnExists = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'grading' 
      AND table_name = 'assignments' 
      AND column_name = 'type'
    `);

    if (typeColumnExists.length > 0) {
      // Type column exists, need to drop it
      // First, migrate any existing data from type to content if needed
      await queryRunner.query(`
        UPDATE grading.assignments
        SET content = jsonb_build_array(
          jsonb_build_object(
            'id', id::text || '-q1',
            'type', type,
            'prompt', COALESCE(description, ''),
            'pointValue', COALESCE(point_value, 0),
            'createdAt', NOW()
          )
        )
        WHERE content IS NULL OR content = '[]'::jsonb;
      `);

      // Drop the type column
      await queryRunner.query(`
        ALTER TABLE grading.assignments
        DROP COLUMN type CASCADE;
      `);

      // Drop the old type enum if it exists
      await queryRunner.query(`
        DROP TYPE IF EXISTS grading.assignments_type_enum CASCADE;
      `);
    }

    // Ensure content column exists and is JSONB
    const contentColumnExists = await queryRunner.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_schema = 'grading' 
      AND table_name = 'assignments' 
      AND column_name = 'content'
    `);

    if (contentColumnExists.length === 0) {
      // Content column doesn't exist, add it
      await queryRunner.query(`
        ALTER TABLE grading.assignments
        ADD COLUMN content JSONB DEFAULT '[]'::jsonb;
      `);
    } else if (
      contentColumnExists.length > 0 &&
      contentColumnExists[0].data_type !== 'jsonb'
    ) {
      // Content column exists but wrong type, convert it
      await queryRunner.query(`
        ALTER TABLE grading.assignments
        ALTER COLUMN content TYPE JSONB USING content::jsonb;
      `);
    }

    // Create GIN index on assignments.content for JSONB queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_assignments_content 
      ON grading.assignments USING GIN (content);
    `);

    // ===== SUBMISSIONS TABLE UPDATES =====

    // Check if content column exists and its type
    const submissionContentExists = await queryRunner.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_schema = 'grading' 
      AND table_name = 'submissions' 
      AND column_name = 'content'
    `);

    if (submissionContentExists.length === 0) {
      // Content column doesn't exist, add it as JSONB
      await queryRunner.query(`
        ALTER TABLE grading.submissions
        ADD COLUMN content JSONB DEFAULT '{"answers": []}'::jsonb;
      `);
    } else if (
      submissionContentExists.length > 0 &&
      submissionContentExists[0].data_type !== 'jsonb'
    ) {
      // Content column exists as TEXT, convert to JSONB
      // Wrap existing text content in answers array structure
      await queryRunner.query(`
        ALTER TABLE grading.submissions
        ALTER COLUMN content TYPE JSONB USING
        CASE
          WHEN content IS NULL OR content = '' THEN '{"answers": []}'::jsonb
          WHEN content::jsonb ? 'answers' THEN content::jsonb
          ELSE jsonb_build_object(
            'answers', jsonb_build_array(
              jsonb_build_object(
                'questionId', '0',
                'type', 'FILE',
                'answer', content,
                'submittedAt', NOW()
              )
            )
          )
        END;
      `);
    }

    // Ensure answer_status column exists
    const answerStatusExists = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'grading' 
      AND table_name = 'submissions' 
      AND column_name = 'answer_status'
    `);

    if (answerStatusExists.length === 0) {
      await queryRunner.query(`
        ALTER TABLE grading.submissions
        ADD COLUMN answer_status VARCHAR(50) DEFAULT 'submitted'
          CHECK (answer_status IN ('in_progress', 'submitted', 'graded'));
      `);
    }

    // Ensure question_count column exists
    const questionCountExists = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'grading' 
      AND table_name = 'submissions' 
      AND column_name = 'question_count'
    `);

    if (questionCountExists.length === 0) {
      await queryRunner.query(`
        ALTER TABLE grading.submissions
        ADD COLUMN question_count INTEGER DEFAULT 0;
      `);

      // Populate question_count from content
      await queryRunner.query(`
        UPDATE grading.submissions
        SET question_count = COALESCE(jsonb_array_length(content -> 'answers'), 0)
        WHERE content IS NOT NULL;
      `);
    }

    // Create GIN index on submissions.content for JSONB queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_submissions_content 
      ON grading.submissions USING GIN (content);
    `);

    // Create index on answer_status
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_submissions_answer_status 
      ON grading.submissions(answer_status);
    `);

    // ===== VERIFY SCHEMA =====
    console.log('[Migration 19] ✓ Assignments schema updated (type removed, content JSONB)');
    console.log('[Migration 19] ✓ Submissions schema updated (content TEXT->JSONB)');
    console.log('[Migration 19] ✓ Indices created for JSONB queries');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ===== REVERSE ASSIGNMENTS CHANGES =====

    // Recreate type enum
    await queryRunner.query(`
      CREATE TYPE grading.assignments_type_enum AS ENUM (
        'ESSAY',
        'CODE',
        'MULTIPLE_CHOICE',
        'FILL_BLANK',
        'SHORT_ANSWER',
        'FILE'
      );
    `);

    // Add back type column
    await queryRunner.query(`
      ALTER TABLE grading.assignments
      ADD COLUMN type grading.assignments_type_enum DEFAULT 'ESSAY';

      UPDATE grading.assignments
      SET type = (
        CASE
          WHEN content IS NOT NULL AND jsonb_array_length(content) > 0
          THEN (content -> 0 ->> 'type')::grading.assignments_type_enum
          ELSE 'ESSAY'::grading.assignments_type_enum
        END
      );

      ALTER TABLE grading.assignments
      ALTER COLUMN type SET NOT NULL;
    `);

    // Drop content column
    await queryRunner.query(`
      ALTER TABLE grading.assignments
      DROP COLUMN content CASCADE;
    `);

    // ===== REVERSE SUBMISSIONS CHANGES =====

    // Convert content back to TEXT
    await queryRunner.query(`
      ALTER TABLE grading.submissions
      ALTER COLUMN content TYPE TEXT USING
      CASE
        WHEN content IS NULL THEN NULL
        WHEN content::jsonb ? 'answers' AND jsonb_array_length(content -> 'answers') > 0
        THEN (content -> 'answers' -> 0 ->> 'answer')
        ELSE content::text
      END;
    `);

    // Drop new columns
    await queryRunner.query(`
      ALTER TABLE grading.submissions
      DROP COLUMN IF EXISTS answer_status CASCADE,
      DROP COLUMN IF EXISTS question_count CASCADE;
    `);

    // Drop indices
    await queryRunner.query(`
      DROP INDEX IF EXISTS grading.idx_submissions_answer_status CASCADE;
    `);
  }
}
