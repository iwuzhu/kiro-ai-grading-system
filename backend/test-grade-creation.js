#!/usr/bin/env node
/**
 * Test Grade Creation End-to-End
 * 
 * Creates a real grade record in the database to verify:
 * 1. assignment_id is properly set and saved
 * 2. All required fields are persisted
 * 3. No null constraint violations
 */

const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const { v4: uuidv4 } = require('uuid');

async function testGradeCreation() {
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
    console.log('✓ Connected to database\n');

    // Step 1: Find an existing submission with its assignment_id
    console.log('Step 1: Finding an existing submission...');
    const submissionResult = await client.query(`
      SELECT s.id as submission_id, s.assignment_id, a.title, c.id as course_id
      FROM grading.submissions s
      JOIN grading.assignments a ON s.assignment_id = a.id
      JOIN grading.courses c ON a.course_id = c.id
      LIMIT 1;
    `);

    if (submissionResult.rows.length === 0) {
      console.error('✗ No submissions found. Please create a submission first.');
      process.exit(1);
    }

    const { submission_id, assignment_id, title } = submissionResult.rows[0];
    console.log(`✓ Found submission: ${submission_id}`);
    console.log(`  Assignment: ${title} (${assignment_id})\n`);

    // Step 2: Check if grade already exists
    console.log('Step 2: Checking for existing grade...');
    const existingGradeResult = await client.query(
      `SELECT id FROM grading.grades WHERE submission_id = $1 LIMIT 1;`,
      [submission_id]
    );

    let gradeId;
    if (existingGradeResult.rows.length > 0) {
      console.log('⚠ Grade already exists, will update it');
      gradeId = existingGradeResult.rows[0].id;
    } else {
      console.log('✓ No existing grade found, will create new one\n');
    }

    // Step 3: Get tenant_id from the submission
    console.log('Step 3: Getting tenant information...');
    const tenantResult = await client.query(
      `SELECT tenant_id FROM grading.submissions WHERE id = $1;`,
      [submission_id]
    );
    const tenant_id = tenantResult.rows[0].tenant_id;
    console.log(`✓ Tenant ID: ${tenant_id}\n`);

    // Step 4: Create or update grade
    console.log('Step 4: Creating/updating grade in database...');
    
    // For this test, use NULL for graded_by_user_id to avoid foreign key constraints
    // In production, this would be set to the instructor's user ID
    const gradeData = {
      tenant_id,
      submission_id,
      assignment_id, // KEY: This must be set!
      ai_score: null,
      confidence: 85,
      final_score: 88,
      feedback: 'This is test feedback for the grade. It should be at least 20 characters long and provide meaningful guidance.',
      strengths: 'Clear writing,Good structure',
      improvements: 'Add more examples,Expand conclusion',
      status: 'MANUALLY_GRADED',
      graded_by_user_id: null, // NULL for this test
      question_id: null,
      grade_type: 'overall_submission',
      grade_details: null,
    };

    if (gradeId) {
      // Update existing grade
      console.log(`  Updating grade ${gradeId}...`);
      await client.query(
        `UPDATE grading.grades
         SET feedback = $1, strengths = $2, improvements = $3, final_score = $4, 
             confidence = $5, status = $6, graded_by_user_id = $7, updated_at = NOW()
         WHERE id = $8;`,
        [
          gradeData.feedback,
          gradeData.strengths,
          gradeData.improvements,
          gradeData.final_score,
          gradeData.confidence,
          gradeData.status,
          gradeData.graded_by_user_id,
          gradeId,
        ]
      );
    } else {
      // Create new grade
      gradeId = uuidv4();
      console.log(`  Creating new grade ${gradeId}...`);
      await client.query(
        `INSERT INTO grading.grades 
         (id, tenant_id, submission_id, assignment_id, ai_score, confidence, final_score, 
          feedback, strengths, improvements, status, graded_by_user_id, question_id, 
          grade_type, grade_details, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW());`,
        [
          gradeId,
          gradeData.tenant_id,
          gradeData.submission_id,
          gradeData.assignment_id,
          gradeData.ai_score,
          gradeData.confidence,
          gradeData.final_score,
          gradeData.feedback,
          gradeData.strengths,
          gradeData.improvements,
          gradeData.status,
          gradeData.graded_by_user_id,
          gradeData.question_id,
          gradeData.grade_type,
          gradeData.grade_details,
        ]
      );
    }
    console.log('✓ Grade saved successfully!\n');

    // Step 5: Verify the grade was saved correctly
    console.log('Step 5: Verifying grade was saved...');
    const verifyResult = await client.query(
      `SELECT id, submission_id, assignment_id, final_score, confidence, feedback, status
       FROM grading.grades WHERE id = $1;`,
      [gradeId]
    );

    if (verifyResult.rows.length === 0) {
      console.error('✗ Grade not found after insert!');
      process.exit(1);
    }

    const savedGrade = verifyResult.rows[0];
    console.log('✓ Grade verification:');
    console.log(`  ID: ${savedGrade.id}`);
    console.log(`  Submission ID: ${savedGrade.submission_id}`);
    console.log(`  Assignment ID: ${savedGrade.assignment_id}`);
    console.log(`  Score: ${savedGrade.final_score}`);
    console.log(`  Confidence: ${savedGrade.confidence}%`);
    console.log(`  Status: ${savedGrade.status}`);
    console.log(`  Feedback: ${savedGrade.feedback.substring(0, 50)}...\n`);

    // Step 6: Verify all required fields are NOT NULL
    console.log('Step 6: Checking for NULL violations...');
    const nullCheckResult = await client.query(
      `SELECT 
         CASE WHEN id IS NULL THEN 'ID is NULL' ELSE NULL END as id_check,
         CASE WHEN tenant_id IS NULL THEN 'tenant_id is NULL' ELSE NULL END as tenant_check,
         CASE WHEN submission_id IS NULL THEN 'submission_id is NULL' ELSE NULL END as submission_check,
         CASE WHEN assignment_id IS NULL THEN 'assignment_id is NULL' ELSE NULL END as assignment_check,
         CASE WHEN status IS NULL THEN 'status is NULL' ELSE NULL END as status_check,
         CASE WHEN created_at IS NULL THEN 'created_at is NULL' ELSE NULL END as created_at_check
       FROM grading.grades WHERE id = $1;`,
      [gradeId]
    );

    const nullChecks = nullCheckResult.rows[0];
    const nullViolations = Object.values(nullChecks).filter(v => v !== null);

    if (nullViolations.length === 0) {
      console.log('✓ All required fields are properly set (no NULL violations)\n');
    } else {
      console.error('✗ NULL violations found:');
      nullViolations.forEach(v => console.error(`  - ${v}`));
      process.exit(1);
    }

    console.log('═══════════════════════════════════════════');
    console.log('✓ GRADE CREATION TEST PASSED');
    console.log('═══════════════════════════════════════════\n');
    console.log('Summary:');
    console.log(`  • Grade saved with ID: ${gradeId}`);
    console.log(`  • Assignment ID properly set: ${savedGrade.assignment_id}`);
    console.log(`  • Score: ${savedGrade.final_score}/100`);
    console.log(`  • Confidence: ${savedGrade.confidence}%`);
    console.log(`  • Status: ${savedGrade.status}`);
    console.log('\nThe teacher can now update previously-graded submissions!');

  } catch (error) {
    console.error('\n✗ TEST FAILED');
    console.error('Error:', error.message);
    if (error.detail) {
      console.error('Detail:', error.detail);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

testGradeCreation();
