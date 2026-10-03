const http = require('http');

const data = JSON.stringify({
  email: 'admin@deepgrader.com',
  password: 'Password123!'
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/v1/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Response:', responseData);
    try {
      const parsed = JSON.parse(responseData);
      console.log('\nParsed Response:');
      console.log(JSON.stringify(parsed, null, 2));
      
      if (parsed.access_token) {
        console.log('\n✅ LOGIN SUCCESSFUL!');
        console.log('Access Token:', parsed.access_token.substring(0, 50) + '...');
        console.log('User:', parsed.user);
      } else if (parsed.error) {
        console.log('\n❌ LOGIN FAILED');
        console.log('Error:', parsed.error);
      }
    } catch (e) {
      console.log('Could not parse response as JSON');
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
});

req.write(data);
req.end();
