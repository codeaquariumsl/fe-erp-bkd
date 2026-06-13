const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

// Install node-forge if not already installed
try {
    require('node-forge');
} catch (error) {
    console.log('Installing node-forge for certificate generation...');
    const { execSync } = require('child_process');
    execSync('npm install node-forge --save-dev', { stdio: 'inherit' });
}

function generateSelfSignedCertificate() {
    console.log('Generating self-signed SSL certificate using Node.js...');
    
    // Create ssl directory if it doesn't exist
    const sslDir = path.join(__dirname, '..', 'ssl');
    if (!fs.existsSync(sslDir)) {
        fs.mkdirSync(sslDir, { recursive: true });
    }
    
    try {
        // Generate key pair
        const keys = forge.pki.rsa.generateKeyPair(2048);
        
        // Create certificate
        const cert = forge.pki.createCertificate();
        cert.publicKey = keys.publicKey;
        cert.serialNumber = '01';
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date();
        cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
        
        const attrs = [{
            name: 'commonName',
            value: 'localhost'
        }, {
            name: 'countryName',
            value: 'US'
        }, {
            shortName: 'ST',
            value: 'State'
        }, {
            name: 'localityName',
            value: 'City'
        }, {
            name: 'organizationName',
            value: 'Development'
        }];
        
        cert.setSubject(attrs);
        cert.setIssuer(attrs);
        
        // Add extensions
        cert.setExtensions([{
            name: 'basicConstraints',
            cA: true
        }, {
            name: 'keyUsage',
            keyCertSign: true,
            digitalSignature: true,
            nonRepudiation: true,
            keyEncipherment: true,
            dataEncipherment: true
        }, {
            name: 'subjectAltName',
            altNames: [{
                type: 2, // DNS
                value: 'localhost'
            }, {
                type: 7, // IP
                ip: '127.0.0.1'
            }]
        }]);
        
        // Sign certificate
        cert.sign(keys.privateKey);
        
        // Convert to PEM format
        const pemCert = forge.pki.certificateToPem(cert);
        const pemKey = forge.pki.privateKeyToPem(keys.privateKey);
        
        // Write files
        const certPath = path.join(sslDir, 'certificate.crt');
        const keyPath = path.join(sslDir, 'private.key');
        
        fs.writeFileSync(certPath, pemCert);
        fs.writeFileSync(keyPath, pemKey);
        
        console.log('SSL certificates generated successfully!');
        console.log('Files created:');
        console.log(`- ${keyPath}`);
        console.log(`- ${certPath}`);
        console.log('\nTo use these certificates, update your .env file:');
        console.log('SSL_KEY_PATH=./ssl/private.key');
        console.log('SSL_CERT_PATH=./ssl/certificate.crt');
        
        return true;
    } catch (error) {
        console.error('Error generating SSL certificates:', error.message);
        return false;
    }
}

// Check if node-forge is available, if not, fall back to OpenSSL method
try {
    require('node-forge');
    generateSelfSignedCertificate();
} catch (error) {
    console.log('node-forge not available, trying OpenSSL method...');
    require('./generate-ssl-cert');
}
