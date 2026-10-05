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
  
  // Check enum values
  const res = await client.query(`
    SELECT e.enumlabel 
    FROM pg_enum e 
    JOIN pg_type t ON e.enumtypid = t.oid 
    WHERE t.typname = 'users_role_enum';
  `);
  
  console.log('Valid user roles:');
  res.rows.forEach(r => console.log(`  - ${r.enumlabel}`));
  
  // Get a sample user
  const userRes = await client.query(`SELECT id, email, role FROM grading.users LIMIT 3;`);
  console.log('\nSample users:');
  userRes.rows.forEach(u => console.log(`  ${u.email}: ${u.role}`));
  
  await client.end();
})();
