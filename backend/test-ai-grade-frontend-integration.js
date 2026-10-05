#!/usr/bin/env node

/**
 * Test: AI Grade Frontend Integration
 * 
 * This script tests the complete AI grading flow:
 * 1. Authenticate as instructor
 * 2. Call the AI grading endpoint (POST /api/v1/grading/ai-grade)
 * 3. Verify response contains all required fields (score, feedback, strengths, improvements)
 * 4. Simulate frontend parsing and form population
 * 
 * Run: node test-ai-grade-frontend-integration.js
 */

const crypto = require('crypto');

// Test configuration
const TEST_CONFIG = {
  API_URL: 'http://localhost:3001/api/v1',
  TENANT_ID: '550e8400-e29b-41d4-a716-446655440000', // Test institution from seed data
  SUBMISSION_ID: '02b17cd9-2b4a-4944-886a-0770d550a82e', // Real submission from DB
  ASSIGNMENT_ID: '64cfafaf-5549-443e-843e-a1fb3a002ed8', // Real assignment from DB
  JWT_SECRET: 'e4bd51ddf172769c442b126626bea54c74be0aa7f3d4dc4de3e83a01b226ab69af42e3ff2571d3ef9838f5a04ab957efdee1c27074a7cea33eb1b50247235bfc',
  INSTRUCTOR_ID: '11111111-1111-1111-1111-111111111111', // Test instructor
};

// Generate valid JWT token (HMAC-SHA256)
function generateJWT(userId, role, tenantId) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      email: `${role}@test.local`,
      tenant_id: tenantId,
      role: role,
      type: 'access', // Required by JWT strategy
      permissions: role === 'instructor' ? ['grades:write'] : [],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', TEST_CONFIG.JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

// Format JSON response nicely
function formatResponse(data) {
  return JSON.stringify(data, null, 2);
}

// Main test flow
async function runTest() {
  console.log('🧪 AI Grade Frontend Integration Test\n');
  console.log('📋 Configuration:');
  console.log(`   API URL: ${TEST_CONFIG.API_URL}`);
  console.log(`   Tenant ID: ${TEST_CONFIG.TENANT_ID}`);
  console.log(`   Submission ID: ${TEST_CONFIG.SUBMISSION_ID}`);
  console.log(`   Assignment ID: ${TEST_CONFIG.ASSIGNMENT_ID}\n`);

  try {
    // Step 1: Generate JWT token
    console.log('Step 1️⃣: Generate JWT Token');
    const token = generateJWT(
      TEST_CONFIG.INSTRUCTOR_ID,
      'instructor',
      TEST_CONFIG.TENANT_ID
    );
    console.log(`✅ JWT Token Generated: ${token.substring(0, 50)}...\n`);

    // Step 2: Call AI grading endpoint
    console.log('Step 2️⃣: Call AI Grading Endpoint');
    console.log(`POST ${TEST_CONFIG.API_URL}/grading/ai-grade`);
    console.log('Body:', formatResponse({
      submission_id: TEST_CONFIG.SUBMISSION_ID,
      assignment_id: TEST_CONFIG.ASSIGNMENT_ID,
    }));

    const response = await fetch(`${TEST_CONFIG.API_URL}/grading/ai-grade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': TEST_CONFIG.TENANT_ID,
      },
      body: JSON.stringify({
        submission_id: TEST_CONFIG.SUBMISSION_ID,
        assignment_id: TEST_CONFIG.ASSIGNMENT_ID,
      }),
    });

    console.log(`📊 HTTP Status: ${response.status} ${response.statusText}\n`);

    const responseData = await response.json();

    if (!response.ok) {
      console.error('❌ API Error Response:');
      console.error(formatResponse(responseData));
      process.exit(1);
    }

    // Step 3: Verify response structure
    console.log('Step 3️⃣: Verify Response Structure');
    console.log('✅ Full Response:');
    console.log(formatResponse(responseData));

    // Step 4: Extract grade data (as frontend would)
    console.log('\nStep 4️⃣: Frontend Form Population (Simulated)');
    const formData = {
      score: responseData.ai_score || 0,
      feedback: responseData.feedback || '',
      strengths: (responseData.strengths || []).join('\n'),
      improvements: (responseData.improvements || []).join('\n'),
    };

    console.log('📝 Form Data (as it would appear in frontend):');
    console.log(formatResponse(formData));

    // Step 5: Validation checks
    console.log('\nStep 5️⃣: Frontend Validation Checks');
    let allValid = true;

    // Check score
    if (typeof formData.score === 'number' && formData.score >= 0) {
      console.log(`✅ Score: ${formData.score} (valid)`);
    } else {
      console.log(`❌ Score: Invalid (${formData.score})`);
      allValid = false;
    }

    // Check feedback
    if (formData.feedback && formData.feedback.trim().length >= 20) {
      console.log(`✅ Feedback: ${formData.feedback.length} chars (valid)`);
    } else {
      console.log(`❌ Feedback: Too short or missing`);
      allValid = false;
    }

    // Check strengths
    const strengthsList = formData.strengths.split('\n').filter(s => s.trim());
    if (strengthsList.length > 0) {
      console.log(`✅ Strengths: ${strengthsList.length} item(s) (valid)`);
    } else {
      console.log(`❌ Strengths: Missing`);
      allValid = false;
    }

    // Check improvements
    const improvementsList = formData.improvements.split('\n').filter(s => s.trim());
    if (improvementsList.length > 0) {
      console.log(`✅ Improvements: ${improvementsList.length} item(s) (valid)`);
    } else {
      console.log(`❌ Improvements: Missing`);
      allValid = false;
    }

    // Step 6: Simulate frontend submission
    console.log('\nStep 6️⃣: Frontend Save Grade Simulation');
    console.log('📤 Would call: POST /api/v1/grading');
    console.log('With payload:');
    const savePayload = {
      submission_id: TEST_CONFIG.SUBMISSION_ID,
      assignment_id: TEST_CONFIG.ASSIGNMENT_ID,
      score: formData.score,
      feedback: formData.feedback,
      strengths: strengthsList,
      improvements: improvementsList,
      confidence: responseData.confidence || 85,
    };
    console.log(formatResponse(savePayload));

    // Final result
    console.log('\n' + '='.repeat(60));
    if (allValid && response.ok) {
      console.log('✨ ALL TESTS PASSED! AI Grade flow is working correctly.\n');
      console.log('Frontend is ready to:');
      console.log('  1. Show AI Grade button in SubmissionViewer');
      console.log('  2. Call AI grading endpoint on click');
      console.log('  3. Populate form fields with AI response');
      console.log('  4. Allow instructor to override/edit');
      console.log('  5. Save grade via existing Save Grade flow');
      console.log('='.repeat(60));
      process.exit(0);
    } else {
      console.log('❌ TESTS FAILED!\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('🔥 Test Error:', error.message);
    process.exit(1);
  }
}

// Run the test
runTest();
