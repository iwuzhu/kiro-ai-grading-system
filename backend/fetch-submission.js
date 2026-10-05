#!/usr/bin/env node
/**
 * Fetch a valid submission ID from the database for testing
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USERNAME || 'grading_user',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'grading_system',
});

async function fetchSubmission() {
  try {
    console.log('Fetching valid submissions from database...\n');

    const result = await pool.query(
      'SELECT id, assignment_id, content FROM grading.submissions WHERE content IS NOT NULL LIMIT 5'
    );

    if (result.rows.length === 0) {
      console.log('No submissions found in database.');
      console.log('Create a submission first via the API or database.');
      return;
    }

    console.log(`Found ${result.rows.length} submission(s):\n`);

    result.rows.forEach((row, idx) => {
      console.log(`${idx + 1}. Submission ID: ${row.id}`);
      console.log(`   Assignment ID: ${row.assignment_id}`);
      console.log(`   Content: ${(row.content || '').substring(0, 80)}...`);
      console.log();
    });

    console.log('Use these IDs in test-ai-grading.js:');
    console.log(`  SUBMISSION_ID = '${result.rows[0].id}'`);
    console.log(`  ASSIGNMENT_ID = '${result.rows[0].assignment_id}'`);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

fetchSubmission();
