#!/usr/bin/env node
/**
 * Test Grade API Endpoint
 * 
 * Simulates the frontend calling POST /grades/create
 * Verifies that the backend properly saves grades with assignment_id
 */

const http = require('http');
require('dotenv').config({ path: '.env.local' });

const API_URL = process.env.API_DOMAIN || 'http://localhost:3001';
const SUBMISSION_ID = '3f8099-cb71-4761-ba21-b5845b53470c'; // From test
const ASSIGNMENT_ID = 'd04d42be-6137-406a-b4e9-8d53314f50271'; // From test
const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000'; // From test

async function testGradeAPI() {
  // Create grade request body
  const gradeRequest = {
    submission_id: SUBMISSION_ID,
    assignment_id: ASSIGNMENT_ID,
    score: 92,
    confidence: 90,
    feedback: 'Excellent work! The submission demonstrates strong understanding of the concepts. Well-organized and clearly written.',
    strengths: ['Clear explanation', 'Good examples', 'Well-structured'],
    improvements: ['Add more edge cases', 'Could expand on theory'],
  };

  const requestBody = JSON.stringify(gradeRequest);

  console.log('Testing Grade API Endpoint');
  console.log('═══════════════════════════════════════════\n');
  console.log('POST /api/v1/grades');
  console.log('Request body:');
  console.log(JSON.stringify(gradeRequest, null, 2));
  console.log('\n');

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/v1/grades',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
        'X-Tenant-ID': TENANT_ID,
        'Authorization': 'Bearer test-token', // Placeholder
      },
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        try {
          const response = JSON.parse(data);
          console.log('\nResponse:');
          console.log(JSON.stringify(response, null, 2));

          if (response.success) {
            console.log('\n✓ API CALL SUCCESSFUL');
            console.log(`  Grade ID: ${response.data.id}`);
            console.log(`  Assignment ID: ${response.data.assignment_id}`);
            console.log(`  Score: ${response.data.score}`);
            console.log(`  Status: ${response.data.status}`);
            resolve(true);
          } else {
            console.error('\n✗ API returned error:');
            console.error(response.error);
            reject(response.error);
          }
        } catch (e) {
          console.error('Failed to parse response:', data);
          reject(e);
        }
      });
    });

    req.on('error', (error) => {
      console.error('\n✗ REQUEST FAILED');
      console.error('Error:', error.message);
      console.error('\nNote: Make sure the backend is running on port 3001');
      reject(error);
    });

    req.write(requestBody);
    req.end();
  });
}

testGradeAPI()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nTest failed:', err.message);
    process.exit(1);
  });
