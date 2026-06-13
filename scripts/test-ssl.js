const https = require('https');
const http = require('http');

// Test HTTP endpoint
console.log('Testing HTTP endpoint...');
http.get('http://localhost:5000/api/auth', (res) => {
    console.log(`HTTP Status: ${res.statusCode}`);
    console.log('✅ HTTP server is accessible');
}).on('error', (err) => {
    console.log('❌ HTTP server error:', err.message);
});

// Test HTTPS endpoint (with self-signed certificate)
console.log('Testing HTTPS endpoint...');
const options = {
    hostname: 'localhost',
    port: 5443,
    path: '/api/auth',
    method: 'GET',
    rejectUnauthorized: false // Allow self-signed certificates for testing
};

https.get(options, (res) => {
    console.log(`HTTPS Status: ${res.statusCode}`);
    console.log('✅ HTTPS server is accessible');
    console.log('🔒 SSL/TLS connection established successfully');
}).on('error', (err) => {
    console.log('❌ HTTPS server error:', err.message);
});

console.log('\n📝 Access your application at:');
console.log('HTTP:  http://localhost:5000');
console.log('HTTPS: https://localhost:5443');
console.log('\n⚠️  Note: You may see a security warning for the self-signed certificate.');
console.log('   This is normal for development. Click "Advanced" → "Proceed to localhost"');
