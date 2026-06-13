const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Create ssl directory if it doesn't exist
const sslDir = path.join(__dirname, '..', 'ssl');
if (!fs.existsSync(sslDir)) {
    fs.mkdirSync(sslDir, { recursive: true });
}

try {
    console.log('Generating self-signed SSL certificate for development...');
    
    // Generate private key
    execSync(`openssl genrsa -out ${path.join(sslDir, 'private.key')} 2048`, { stdio: 'inherit' });
    
    // Generate certificate
    execSync(`openssl req -new -x509 -key ${path.join(sslDir, 'private.key')} -out ${path.join(sslDir, 'certificate.crt')} -days 365 -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"`, { stdio: 'inherit' });
    
    console.log('SSL certificates generated successfully!');
    console.log('Files created:');
    console.log(`- ${path.join(sslDir, 'private.key')}`);
    console.log(`- ${path.join(sslDir, 'certificate.crt')}`);
    console.log('\nTo use these certificates, update your .env file:');
    console.log('SSL_KEY_PATH=./ssl/private.key');
    console.log('SSL_CERT_PATH=./ssl/certificate.crt');
    
} catch (error) {
    console.error('Error generating SSL certificates:', error.message);
    console.log('\nAlternative: You can generate certificates manually using:');
    console.log('1. openssl genrsa -out ssl/private.key 2048');
    console.log('2. openssl req -new -x509 -key ssl/private.key -out ssl/certificate.crt -days 365');
}
