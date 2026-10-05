#!/usr/bin/env node
/**
 * Manual migration runner for migration 16
 * Runs RefactorGradesForMultiQuestion migration
 * Avoids issues with schema creation in earlier migrations
 */

const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function runMigration() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('✓ Connected to database');

    // Check if grading schema exists
    const schemaCheck = await client.query(`
      SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = 'grading');
    `);

    if (!schemaCheck.rows[0].exists) {
      console.error('✗ grading schema does not exist. Please create it first.');
      process.exit(1);
    }
    console.log('✓ grading schema exists');

    // Check if grades table exists
    const tableCheck = await client.query(`
      SELECT EXISTS(SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'grading' AND table_name = 'grades');
    `);

    if (!tableCheck.rows[0].exists) {
      console.error('✗ grading.grades table does not exist. Run earlier migrations first.');
      process.exit(1);
    }
    console.log('✓ grading.grades table exists');

    // Check if question_id column already exists
    const colCheck = await client.query(`
      SELECT EXISTS(SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'grading' AND table_name = 'grades' AND column_name = 'question_id');
    `);

    if (colCheck.rows[0].exists) {
      console.log('✓ Migration 16 already applied (question_id column exists)');
      process.exit(0);
    }

    console.log('\n--- Running Migration 16: RefactorGradesForMultiQuestion ---\n');

    // Step 1: Add new columns for multi-question support
    console.log('1/6: Adding new columns (question_id, grade_type, grade_details)...');
    await client.query(`
      ALTER TABLE grading.grades
      ADD COLUMN question_id VARCHAR(100) DEFAULT NULL,
      ADD COLUMN grade_type VARCHAR(50) DEFAULT 'overall_submission'
        CHECK (grade_type IN ('overall_submission', 'per_question')),
      ADD COLUMN grade_details JSONB DEFAULT NULL;
    `);
    console.log('✓ Columns added');

    // Step 2: Add indexes for question lookups
    console.log('2/6: Creating indexes...');
    await client.query(`
      CREATE INDEX idx_grades_question_id ON grading.grades(question_id);
      CREATE INDEX idx_grades_grade_type ON grading.grades(grade_type);
    `);
    console.log('✓ Indexes created');

    // Step 3: Drop the existing UNIQUE constraint on submission_id
    console.log('3/6: Removing old unique constraint...');
    await client.query(`
      ALTER TABLE grading.grades
      DROP CONSTRAINT IF EXISTS "UQ_grades_submission_id";
    `);
    console.log('✓ Old constraint removed');

    // Step 4: Create new UNIQUE constraint for per-question grading
    console.log('4/6: Creating new unique constraint for per-question grading...');
    await client.query(`
      ALTER TABLE grading.grades
      ADD CONSTRAINT unique_grades_submission_question
        UNIQUE NULLS NOT DISTINCT (submission_id, question_id);
    `);
    console.log('✓ New constraint created');

    // Step 5: Add comments
    console.log('5/6: Adding column comments...');
    await client.query(`
      COMMENT ON COLUMN grading.grades.question_id IS 'For per-question grading: references question in assignment.content. NULL for overall submission grades.';
      COMMENT ON COLUMN grading.grades.grade_type IS 'overall_submission | per_question - indicates scope of this grade';
      COMMENT ON COLUMN grading.grades.grade_details IS 'Additional grading data as JSON: { rubricScores: [], autoGradingOutput: {} }';
    `);
    console.log('✓ Comments added');

    // Step 6: Create helper functions
    console.log('6/6: Creating helper functions...');
    
    // Calculate composite grade function
    await client.query(`
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

    // Aggregate to overall grade function
    await client.query(`
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
    console.log('✓ Helper functions created');

    console.log('\n✓ Migration 16 completed successfully!\n');

    // Verify the changes
    console.log('--- Verification ---');
    const colInfo = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'grading' AND table_name = 'grades'
      AND column_name IN ('question_id', 'grade_type', 'grade_details')
      ORDER BY ordinal_position;
    `);

    if (colInfo.rows.length === 3) {
      console.log('✓ All 3 new columns are present:');
      colInfo.rows.forEach(row => {
        console.log(`  - ${row.column_name} (${row.data_type}, nullable: ${row.is_nullable})`);
      });
    } else {
      console.warn('⚠ Expected 3 columns but found ' + colInfo.rows.length);
    }

  } catch (error) {
    console.error('\n✗ Migration failed:', error.message);
    if (error.detail) {
      console.error('Detail:', error.detail);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
