/**
 * Verify Database Seeding
 * 
 * This script checks if test users were created by the database initialization service.
 * Run after backend starts: node verify-seeding.js
 */

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

async function verifySeeding() {
  try {
    console.log('🔍 Verifying database seeding...\n');

    // Check if institution exists
    console.log('1️⃣  Checking for test institution...');
    const institutionResult = await pool.query(`
      SELECT id, name, domain, tenant_id 
      FROM grading.institutions 
      WHERE domain = $1
    `, ['test-university.edu']);

    if (institutionResult.rows.length === 0) {
      console.log('   ❌ Institution NOT FOUND');
      return false;
    }

    const institution = institutionResult.rows[0];
    console.log(`   ✅ Institution found: ${institution.name} (${institution.id})`);
    console.log(`      Tenant ID: ${institution.tenant_id}\n`);

    // Check test users
    console.log('2️⃣  Checking for test users...');
    const usersResult = await pool.query(`
      SELECT id, email, role, status 
      FROM grading.users 
      WHERE tenant_id = $1
      ORDER BY email
    `, [institution.tenant_id]);

    if (usersResult.rows.length === 0) {
      console.log('   ❌ NO USERS FOUND');
      return false;
    }

    console.log(`   ✅ Found ${usersResult.rows.length} users:\n`);
    for (const user of usersResult.rows) {
      console.log(`      • ${user.email} (${user.role}) - ${user.status}`);
    }

    // Check if we have the expected users
    const expectedEmails = [
      'admin@deepgrader.com',
      'teacher1@deepgrader.com',
      'student1@deepgrader.com',
    ];

    const foundEmails = usersResult.rows.map(u => u.email);
    const missingEmails = expectedEmails.filter(email => !foundEmails.includes(email));

    if (missingEmails.length > 0) {
      console.log(`\n   ⚠️  Missing users: ${missingEmails.join(', ')}`);
      return false;
    }

    console.log('\n✅ All test users created successfully!');

    // Test password hash existence
    console.log('\n3️⃣  Checking password hashes...');
    const passwordResult = await pool.query(`
      SELECT email, password_hash 
      FROM grading.users 
      WHERE tenant_id = $1
    `, [institution.tenant_id]);

    for (const user of passwordResult.rows) {
      const hasHash = user.password_hash && user.password_hash.length > 0;
      console.log(`   ${hasHash ? '✅' : '❌'} ${user.email}: ${hasHash ? 'Hash exists' : 'NO HASH'}`);
    }

    console.log('\n🎉 Seeding verification complete!');
    return true;

  } catch (error) {
    console.error('❌ Error verifying seeding:', error.message);
    return false;
  } finally {
    await pool.end();
  }
}

verifySeeding().then(success => {
  process.exit(success ? 0 : 1);
});
