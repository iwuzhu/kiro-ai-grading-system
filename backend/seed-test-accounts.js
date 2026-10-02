const { Client } = require('pg');
const bcrypt = require('bcrypt');

const client = new Client({
  host: 'tec-bridgeaidb.csvikosmym65.us-east-1.rds.amazonaws.com',
  port: 5432,
  user: 'tecbridgeai',
  password: 'yr$F*U^bBZcf04_Mk(3YZY;V0<`k6zLZ',
  database: 'tec-bridgeaidb',
  ssl: { rejectUnauthorized: false },
});

const TEST_INSTITUTION_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_PASSWORD = 'TestPassword123!';

async function seed() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Create institution
    await client.query(
      `INSERT INTO grading.institutions (id, tenant_id, name, domain, timezone, created_at, updated_at)
       VALUES ($1, $2, 'Test University', 'test.example.com', 'America/New_York', NOW(), NOW())
       ON CONFLICT (tenant_id) DO NOTHING`,
      [TEST_INSTITUTION_ID, TEST_INSTITUTION_ID]
    );
    console.log('Institution created/exists');

    // Hash the password
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    console.log('Password hashed');

    // Create test accounts
    const accounts = [
      { email: 'testadmin@test.com', name: 'Test Admin', role: 'admin' },
      { email: 'testinstructor@test.com', name: 'Test Instructor', role: 'instructor' },
      { email: 'teststudent@test.com', name: 'Test Student', role: 'student' },
    ];

    for (const account of accounts) {
      try {
        const result = await client.query(
          `INSERT INTO grading.users (id, tenant_id, email, name, role, status, password_hash, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, 'ACTIVE', $5, NOW(), NOW())
           ON CONFLICT (tenant_id, email) DO UPDATE SET updated_at = NOW()
           RETURNING email, role`,
          [TEST_INSTITUTION_ID, account.email, account.name, account.role, passwordHash]
        );
        console.log(`✓ Created account: ${result.rows[0].email} (${result.rows[0].role})`);
      } catch (err) {
        console.log(`✗ Error creating ${account.email}: ${err.message}`);
      }
    }

    // Verify accounts
    const verification = await client.query(
      `SELECT email, role, status FROM grading.users WHERE tenant_id = $1 ORDER BY role`,
      [TEST_INSTITUTION_ID]
    );
    console.log('\n=== Test Accounts Created ===');
    verification.rows.forEach(row => {
      console.log(`${row.email} | Role: ${row.role} | Status: ${row.status}`);
    });
    console.log('\n=== Login Credentials ===');
    console.log(`Password (all accounts): ${TEST_PASSWORD}`);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

seed();
