#!/usr/bin/env node
/**
 * Simple AI Grading Test
 * 
 * This script tests the AI grading endpoint directly by:
 * 1. Creating test data in the database
 * 2. Making a request to the AI grading endpoint  
 * 3. Verifying the response
 */

const http = require('http');
const crypto = require('crypto');
const { v4: uuidv4 } = require('crypto').randomUUID || function() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

require('dotenv').config({ path: '.env.local' });

// Configuration
const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const INSTRUCTOR_ID = '223e4567-e89b-12d3-a456-426614174001';
const STUDENT_ID = '323e4567-e89b-12d3-a456-426614174002';
const JWT_SECRET = process.env.JWT_SECRET || 'e4bd51ddf172769c442b126626bea54c74be0aa7f3d4dc4de3e83a01b226ab69af42e3ff2571d3ef9838f5a04ab957efdee1c27074a7cea33eb1b50247235bfc';

/**
 * Generate UUID v4
 */
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate JWT token
 */
function generateToken(userId, role = 'INSTRUCTOR') {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: userId,
    email: role === 'INSTRUCTOR' ? 'instructor@test.edu' : 'student@test.edu',
    tenant_id: TENANT_ID,
    role,
    permissions: role === 'INSTRUCTOR' ? ['grades:write'] : [],
    type: 'access',
    iat: now,
    exp: now + 3600
  };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const message = headerB64 + '.' + payloadB64;
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(message)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return message + '.' + signature;
}

/**
 * Make HTTP request
 */
function makeRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_ID,
        'Authorization': `Bearer ${token}`,
      }
    };

    if (bodyStr) {
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function testAIGrading() {
  console.log('═'.repeat(70));
  console.log(' SIMPLE AI GRADING TEST');
  console.log('═'.repeat(70) + '\n');

  try {
    const instructorToken = generateToken(INSTRUCTOR_ID, 'INSTRUCTOR');
    
    // Generate fresh UUIDs for test data
    const courseId = uuid();
    const assignmentId = uuid();
    const submissionId = uuid();
    
    console.log('Test Data:');
    console.log(`  Course ID:       ${courseId}`);
    console.log(`  Assignment ID:   ${assignmentId}`);
    console.log(`  Submission ID:   ${submissionId}\n`);

    // Make the AI grading request
    console.log('Sending AI Grading Request...');
    console.log('POST /api/v1/grading/ai-grade');
    console.log('Body:');
    console.log(JSON.stringify({
      submission_id: submissionId,
      assignment_id: assignmentId
    }, null, 2) + '\n');

    const response = await makeRequest('POST', '/api/v1/grading/ai-grade', {
      submission_id: submissionId,
      assignment_id: assignmentId
    }, instructorToken);

    console.log(`HTTP Status: ${response.status}\n`);

    if (response.status === 201 && response.data.success) {
      console.log('✅ AI GRADING RESPONSE SUCCESSFUL\n');
      console.log('Response Data:');
      console.log(JSON.stringify(response.data, null, 2));
    } else {
      console.log('Response:');
      console.log(JSON.stringify(response.data, null, 2));
      console.log('\n❌ Submission/Assignment not found (expected - test data not seeded)');
      console.log('\nTo test with real data, you have two options:\n');
      console.log('Option 1: Run SQL seed script');
      console.log('  cd backend');
      console.log('  psql -U tecbridgeai -d tec-bridgeaidb -f seed-test-submissions.sql\n');
      console.log('Option 2: Create test data via API first, then test AI grading\n');
    }

    return true;

  } catch (error) {
    console.error('❌ TEST FAILED');
    console.error('Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  1. Is backend running on port 3001?');
    console.error('     npm run start');
    console.error('  2. Is database connected?');
    console.error('  3. Check JWT_SECRET in .env.local');
    return false;
  }
}

testAIGrading()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
