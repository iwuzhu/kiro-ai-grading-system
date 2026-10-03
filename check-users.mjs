import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  host: 'tec-bridgeaidb.csvikosmym65.us-east-1.rds.amazonaws.com',
  port: 5432,
  user: 'tecbridgeai',
  password: 'TecBridgeAI2024',
  database: 'tec-bridgeaidb',
});

await client.connect();

try {
  const result = await client.query(
    'SELECT id, email, tenant_id, password_hash, status FROM grading.users WHERE email IN ($1, $2, $3) LIMIT 10',
    ['admin@deepgrader.com', 'teacher1@deepgrader.com', 'student1@deepgrader.com']
  );
  
  console.log('Users found:');
  result.rows.forEach(row => {
    console.log(`\nEmail: ${row.email}`);
    console.log(`Tenant ID: ${row.tenant_id}`);
    console.log(`Status: ${row.status}`);
    console.log(`Hash: ${row.password_hash ? row.password_hash.substring(0, 20) + '...' : 'NULL'}`);
  });

  // Also check institutions
  console.log('\n\n--- Institutions ---');
  const instResult = await client.query('SELECT id, tenant_id, name FROM grading.institutions LIMIT 5');
  instResult.rows.forEach(row => {
    console.log(`Institution: ${row.name}, ID: ${row.id}, Tenant ID: ${row.tenant_id}`);
  });
} finally {
  await client.end();
}
