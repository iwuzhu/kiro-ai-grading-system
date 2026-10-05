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
    SELECT id, email, role FROM grading.users WHERE role = 'INSTRUCTOR' LIMIT 5;
  `);
  
  if (res.rows.length === 0) {
    console.log('No INSTRUCTOR users found. Checking all roles:');
    const allRes = await client.query(`SELECT DISTINCT role, COUNT(*) as count FROM grading.users GROUP BY role;`);
    allRes.rows.forEach(r => console.log(`  ${r.role}: ${r.count}`));
  } else {
    console.log('Found INSTRUCTOR users:');
    res.rows.forEach(r => console.log(`  ${r.id}: ${r.email}`));
  }
  
  await client.end();
})();
