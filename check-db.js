const { Pool } = require('pg');

const pool = new Pool({
  host: 'tec-bridgeaidb.csvikosmym65.us-east-1.rds.amazonaws.com',
  port: 5432,
  user: 'tecbridgeai',
  password: 'yr$F*U^bBZcf04_Mk(3YZY;V0<`k6zLZ',
  database: 'tec-bridgeaidb',
  ssl: {
    rejectUnauthorized: false,
  },
});

async function check() {
  try {
    await pool.connect();
    console.log('✓ Connected to database\n');

    // Check institutions
    console.log('=== INSTITUTIONS ===');
    const instResult = await pool.query(
      'SELECT id, tenant_id, name, domain FROM grading.institutions ORDER BY created_at DESC LIMIT 5'
    );
    console.log(`Found ${instResult.rows.length} institutions:`);
    instResult.rows.forEach(row => {
      console.log(`  ID: ${row.id}`);
      console.log(`  Name: ${row.name}`);
      console.log(`  Domain: ${row.domain}`);
      console.log(`  Tenant: ${row.tenant_id}\n`);
    });

    // Check users
    console.log('=== USERS ===');
    const userResult = await pool.query(
      'SELECT id, email, role, status, password_hash IS NOT NULL as has_password FROM grading.users ORDER BY created_at DESC LIMIT 10'
    );
    console.log(`Found ${userResult.rows.length} users:`);
    userResult.rows.forEach(row => {
      console.log(`  Email: ${row.email}`);
      console.log(`  Role: ${row.role}`);
      console.log(`  Status: ${row.status}`);
      console.log(`  Has Password: ${row.has_password}\n`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

check();
