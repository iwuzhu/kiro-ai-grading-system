#!/usr/bin/env node
/**
 * Verify migration 16 was applied successfully
 */

const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function verify() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();

    // Check table structure
    const result = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'grading' AND table_name = 'grades'
      ORDER BY ordinal_position;
    `);

    console.log('Current grading.grades table structure:');
    console.log('----------------------------------------');
    result.rows.forEach(row => {
      const nullable = row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = row.column_default ? ` (default: ${row.column_default})` : '';
      console.log(`${row.column_name.padEnd(25)} ${row.data_type.padEnd(20)} ${nullable}${defaultVal}`);
    });

    // Check if the 3 new columns exist
    const newCols = result.rows.filter(r => ['question_id', 'grade_type', 'grade_details'].includes(r.column_name));
    if (newCols.length === 3) {
      console.log('\n✓ Migration 16 successfully applied!');
      console.log('  - question_id column exists');
      console.log('  - grade_type column exists');
      console.log('  - grade_details column exists');
    } else {
      console.log('\n✗ Migration 16 NOT applied. Missing columns:', 
        ['question_id', 'grade_type', 'grade_details']
          .filter(c => !newCols.map(r => r.column_name).includes(c))
      );
    }

    // Check constraints
    const constraints = await client.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_schema = 'grading' AND table_name = 'grades'
      ORDER BY constraint_name;
    `);

    console.log('\nTable constraints:');
    constraints.rows.forEach(row => {
      console.log(`  - ${row.constraint_name} (${row.constraint_type})`);
    });

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verify();
