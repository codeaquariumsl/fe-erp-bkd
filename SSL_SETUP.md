# SSL/HTTPS Setup Guide

This guide explains how to enable SSL/HTTPS in your ERP Inventory Backend application.

## Overview

The application now supports both HTTP and HTTPS protocols:
- HTTP server runs on the port specified in `PORT` environment variable (default: 5000)
- HTTPS server runs on the port specified in `HTTPS_PORT` environment variable (default: 5443)

## Quick Start

### For Development (Self-Signed Certificates)

1. **Generate SSL certificates:**
   ```bash
   npm run generate-ssl
   ```
   
   Or for Windows PowerShell:
   ```powershell
   npm run generate-ssl-ps
   ```

2. **Update your .env file:**
   ```env
   SSL_KEY_PATH=./ssl/private.key
   SSL_CERT_PATH=./ssl/certificate.crt
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Access your application:**
   - HTTP: http://localhost:5000
   - HTTPS: https://localhost:5443 (you'll need to accept the self-signed certificate warning)

### For Production (Proper SSL Certificates)

1. **Obtain SSL certificates from a Certificate Authority (CA) like:**
   - Let's Encrypt (free)
   - DigiCert
   - GlobalSign
   - Your hosting provider

2. **Place your certificates in a secure location:**
   ```
   /etc/ssl/private/your-domain.key
   /etc/ssl/certs/your-domain.crt
   ```

3. **Update your .env file:**
   ```env
   SSL_KEY_PATH=/etc/ssl/private/your-domain.key
   SSL_CERT_PATH=/etc/ssl/certs/your-domain.crt
   ```

4. **Update ports for production:**
   ```env
   PORT=80
   HTTPS_PORT=443
   ```

## Environment Variables

Add these to your `.env` file:

```env
# HTTPS Configuration
HTTPS_PORT=5443                    # Port for HTTPS server
SSL_KEY_PATH=./ssl/private.key     # Path to private key file
SSL_CERT_PATH=./ssl/certificate.crt # Path to certificate file
```

## Certificate Generation Options

### Option 1: Node.js Script (Recommended for Development)
```bash
npm run generate-ssl
```

### Option 2: OpenSSL (if available)
```bash
# Generate private key
openssl genrsa -out ssl/private.key 2048

# Generate certificate
openssl req -new -x509 -key ssl/private.key -out ssl/certificate.crt -days 365 -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
```

### Option 3: PowerShell (Windows)
```powershell
npm run generate-ssl-ps
```

## Using Let's Encrypt for Production

For production environments, use Let's Encrypt for free SSL certificates:

1. **Install Certbot:**
   ```bash
   # Ubuntu/Debian
   sudo apt install certbot

   # CentOS/RHEL
   sudo yum install certbot
   ```

2. **Generate certificates:**
   ```bash
   sudo certbot certonly --standalone -d yourdomain.com
   ```

3. **Update .env:**
   ```env
   SSL_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem
   SSL_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
   ```

4. **Set up auto-renewal:**
   ```bash
   sudo crontab -e
   # Add: 0 12 * * * /usr/bin/certbot renew --quiet
   ```

## Security Considerations

### Production Security Headers

Add these security middleware to your Express app:

```javascript
const helmet = require('helmet');
app.use(helmet());
```

Install helmet:
```bash
npm install helmet
```

### Force HTTPS Redirect

To redirect all HTTP traffic to HTTPS:

```javascript
app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
        res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
        next();
    }
});
```

### Environment-Specific Configuration

```javascript
if (process.env.NODE_ENV === 'live') {
    // Force HTTPS in production
    app.use((req, res, next) => {
        if (!req.secure && req.get('x-forwarded-proto') !== 'https') {
            return res.redirect('https://' + req.get('host') + req.url);
        }
        next();
    });
}
```

## Troubleshooting

### Common Issues

1. **Certificate not found error:**
   - Verify file paths in .env
   - Check file permissions
   - Ensure certificates exist

2. **Self-signed certificate warnings:**
   - Normal for development
   - Add exception in browser
   - Use proper CA certificates for production

3. **Permission denied errors:**
   - Use sudo for ports < 1024
   - Or use port forwarding
   - Run as administrator on Windows

### Testing SSL Configuration

```bash
# Test SSL certificate
openssl s_client -connect localhost:5443 -servername localhost

# Check certificate details
openssl x509 -in ssl/certificate.crt -text -noout
```

## API Client Configuration

Update your API clients to use HTTPS:

```javascript
// Frontend configuration
const API_BASE_URL = process.env.NODE_ENV === 'live' 
    ? 'https://your-domain.com' 
    : 'https://localhost:5443';
```

## Deployment Notes

### Docker
```dockerfile
EXPOSE 80 443
```

### Nginx Reverse Proxy
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    location / {
        proxy_pass https://localhost:5443;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Scripts Reference

- `npm run generate-ssl` - Generate self-signed certificates (Node.js)
- `npm run generate-ssl-ps` - Generate certificates (PowerShell)
- `npm start` - Start server with SSL support
- `npm run dev` - Start development server with SSL support
