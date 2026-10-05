#!/usr/bin/env node
/**
 * Fetch OpenAI API Key from AWS Secrets Manager
 * 
 * Usage:
 * 1. Ensure AWS credentials are configured:
 *    - AWS CLI: aws configure
 *    - Or environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
 * 
 * 2. Run this script:
 *    node fetch-api-key.js
 * 
 * 3. Copy the output and set environment variable:
 *    $env:TECOpenAIAPIKey = "sk-proj-..."
 */

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
require('dotenv').config({ path: '.env.local' });

async function fetchApiKey() {
  const secretName = 'TECOpenAIAPIKey';
  const region = process.env.AWS_REGION || 'us-east-1';

  console.log('═════════════════════════════════════════════════');
  console.log('  Fetch OpenAI API Key from AWS Secrets Manager');
  console.log('═════════════════════════════════════════════════\n');

  console.log('Configuration:');
  console.log(`  • Secret Name: ${secretName}`);
  console.log(`  • Region: ${region}\n`);

  try {
    console.log('Connecting to AWS Secrets Manager...');

    const client = new SecretsManagerClient({ region });
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await client.send(command);

    let apiKey = '';

    if (response.SecretString) {
      // Try to parse as JSON
      try {
        const secretObject = JSON.parse(response.SecretString);
        apiKey = secretObject[secretName] || response.SecretString;
      } catch {
        // Not JSON, use as string
        apiKey = response.SecretString;
      }
    } else if (response.SecretBinary) {
      // Handle binary secret
      const buffer = Buffer.from(response.SecretBinary);
      apiKey = buffer.toString('utf-8');
    }

    if (apiKey) {
      console.log('✅ Successfully fetched API key!\n');
      console.log('═════════════════════════════════════════════════');
      console.log('API Key:');
      console.log(`${apiKey}\n`);
      console.log('═════════════════════════════════════════════════\n');

      console.log('To use this key, set environment variable:\n');
      console.log('PowerShell:');
      console.log(`$env:TECOpenAIAPIKey = "${apiKey}"\n`);

      console.log('Or add to backend/.env.local:');
      console.log(`TECOpenAIAPIKey=${apiKey}\n`);

      console.log('Then restart backend:');
      console.log('npm run start\n');

      return apiKey;
    } else {
      console.error('✗ Secret value not found');
      return null;
    }
  } catch (error) {
    console.error('✗ Error fetching secret:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Ensure AWS credentials are configured:');
    console.error('   aws configure');
    console.error('2. Verify AWS_REGION is set:');
    console.error(`   Current: ${region}`);
    console.error('3. Verify secret exists in Secrets Manager:');
    console.error(`   Secret name: ${secretName}`);
    console.error('4. Ensure you have permission to read secrets');
    return null;
  }
}

fetchApiKey().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
