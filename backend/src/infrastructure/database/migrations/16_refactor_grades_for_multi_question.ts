import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 16: Refactor Grades Table for Multi-Question Support
 *
 * Transforms grading from submission-level to question-level:
 *
 * STRATEGY:
 * 1. Keep existing submission-level grades for backward compatibility
 * 2. Add question_id (nullable) to support per-question grading
 * 3. Remove UNIQUE constraint on submission_id to allow multiple grades per submission
 * 4. Create new UNIQUE constraint: (submission_id, question_id) where question_id is not null
 * 5. Add grade_details JSONB to store per-question grading breakdown
 * 6. Track grading type (overall_submission | per_question)
 *
 * BACKWARD COMPATIBILITY:
 * - Existing grades: question_id = NULL, type = 'overall_submission'
 * - New grades: question_id filled, type = 'per_question'
 * - Composite grades can aggregate per-question grades
 */
export class RefactorGradesForMultiQuestion1728144000002
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========== GRADES TABLE MODIFICATIONS ==========

    // Step 1: Add new columns for multi-question support
    await queryRunner.query(`
      ALTER TABLE grading.grades
      ADD COLUMN question_id VARCHAR(100) DEFAULT NULL,
      ADD COLUMN grade_type VARCHAR(50) DEFAULT 'overall_submission'
        CHECK (grade_type IN ('overall_submission', 'per_question')),
      ADD COLUMN grade_details JSONB DEFAULT NULL;
    `);

    // Step 2: Add index for question lookups
    await queryRunner.query(`
      CREATE INDEX idx_grades_question_id ON grading.grades(question_id);
      CREATE INDEX idx_grades_grade_type ON grading.grades(grade_type);
    `);

    // Step 3: Drop the existing UNIQUE constraint on submission_id
    // (allow multiple grades per submission for per-question grading)
    await queryRunner.query(`
      ALTER TABLE grading.grades
      DROP CONSTRAINT IF EXISTS "UQ_grades_submission_id";
    `);

    // Step 4: Create new UNIQUE constraint for per-question grading
    // Allows:
    // - Multiple rows with same submission_id but different question_id
    // - One row per submission with question_id = NULL (overall)
    await queryRunner.query(`
      ALTER TABLE grading.grades
      ADD CONSTRAINT unique_grades_submission_question
        UNIQUE NULLS NOT DISTINCT (submission_id, question_id);
    `);

    // Step 5: Add comments
    await queryRunner.query(`
      COMMENT ON COLUMN grading.grades.question_id IS 'For per-question grading: references question in assignment.content. NULL for overall submission grades.';
      COMMENT ON COLUMN grading.grades.grade_type IS 'overall_submission | per_question - indicates scope of this grade';
      COMMENT ON COLUMN grading.grades.grade_details IS 'Additional grading data as JSON: { rubricScores: [], autoGradingOutput: {} }';
    `);

    // Step 6: Add RLS considerations
    // No additional RLS needed - existing tenant_id inheritance still applies

    // ========== GRADES QUERY HELPER FUNCTIONS ==========

    // Create function to calculate composite grade from per-question grades
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION grading.calculate_composite_grade(
        p_submission_id UUID,
        p_method VARCHAR DEFAULT 'weighted_average'
      )
      RETURNS TABLE (
        final_score DECIMAL,
        max_score DECIMAL,
        percentage DECIMAL,
        question_count INT
      )
      LANGUAGE SQL
      STABLE
      AS $$
        SELECT
          SUM(COALESCE(g.final_score, g.ai_score, 0))::DECIMAL as final_score,
          -- Calculate max_score from assignment questions
          (
            SELECT SUM((q ->> 'pointValue')::DECIMAL)
            FROM grading.submissions s
            JOIN grading.assignments a ON s.assignment_id = a.id
            JOIN LATERAL jsonb_array_elements(a.content) q ON TRUE
            WHERE s.id = p_submission_id
          )::DECIMAL as max_score,
          ROUND(
            (SUM(COALESCE(g.final_score, g.ai_score, 0)) /
            NULLIF((
              SELECT SUM((q ->> 'pointValue')::DECIMAL)
              FROM grading.submissions s
              JOIN grading.assignments a ON s.assignment_id = a.id
              JOIN LATERAL jsonb_array_elements(a.content) q ON TRUE
              WHERE s.id = p_submission_id
            ), 0)) * 100, 2
          )::DECIMAL as percentage,
          COUNT(*)::INT as question_count
        FROM grading.grades g
        WHERE g.submission_id = p_submission_id
        AND g.question_id IS NOT NULL;
      $$;
    `);

    // Create function to aggregate per-question grades into overall grade
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION grading.aggregate_to_overall_grade(
        p_submission_id UUID,
        p_graded_by_user_id UUID
      )
      RETURNS TABLE (
        overall_score DECIMAL,
        confidence DECIMAL,
        feedback TEXT
      )
      LANGUAGE SQL
      STABLE
      AS $$
        SELECT
          SUM(COALESCE(g.final_score, g.ai_score, 0))::DECIMAL as overall_score,
          AVG(COALESCE(g.confidence, 0))::DECIMAL as confidence,
          STRING_AGG(g.feedback, E'\\n\\n' ORDER BY g.created_at) as feedback
        FROM grading.grades g
        WHERE g.submission_id = p_submission_id
        AND g.question_id IS NOT NULL;
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Drop helper functions
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS grading.calculate_composite_grade(UUID, VARCHAR) CASCADE;
      DROP FUNCTION IF EXISTS grading.aggregate_to_overall_grade(UUID, UUID) CASCADE;
    `);

    // Step 2: Drop new UNIQUE constraint
    await queryRunner.query(`
      ALTER TABLE grading.grades
      DROP CONSTRAINT IF EXISTS unique_grades_submission_question;
    `);

    // Step 3: Recreate original UNIQUE constraint on submission_id
    await queryRunner.query(`
      ALTER TABLE grading.grades
      ADD CONSTRAINT "UQ_grades_submission_id" UNIQUE (submission_id);
    `);

    // Step 4: Drop new columns
    await queryRunner.query(`
      ALTER TABLE grading.grades
      DROP COLUMN IF EXISTS question_id,
      DROP COLUMN IF EXISTS grade_type,
      DROP COLUMN IF EXISTS grade_details;
    `);

    // Step 5: Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS grading.idx_grades_question_id;
      DROP INDEX IF EXISTS grading.idx_grades_grade_type;
    `);
  }
}
