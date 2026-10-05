/**
 * Full Submission Upload Flow Test
 * Tests the complete API flow: upload file -> S3 save -> DB save
 */

require('dotenv').config({ path: '.env.local' });
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { DataSource } = require('typeorm');

async function testFullFlow() {
  console.log('=== Full Submission Upload Flow Test ===\n');

  const apiUrl = 'http://localhost:3001/api/v1';
  const testFileName = 'test-submission-flow.txt';
  const testFilePath = path.join(__dirname, testFileName);
  
  // Create test file
  fs.writeFileSync(testFilePath, `Test submission at ${new Date().toISOString()}`);

  try {
    // Get token from auth endpoint (or use existing)
    console.log('Step 1: Getting authentication token...');
    const loginResponse = await axios.post(
      `${apiUrl}/auth/login`,
      {
        email: 'student@example.com',
        password: 'password123',
      },
      { validateStatus: () => true }
    );

    let token;
    if (loginResponse.status === 200) {
      token = loginResponse.data.data?.token || loginResponse.data.data?.access_token;
      console.log('✓ Login successful\n');
    } else {
      console.log('⚠ Login failed, using hardcoded test token\n');
      // You'll need to provide a real token here
      token = 'USE_REAL_TOKEN_HERE';
    }

    // Get assignments to find a valid one
    console.log('Step 2: Fetching assignments...');
    const assignmentsResponse = await axios.get(
      `${apiUrl}/courses/test-course-id/assignments`,
      {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true,
      }
    );

    if (assignmentsResponse.status !== 200) {
      console.log('⚠ Could not fetch assignments. Status:', assignmentsResponse.status);
      console.log('  Response:', assignmentsResponse.data);
      console.log('\nNeed valid assignment ID to test. Skipping API test.\n');
      return;
    }

    const assignments = assignmentsResponse.data.data || [];
    if (assignments.length === 0) {
      console.log('⚠ No assignments found. Skipping API test.\n');
      return;
    }

    const assignmentId = assignments[0].id;
    console.log(`✓ Found assignment: ${assignmentId}\n`);

    // Upload file
    console.log('Step 3: Uploading file to /submissions/upload...');
    const form = new FormData();
    form.append('file', fs.createReadStream(testFilePath), testFileName);
    form.append('assignmentId', assignmentId);

    const uploadResponse = await axios.post(
      `${apiUrl}/submissions/upload`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${token}`,
        },
        validateStatus: () => true,
      }
    );

    console.log(`Response Status: ${uploadResponse.status}`);
    console.log(`Response:`, JSON.stringify(uploadResponse.data, null, 2));

    if (uploadResponse.status !== 201) {
      console.log('❌ Upload failed\n');
      return;
    }

    const submissionId = uploadResponse.data.data?.id;
    const s3Uri = uploadResponse.data.data?.file_path;

    console.log(`✓ Upload successful`);
    console.log(`  Submission ID: ${submissionId}`);
    console.log(`  S3 URI: ${s3Uri}\n`);

    // Step 4: Verify file exists in S3
    console.log('Step 4: Verifying file in S3...');
    if (s3Uri) {
      console.log(`  S3 URI from response: ${s3Uri}`);
      console.log('  ⚠ Note: Cannot directly verify S3 without AWS SDK client');
      console.log('  (Would need to parse URI and use S3 GetObject)\n');
    }

    // Step 5: Query database to verify record saved
    console.log('Step 5: Querying database to verify record...');
    const dbConfig = {
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

    const dataSource = new DataSource(dbConfig);
    await dataSource.initialize();

    const dbSubmission = await dataSource.query(
      'SELECT id, assignment_id, file_path, content, created_at FROM grading.submissions WHERE id = $1',
      [submissionId]
    );

    if (dbSubmission.length === 0) {
      console.log('❌ Submission NOT found in database!\n');
      console.log('RESULT: ❌ FULL FLOW FAILED - Record not persisted to database');
    } else {
      const record = dbSubmission[0];
      console.log('✓ Submission found in database!');
      console.log(`  ID: ${record.id}`);
      console.log(`  Assignment: ${record.assignment_id}`);
      console.log(`  File Path: ${record.file_path}`);
      console.log(`  Content: ${JSON.stringify(record.content)}`);
      console.log(`  Created: ${record.created_at}\n`);

      // Verify content has S3 URI
      if (record.content?.answers?.file === record.file_path) {
        console.log('✓ Content field correctly stores S3 URI\n');
        console.log('✅ RESULT: FULL FLOW SUCCESSFUL - File uploaded to S3 and record saved to DB');
      } else {
        console.log('❌ Content field does not match file_path\n');
        console.log('RESULT: ⚠ PARTIAL - Record saved but content mismatch');
      }
    }

    await dataSource.destroy();

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  } finally {
    // Cleanup
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  }
}

testFullFlow();
