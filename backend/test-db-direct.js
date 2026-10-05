/**
 * Direct Database Save Test
 * Tests if we can actually save and retrieve from grading.submissions
 */

require('dotenv').config({ path: '.env.local' });
const { DataSource } = require('typeorm');

async function testDatabaseSave() {
  console.log('=== Database Save Test ===\n');

  // Configuration
  const config = {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    schema: 'grading',
    logging: false,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  };

  console.log('Database Configuration:');
  console.log(`  Host: ${config.host}`);
  console.log(`  Port: ${config.port}`);
  console.log(`  Database: ${config.database}`);
  console.log(`  Schema: ${config.schema}`);
  console.log('');

  const dataSource = new DataSource(config);

  try {
    console.log('Connecting to database...');
    await dataSource.initialize();
    console.log('✓ Connected\n');

    // First, get real data from the database
    console.log('Fetching real test data from database...');
    
    const assignments = await dataSource.query(
      'SELECT id, tenant_id FROM grading.assignments LIMIT 1'
    );
    
    if (assignments.length === 0) {
      console.log('❌ No assignments found in database. Cannot test.');
      console.log('    Please create an assignment first.');
      return;
    }

    const assignment = assignments[0];
    console.log(`✓ Found assignment: ${assignment.id}\n`);

    const users = await dataSource.query(
      'SELECT id, role FROM grading.users LIMIT 1'
    );
    
    if (users.length === 0) {
      console.log('❌ No students found in database. Cannot test.');
      console.log('    Please create a student user first.');
      return;
    }

    const student = users[0];
    console.log(`✓ Found student: ${student.id}\n`);

    // Insert test record using real data
    const testId = require('crypto').randomUUID();
    const tenantId = assignment.tenant_id;
    const assignmentId = assignment.id;
    const studentId = student.id;
    const s3Uri = `s3://tecbridge-general/websites/externals/deepgrader/test/${Date.now()}/test-submission.txt`;
    const content = {
      answers: {
        file: s3Uri,
        submittedAt: new Date().toISOString(),
      },
    };

    console.log('Inserting test submission...');
    console.log(`  ID: ${testId}`);
    console.log(`  Tenant: ${tenantId}`);
    console.log(`  Assignment: ${assignmentId}`);
    console.log(`  Student: ${studentId}`);
    console.log(`  Content: ${JSON.stringify(content)}`);
    console.log('');

    // Insert using raw query to avoid TypeORM entity issues
    const insertQuery = `
      INSERT INTO grading.submissions (
        id, tenant_id, assignment_id, student_id, version,
        file_path, file_type, content, answer_status,
        is_incremental, is_late, submitted_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *;
    `;

    const now = new Date();
    
    // Get next available version for this student/assignment
    const versionResult = await dataSource.query(
      `SELECT COALESCE(MAX(version), 0) + 1 as next_version
       FROM grading.submissions
       WHERE assignment_id = $1 AND student_id = $2`,
      [assignmentId, studentId]
    );
    const nextVersion = versionResult[0].next_version;
    
    const result = await dataSource.query(insertQuery, [
      testId,                    // id
      tenantId,                  // tenant_id
      assignmentId,              // assignment_id
      studentId,                 // student_id
      nextVersion,               // version
      s3Uri,                     // file_path
      'text/plain',              // file_type
      JSON.stringify(content),   // content
      'submitted',               // answer_status
      false,                     // is_incremental
      false,                      // is_late
      now,                       // submitted_at
      now,                       // created_at
      now,                       // updated_at
    ]);

    console.log('✓ Insert successful!\n');
    console.log('Returned record:');
    console.log(`  ID: ${result[0].id}`);
    console.log(`  Tenant: ${result[0].tenant_id}`);
    console.log(`  Created at: ${result[0].created_at}`);
    console.log('');

    // Now query to verify
    console.log('Querying to verify record was saved...');
    const selectQuery = `
      SELECT id, tenant_id, assignment_id, student_id, file_path, content, created_at
      FROM grading.submissions
      WHERE id = $1
    `;

    const verifyResult = await dataSource.query(selectQuery, [testId]);

    if (verifyResult.length === 0) {
      console.log('❌ Record NOT found after insert!\n');
      console.log('✅ FAILED: Database save not working');
    } else {
      const record = verifyResult[0];
      console.log('✓ Record found!\n');
      console.log('Retrieved record:');
      console.log(`  ID: ${record.id}`);
      console.log(`  Tenant: ${record.tenant_id}`);
      console.log(`  Assignment: ${record.assignment_id}`);
      console.log(`  Student: ${record.student_id}`);
      console.log(`  File Path: ${record.file_path}`);
      console.log(`  Content: ${JSON.stringify(record.content)}`);
      console.log(`  Created at: ${record.created_at}`);
      console.log('');

      // Verify content matches
      if (record.content.answers.file === s3Uri) {
        console.log('✅ DATABASE SAVE AND RETRIEVAL WORKING CORRECTLY');
      } else {
        console.log('❌ Content mismatch!');
      }
    }

    // Count total submissions
    console.log('');
    console.log('Total submissions in database:');
    const countResult = await dataSource.query(
      'SELECT COUNT(*) as count FROM grading.submissions'
    );
    console.log(`  ${countResult[0].count} submissions`);

  } catch (error) {
    console.error('❌ DATABASE ERROR:');
    console.error(`  Error Type: ${error.constructor.name}`);
    console.error(`  Error Message: ${error.message}`);
    console.error('');
    console.error('Full error:');
    console.error(error);
    console.error('');

    if (error.message.includes('ECONNREFUSED')) {
      console.error('🔧 SUGGESTION: Cannot connect to database. Check DB_HOST, DB_PORT, DB credentials');
    } else if (error.message.includes('does not exist')) {
      console.error('🔧 SUGGESTION: Table or schema does not exist. Check grading schema and submissions table');
    } else if (error.message.includes('permission denied')) {
      console.error('🔧 SUGGESTION: Database user does not have permission to insert');
    }
  } finally {
    await dataSource.destroy();
  }
}

testDatabaseSave();
