/**
 * Direct S3 Upload Test
 * Tests if we can actually upload to S3
 */

const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

async function testS3Upload() {
  console.log('=== S3 Upload Test ===\n');

  // Configuration
  const bucket = process.env.AWS_S3_BUCKET || 'tecbridge-general';
  const region = process.env.AWS_REGION || 'us-east-1';
  const timestamp = Date.now();
  const testKey = `websites/externals/deepgrader/test/${timestamp}/test-file.txt`;
  const testContent = Buffer.from(`Test file created at ${new Date().toISOString()}`);

  console.log('Configuration:');
  console.log(`  Bucket: ${bucket}`);
  console.log(`  Region: ${region}`);
  console.log(`  S3 Key: ${testKey}`);
  console.log(`  File Size: ${testContent.length} bytes`);
  console.log('');

  // Check AWS credentials
  console.log('Checking AWS Credentials:');
  const hasAccessKey = !!process.env.AWS_ACCESS_KEY_ID;
  const hasSecretKey = !!process.env.AWS_SECRET_ACCESS_KEY;
  console.log(`  AWS_ACCESS_KEY_ID: ${hasAccessKey ? '✓ SET' : '✗ NOT SET'}`);
  console.log(`  AWS_SECRET_ACCESS_KEY: ${hasSecretKey ? '✓ SET' : '✗ NOT SET'}`);
  console.log(`  Using AWS SDK default credential chain (profile, IAM role, etc.)`);
  console.log('');

  try {
    // Create S3 client
    console.log('Creating S3 client...');
    const s3Client = new S3Client({ region });
    console.log('✓ S3 client created\n');

    // Upload test file
    console.log('Uploading test file to S3...');
    const uploadCommand = new PutObjectCommand({
      Bucket: bucket,
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain',
    });

    const uploadResult = await s3Client.send(uploadCommand);
    console.log('✓ Upload successful!');
    console.log(`  ETag: ${uploadResult.ETag}`);
    console.log(`  S3 URI: s3://${bucket}/${testKey}`);
    console.log('');

    // Try to download and verify
    console.log('Verifying by downloading...');
    const downloadCommand = new GetObjectCommand({
      Bucket: bucket,
      Key: testKey,
    });

    const downloadResult = await s3Client.send(downloadCommand);
    const downloadedContent = await downloadResult.Body.transformToString();
    
    if (downloadedContent === testContent.toString()) {
      console.log('✓ Download successful - content matches!');
      console.log(`  Downloaded: "${downloadedContent}"`);
      console.log('');
      console.log('✅ S3 UPLOAD AND DOWNLOAD WORKING CORRECTLY');
    } else {
      console.log('❌ Downloaded content does not match!');
      console.log(`  Expected: "${testContent.toString()}"`);
      console.log(`  Got: "${downloadedContent}"`);
    }

  } catch (error) {
    console.error('❌ S3 ERROR:');
    console.error(`  Error Type: ${error.constructor.name}`);
    console.error(`  Error Message: ${error.message}`);
    console.error(`  Error Code: ${error.Code || error.$metadata?.httpStatusCode}`);
    console.error('');
    console.error('Full error:');
    console.error(error);
    console.error('');
    
    // Provide suggestions
    if (error.message.includes('NoCredentialsProvider') || error.message.includes('CredentialsProviderError')) {
      console.error('🔧 SUGGESTION: AWS credentials not found.');
      console.error('   Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables');
      console.error('   OR configure ~/.aws/credentials');
    } else if (error.message.includes('NoSuchBucket')) {
      console.error(`🔧 SUGGESTION: Bucket "${bucket}" does not exist or is not accessible`);
    } else if (error.message.includes('AccessDenied') || error.message.includes('Forbidden')) {
      console.error('🔧 SUGGESTION: AWS credentials do not have permission to write to this bucket');
    }
  }
}

testS3Upload();
