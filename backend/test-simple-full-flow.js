/**
 * Simple Full Flow Test
 * Uses the test endpoint to verify S3 + DB together
 */

require('dotenv').config({ path: '.env.local' });
const axios = require('axios');
const { DataSource } = require('typeorm');

async function testSimpleFullFlow() {
  console.log('=== Simple Full Flow Test ===\n');

  const apiUrl = 'http://localhost:3001/api/v1/test/submissions';

  try {
    // Step 1: Use test endpoint to save a submission
    console.log('Step 1: Calling test endpoint to save submission...');
    
    const testData = {
      tenantId: '550e8400-e29b-41d4-a716-446655440000',
      assignmentId: 'd04d42be-6137-406a-b4e9-8d5314f50271',
      studentId: '523e4567-e89b-12d3-a456-426614174005', // Different student
      fileName: `test-flow-${Date.now()}.txt`,
    };

    console.log(`  Tenant: ${testData.tenantId}`);
    console.log(`  Assignment: ${testData.assignmentId}`);
    console.log(`  Student: ${testData.studentId}`);
    console.log(`  File: ${testData.fileName}\n`);

    const saveResponse = await axios.post(
      `${apiUrl}/direct-save`,
      testData,
      { validateStatus: () => true }
    );

    console.log(`Response Status: ${saveResponse.status}`);

    if (saveResponse.status !== 201) {
      console.log(`Response:`, saveResponse.data);
      console.log('❌ Save failed\n');
      return;
    }

    const submissionId = saveResponse.data.submission?.id;
    const s3Uri = saveResponse.data.submission?.file_path;

    console.log('✓ Save successful');
    console.log(`  Submission ID: ${submissionId}`);
    console.log(`  S3 URI: ${s3Uri}\n`);

    if (!saveResponse.data.verified) {
      console.log('⚠ Record was saved but verification failed\n');
      return;
    }

    console.log('✓ Record was verified to exist in database\n');

    // Step 2: Query submissions endpoint to confirm it can be retrieved
    console.log('Step 2: Fetching all submissions...');
    const allResponse = await axios.get(
      `${apiUrl}/all`,
      { validateStatus: () => true }
    );

    if (allResponse.status === 200) {
      console.log(`✓ Found ${allResponse.data.count} total submissions in database\n`);

      // Find our test submission
      const found = allResponse.data.submissions?.find(s => s.id === submissionId);
      if (found) {
        console.log('✓ Our test submission found in list');
        console.log(`  Content: ${JSON.stringify(found.content)}\n`);
        console.log('✅ RESULT: FULL FLOW SUCCESSFUL');
        console.log('   - File uploaded to S3: YES');
        console.log('   - Record saved to DB: YES');
        console.log('   - Can retrieve from DB: YES');
      } else {
        console.log('⚠ Our test submission NOT in the list\n');
      }
    } else {
      console.log('⚠ Could not fetch submissions:', allResponse.status);
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testSimpleFullFlow();
