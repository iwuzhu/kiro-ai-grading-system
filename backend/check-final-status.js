/**
 * Final Status Check
 * Check if submissions are being saved with S3 URIs
 */

require('dotenv').config({ path: '.env.local' });
const { DataSource } = require('typeorm');

async function checkStatus() {
  console.log('=== Final Status Check ===\n');

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

  try {
    const dataSource = new DataSource(dbConfig);
    await dataSource.initialize();
    console.log('✓ Connected to database\n');

    // Check S3 configuration
    console.log('Configuration:');
    console.log(`  AWS_S3_BUCKET: ${process.env.AWS_S3_BUCKET}`);
    console.log(`  AWS_REGION: ${process.env.AWS_REGION}`);
    console.log(`  DB_HOST: ${process.env.DB_HOST}`);
    console.log(`  DB_SSL: ${process.env.DB_SSL}\n`);

    // Count total submissions
    const countResult = await dataSource.query(
      'SELECT COUNT(*) as count FROM grading.submissions'
    );
    const totalCount = countResult[0].count;

    console.log(`Total submissions in database: ${totalCount}\n`);

    // Get latest 5 submissions
    console.log('Latest 5 submissions:\n');
    const submissions = await dataSource.query(`
      SELECT 
        id,
        assignment_id,
        student_id,
        file_path,
        content,
        created_at,
        submitted_at
      FROM grading.submissions
      ORDER BY created_at DESC
      LIMIT 5
    `);

    submissions.forEach((s, i) => {
      console.log(`${i + 1}. ID: ${s.id}`);
      console.log(`   Assignment: ${s.assignment_id}`);
      console.log(`   Student: ${s.student_id}`);
      console.log(`   File Path: ${s.file_path?.substring(0, 80)}${s.file_path?.length > 80 ? '...' : ''}`);
      console.log(`   Content: ${JSON.stringify(s.content).substring(0, 80)}...`);
      console.log(`   Created: ${s.created_at}`);
      console.log('');
    });

    // Check if latest submission has S3 URI and content
    if (submissions.length > 0) {
      const latest = submissions[0];
      
      console.log('STATUS CHECK:');
      const hasS3URI = latest.file_path?.includes('s3://tecbridge-general');
      const hasContent = latest.content?.answers?.file;
      const contentMatches = latest.content?.answers?.file === latest.file_path;
      
      console.log(`  Has S3 bucket URI (tecbridge-general): ${hasS3URI ? '✓ YES' : '✗ NO'}`);
      console.log(`  Has content.answers.file: ${hasContent ? '✓ YES' : '✗ NO'}`);
      console.log(`  Content matches file_path: ${contentMatches ? '✓ YES' : '✗ NO'}`);
      
      if (hasS3URI && hasContent && contentMatches) {
        console.log('\n✅ SUBMISSIONS ARE BEING SAVED CORRECTLY');
      } else {
        console.log('\n❌ SUBMISSIONS NOT SAVING PROPERLY');
      }
    }

    await dataSource.destroy();

  } catch (error) {
    console.error('ERROR:', error.message);
  }
}

checkStatus();
