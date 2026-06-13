# Big Hill Lanka ERP Inventory Backend - Quick Setup Script (PowerShell)

Write-Host "Big Hill Lanka ERP Inventory Backend - Quick Setup" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "Node.js is available: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Node.js is not installed. Please install Node.js first." -ForegroundColor Red
    exit 1
}

# Check if npm is installed
try {
    $npmVersion = npm --version
    Write-Host "npm is available: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: npm is not installed. Please install npm first." -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "SUCCESS: Dependencies installed successfully" -ForegroundColor Green

# Check if .env file exists
if (!(Test-Path ".env")) {
    Write-Host "ERROR: .env file not found. Please create .env file with required configuration." -ForegroundColor Red
    Write-Host "Required variables:" -ForegroundColor Yellow
    Write-Host "   - DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME" -ForegroundColor White
    Write-Host "   - JWT_SECRET, JWT_EXPIRATION" -ForegroundColor White
    Write-Host "   - PORT, HOST, NODE_ENV" -ForegroundColor White
    exit 1
}

Write-Host "SUCCESS: .env file found" -ForegroundColor Green

# Run admin seeder
Write-Host "Creating admin user..." -ForegroundColor Yellow
npm run seed:admin

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to create admin user" -ForegroundColor Red
    exit 1
}

Write-Host "SUCCESS: Admin user created successfully" -ForegroundColor Green

# Run permission seeder (if the script exists)
if (Test-Path "src/utils/seedPermissions.js") {
    Write-Host "Setting up permissions system..." -ForegroundColor Yellow
    npm run seed:permissions

    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to setup permissions" -ForegroundColor Red
        exit 1
    }

    Write-Host "SUCCESS: Permissions system setup successfully" -ForegroundColor Green
} else {
    Write-Host "INFO: Permission seeder not found, skipping..." -ForegroundColor Yellow
}

# Generate SSL certificates for development (optional)
Write-Host "Generating SSL certificates for development..." -ForegroundColor Yellow
npm run generate-ssl-node

if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: SSL certificate generation failed, but this is optional for development" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "SUCCESS: Setup completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "   1. Update your .env file with production values if needed" -ForegroundColor White
Write-Host "   2. Change the default admin password after first login" -ForegroundColor White
Write-Host "   3. Start the server with: npm start" -ForegroundColor White
Write-Host ""
Write-Host "Default access points:" -ForegroundColor Cyan
Write-Host "   - HTTP:  http://localhost:5000" -ForegroundColor White
Write-Host "   - HTTPS: https://localhost:5443 (if SSL is configured)" -ForegroundColor White
Write-Host ""
Write-Host "Default admin credentials:" -ForegroundColor Cyan
Write-Host "   - Username: admin" -ForegroundColor White
Write-Host "   - Password: admin" -ForegroundColor White
Write-Host "   - WARNING: CHANGE THIS PASSWORD IMMEDIATELY!" -ForegroundColor Red