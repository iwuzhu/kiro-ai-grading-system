#!/usr/bin/env node

/**
 * Test script to verify submissions endpoint is working
 */

const http = require('http');

// A sample assignment ID to test with
const ASSIGNMENT_ID = 'd04d42be-6137-406a-b4e9-8d5314f50271';
const API_URL = 'http://localhost:3001';

// Get a valid token first from login, or use a dummy one for testing
const options = {
  hostname: 'localhost',
  port: 3001,
  path: `/api/v1/submissions/assignment/${ASSIGNMENT_ID}`,
  method: 'GET',
  headers: {
    'Authorization': 'Bearer dummy-token-for-testing',
    'Content-Type': 'application/json',
  },
};

console.log(`Testing endpoint: GET ${options.hostname}:${options.port}${options.path}\n`);

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`Status Code: ${res.statusCode}`);
    console.log(`Headers: ${JSON.stringify(res.headers, null, 2)}`);
    console.log(`\nResponse Body:`);
    try {
      console.log(JSON.stringify(JSON.parse(data), null, 2));
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('Request failed:', error.message);
  console.error('Make sure the backend is running on http://localhost:3001');
});

req.end();
