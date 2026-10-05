/**
 * Direct Submission Test
 * Tests the repository save operation with debug logging
 */

import { DataSource } from 'typeorm';
import { Submission } from './src/domain/entities/submission.entity';

async function testSubmissionSave() {
  console.log('[TEST] Starting direct submission save test...');

  // Create DataSource matching the config
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    schema: 'grading',
    entities: ['./dist/domain/entities/**/*.entity.js'],
    synchronize: false,
    logging: true,
  });

  try {
    console.log('[TEST] Initializing DataSource...');
    await dataSource.initialize();
    console.log('[TEST] ✅ DataSource connected');

    const submissionRepository = dataSource.getRepository(Submission);

    // Create test submission
    const testSubmission = new Submission();
    testSubmission.tenant_id = '11111111-1111-1111-1111-111111111111';
    testSubmission.assignment_id = '22222222-2222-2222-2222-222222222222';
    testSubmission.student_id = '33333333-3333-3333-3333-333333333333';
    testSubmission.version = 1;
    testSubmission.file_path = 's3://tecbridge-general/websites/externals/deepgrader/timestamp/test-file.pdf';
    testSubmission.file_type = 'application/pdf';
    testSubmission.content = {
      answers: {
        file: 's3://tecbridge-general/websites/externals/deepgrader/timestamp/test-file.pdf',
        submittedAt: new Date().toISOString(),
      },
    };
    testSubmission.is_incremental = false;
    testSubmission.is_late = false;
    testSubmission.submitted_at = new Date();

    console.log('[TEST] Created submission entity:', {
      tenant_id: testSubmission.tenant_id,
      assignment_id: testSubmission.assignment_id,
      student_id: testSubmission.student_id,
      content: testSubmission.content,
    });

    console.log('[TEST] Attempting to save...');
    const savedSubmission = await submissionRepository.save(testSubmission);

    console.log('[TEST] ✅ SAVE SUCCESS!', {
      id: savedSubmission.id,
      tenant_id: savedSubmission.tenant_id,
      assignment_id: savedSubmission.assignment_id,
      student_id: savedSubmission.student_id,
      version: savedSubmission.version,
      file_path: savedSubmission.file_path,
      content: savedSubmission.content,
      created_at: savedSubmission.created_at,
    });

    // Verify the record was saved
    console.log('[TEST] Verifying saved record...');
    const retrievedSubmission = await submissionRepository.findOne({
      where: {
        id: savedSubmission.id,
        tenant_id: testSubmission.tenant_id,
      },
    });

    if (retrievedSubmission) {
      console.log('[TEST] ✅ Record successfully retrieved from database:', {
        id: retrievedSubmission.id,
        tenant_id: retrievedSubmission.tenant_id,
        content: retrievedSubmission.content,
      });
    } else {
      console.log('[TEST] ❌ Record NOT found after save!');
    }

  } catch (error) {
    console.error('[TEST] ❌ ERROR:', {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : null,
    });
  } finally {
    console.log('[TEST] Closing DataSource...');
    await dataSource.destroy();
    console.log('[TEST] Done');
  }
}

testSubmissionSave();
