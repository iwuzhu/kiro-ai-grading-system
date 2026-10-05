const fs = require('fs');
const path = require('path');

// Check UPLOAD_DIR
const uploadDir = './uploads';
const tenantId = '550e8400-e29b-41d4-a716-446655440000';
const submissionId = '01dfb96f-1291-4573-83d5-9d876ffb0124';

// Example S3 paths to test
const s3PathExamples = [
  's3://grading-submissions/550e8400-e29b-41d4-a716-446655440000/1b607694-1f44-42c4-ad6f-b9e0c0e15f45/423e4567-e89b-12d3-a456-426614174003/1791036542466-Use_case_Diagram.pdf',
];

console.log('[DEBUG] Testing S3 path conversion...\n');

s3PathExamples.forEach(s3Path => {
  console.log('S3 Path:', s3Path);
  
  // Current implementation
  const withoutBucket = s3Path.replace(/^s3:\/\/[^/]+\//, '');
  console.log('After removing bucket:', withoutBucket);
  
  const localPath = withoutBucket.split('/').join(path.sep);
  console.log('Local path (with sep):', localPath);
  
  const fullPath = path.join(uploadDir, localPath);
  console.log('Full path:', fullPath);
  
  // Check if file exists
  const exists = fs.existsSync(fullPath);
  console.log('File exists:', exists);
  
  if (!exists) {
    const dirPath = path.dirname(fullPath);
    console.log('Directory:', dirPath);
    if (fs.existsSync(dirPath)) {
      const contents = fs.readdirSync(dirPath);
      console.log('Directory contents:', contents);
    } else {
      console.log('Directory does not exist');
    }
  }
  
  console.log('---\n');
});
