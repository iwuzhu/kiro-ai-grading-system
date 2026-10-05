#!/usr/bin/env node
/**
 * Generate Test JWT Token for Local Testing
 * 
 * This creates a valid JWT token that can be used to test protected endpoints locally.
 * The token includes INSTRUCTOR role required for AI grading endpoint.
 * 
 * Usage:
 * node generate-test-token.js
 */

const crypto = require('crypto');

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-development-only';
const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = '550e8400-e29b-41d4-a716-446655440001';

/**
 * Manually create a JWT token using Node's crypto
 * (simplified implementation without external dependencies)
 */
function createJWT(payload, secret, expiresIn = 3600) {
  // Create header
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  // Add expiration to payload
  const now = Math.floor(Date.now() / 1000);
  const payloadWithExp = {
    ...payload,
    iat: now,
    exp: now + expiresIn
  };

  // Encode to Base64URL
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const payloadB64 = Buffer.from(JSON.stringify(payloadWithExp)).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  // Create signature
  const message = headerB64 + '.' + payloadB64;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return message + '.' + signature;
}

// Create token payload
const payload = {
  sub: USER_ID,
  email: 'instructor@test.edu',
  tenant_id: TENANT_ID,
  role: 'INSTRUCTOR',
  permissions: ['grades:write'],
  type: 'access'
};

// Generate token
const token = createJWT(payload, JWT_SECRET, 3600);

console.log('═'.repeat(70));
console.log('Test JWT Token Generated');
console.log('═'.repeat(70));
console.log('\nToken (valid for 1 hour):');
console.log(token);
console.log('\nUse this token in Authorization header:');
console.log(`Authorization: Bearer ${token}`);
console.log('\nPayload:');
console.log(JSON.stringify(payload, null, 2));
console.log('\n' + '═'.repeat(70));
