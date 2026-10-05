#!/usr/bin/env node
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

(async () => {
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  
  await client.connect();
  const res = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'grading' AND table_name = 'grades'
    ORDER BY ordinal_position;
  `);
  
  console.log('Columns in grading.grades:');
  res.rows.forEach(r => {
    console.log(`  ${r.column_name.padEnd(25)} ${r.data_type.padEnd(20)} ${r.is_nullable}`);
  });
  
  await client.end();
})();
