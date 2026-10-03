// Test login against the backend
import http from 'http';

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/v1/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
};

const body = JSON.stringify({
  email: 'admin@deepgrader.com',
  password: 'Password123!',
});

const req = http.request(options, (res) => {
  let data = '';

  console.log(`\n[${new Date().toISOString()}] Login Test`);
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers, null, 2)}\n`);

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('Response:');
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('Response (raw):');
      console.log(data);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(body);
req.end();
