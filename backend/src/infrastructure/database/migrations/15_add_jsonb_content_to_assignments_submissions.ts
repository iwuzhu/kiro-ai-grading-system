import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 15: Add JSONB Content to Assignments and Submissions
 *
 * This migration transforms the assignment and submission tables from
 * single-type to multi-question architecture:
 *
 * ASSIGNMENTS TABLE CHANGES:
 * - Remove: type ENUM column (no longer single-type)
 * - Add: content JSONB (stores array of questions)
 * - Add: published_status (draft | published | archived)
 *
 * SUBMISSIONS TABLE CHANGES:
 * - Modify: content from TEXT to JSONB (stores array of answers)
 * - Add: answer_status to track submission progress
 * - Add: question_count for quick reference
 *
 * MIGRATION STRATEGY:
 * 1. For existing assignments: wrap single type into first question
 * 2. For existing submissions: wrap single answer into answers array
 * 3. Preserve all existing data in new structure
 * 4. Maintain audit trail and timestamps
 */
export class AddJsonbContentToAssignmentsSubmissions1728144000001
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========== ASSIGNMENTS TABLE MODIFICATIONS ==========

    // Step 1: Add new columns
    await queryRunner.query(`
      ALTER TABLE grading.assignments
      ADD COLUMN content JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN published_status VARCHAR(50) DEFAULT 'draft'
        CHECK (published_status IN ('draft', 'published', 'archived'));
    `);

    // Step 2: Migrate existing assignment data from single-type to multi-question format
    // Convert existing single assignment type to a single question in the content array
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
      ),
      published_status = CASE WHEN published_at IS NOT NULL THEN 'published' ELSE 'draft' END
      WHERE deleted_at IS NULL;
    `);

    // Step 3: Create enum type for assignment published status
    await queryRunner.query(`
      CREATE TYPE grading.assignment_published_status_enum AS ENUM ('draft', 'published', 'archived');
    `);

    // Step 4: Drop the old type ENUM and column (it's now in content)
    await queryRunner.query(`
      ALTER TABLE grading.assignments
      DROP COLUMN type;
    `);

    // Drop old enum (will succeed even if already dropped)
    await queryRunner.query(`
      DROP TYPE IF EXISTS grading.assignments_type_enum;
    `);

    // Step 5: Add comments
    await queryRunner.query(`
      COMMENT ON COLUMN grading.assignments.content IS 'JSONB array of question objects. Each question has: id, type, prompt, options[], etc. - depends on type';
      COMMENT ON COLUMN grading.assignments.published_status IS 'Assignment status: draft (editing) | published (visible to students) | archived (closed)';
    `);

    // Step 6: Create index on content for faster queries if filtering by question type
    await queryRunner.query(`
      CREATE INDEX idx_assignments_content ON grading.assignments USING GIN (content);
    `);

    // ========== SUBMISSIONS TABLE MODIFICATIONS ==========

    // Step 1: Verify content column exists (from migration 12)
    // If it exists and is TEXT, convert to JSONB and migrate data
    await queryRunner.query(`
      ALTER TABLE grading.submissions
      ADD COLUMN IF NOT EXISTS answer_status VARCHAR(50) DEFAULT 'incomplete'
        CHECK (answer_status IN ('in_progress', 'submitted', 'graded'));

      ALTER TABLE grading.submissions
      ADD COLUMN IF NOT EXISTS question_count INTEGER DEFAULT 0;
    `);

    // Step 2: Migrate existing submissions
    // Convert content from TEXT to JSONB with answers array
    // If content is NULL or empty, create empty answers array
    await queryRunner.query(`
      ALTER TABLE grading.submissions
      ALTER COLUMN content TYPE JSONB USING
      CASE
        WHEN content IS NULL OR content = '' THEN '{}'::jsonb
        WHEN content::jsonb ? 'answers' THEN content::jsonb
        ELSE jsonb_build_object(
          'answers', jsonb_build_array(
            jsonb_build_object(
              'questionId', '0',
              'type', 'FILE',
              'answer', content,
              'submittedAt', submitted_at
            )
          ),
          'startedAt', created_at,
          'completedAt', submitted_at
        )
      END;
    `);

    // Step 3: Update question_count based on content
    await queryRunner.query(`
      UPDATE grading.submissions
      SET question_count = COALESCE(jsonb_array_length(content -> 'answers'), 0)
      WHERE content IS NOT NULL;
    `);

    // Step 4: Add comments
    await queryRunner.query(`
      COMMENT ON COLUMN grading.submissions.content IS 'JSONB object with answers array. Structure: { answers: [], startedAt, completedAt }';
      COMMENT ON COLUMN grading.submissions.answer_status IS 'Submission status: in_progress | submitted | graded';
      COMMENT ON COLUMN grading.submissions.question_count IS 'Number of questions answered (cached for performance)';
    `);

    // Step 5: Create index on content
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_submissions_content ON grading.submissions USING GIN (content);
      CREATE INDEX idx_submissions_answer_status ON grading.submissions(answer_status);
    `);

    // ========== ADD RLS POLICIES FOR NEW COLUMNS ==========

    // Policies already exist for tenant_id, so no additional RLS needed
    // Content is accessible via existing assignment/submission access controls
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ========== REVERSE ASSIGNMENTS CHANGES ==========

    // Step 1: Recreate old type ENUM
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

    // Step 2: Add back type column with data from first question in content
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

    // Step 3: Drop columns
    await queryRunner.query(`
      ALTER TABLE grading.assignments
      DROP COLUMN IF EXISTS content,
      DROP COLUMN IF EXISTS published_status;
    `);

    // Step 4: Drop enum
    await queryRunner.query(`
      DROP TYPE IF EXISTS grading.assignment_published_status_enum;
    `);

    // ========== REVERSE SUBMISSIONS CHANGES ==========

    // Step 1: Convert content back to TEXT
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

    // Step 2: Drop new columns
    await queryRunner.query(`
      ALTER TABLE grading.submissions
      DROP COLUMN IF EXISTS answer_status,
      DROP COLUMN IF EXISTS question_count;
    `);

    // Step 3: Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS grading.idx_submissions_answer_status;
    `);
  }
}
