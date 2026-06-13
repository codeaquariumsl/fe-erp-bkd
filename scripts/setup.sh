#!/bin/bash

# ERP Inventory Backend - Quick Setup Script

echo "🚀 ERP Inventory Backend - Quick Setup"
echo "======================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm are available"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Please create .env file with required configuration."
    echo "📝 Required variables:"
    echo "   - DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME"
    echo "   - JWT_SECRET, JWT_EXPIRATION"
    echo "   - PORT, HOST, NODE_ENV"
    exit 1
fi

echo "✅ .env file found"

# Run admin seeder
echo "👤 Creating admin user..."
npm run seed:admin

if [ $? -ne 0 ]; then
    echo "❌ Failed to create admin user"
    exit 1
fi

echo "✅ Admin user created successfully"

# Run permission seeder
echo "🔐 Setting up permissions system..."
npm run seed:permissions

if [ $? -ne 0 ]; then
    echo "❌ Failed to setup permissions"
    exit 1
fi

echo "✅ Permissions system setup successfully"

# Generate SSL certificates for development
echo "🔒 Generating SSL certificates for development..."
npm run generate-ssl-node

if [ $? -ne 0 ]; then
    echo "⚠️  SSL certificate generation failed, but this is optional for development"
fi

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "   1. Update your .env file with production values if needed"
echo "   2. Change the default admin password after first login"
echo "   3. Start the server with: npm start"
echo ""
echo "🌐 Default access points:"
echo "   - HTTP:  http://localhost:5000"
echo "   - HTTPS: https://localhost:5443 (if SSL is configured)"
echo ""
echo "👤 Default admin credentials:"
echo "   - Username: admin"
echo "   - Password: bhladmin@123"
echo "   - ⚠️  CHANGE THIS PASSWORD IMMEDIATELY!"
