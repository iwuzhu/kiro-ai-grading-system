const http = require('http');

// Simulate what the frontend hook does
const NEXT_PUBLIC_API_URL = 'http://localhost:3001/api';
const endpoint = `${NEXT_PUBLIC_API_URL}/v1/auth/login`;

console.log(`Testing login at: ${endpoint}\n`);

const data = JSON.stringify({
  email: 'admin@deepgrader.com',
  password: 'Password123!'
});

const url = new URL(endpoint);
const options = {
  hostname: url.hostname,
  port: url.port,
  path: url.pathname + url.search,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log('Request:');
console.log(`  URL: ${endpoint}`);
console.log(`  Method: POST`);
console.log(`  Body: ${data}\n`);

const req = http.request(options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log('Response:');
    console.log(`  Status Code: ${res.statusCode}`);
    
    try {
      const parsed = JSON.parse(responseData);
      console.log(`  Response Body:\n${JSON.stringify(parsed, null, 2)}`);
      
      if (res.statusCode === 200 && parsed.access_token) {
        console.log('\n✅ LOGIN TEST SUCCESSFUL!');
        console.log(`  Access Token: ${parsed.access_token.substring(0, 50)}...`);
        console.log(`  Refresh Token: ${parsed.refresh_token.substring(0, 50)}...`);
        console.log(`  User: ${parsed.user.email} (${parsed.user.role})`);
        console.log(`  Token Expires In: ${parsed.expires_in}s`);
        console.log('\n✅ Frontend login should now work!');
      } else {
        console.log('\n❌ LOGIN FAILED');
        console.log('Response error:', parsed.error);
      }
    } catch (e) {
      console.log('  Response:', responseData);
      if (res.statusCode === 404) {
        console.log('\n❌ ERROR: 404 Not Found - endpoint does not exist');
      }
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error.message);
});

req.write(data);
req.end();
