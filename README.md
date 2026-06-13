# Code Aqua ERP ERP Inventory Backend

A comprehensive ERP inventory management system built with Node.js, Express, and MySQL for Code Aqua ERP Solutions. Features include user management, role-based authentication, inventory tracking, order management, and secure SSL/HTTPS support.

## 🚀 Quick Start

### One-Command Setup

**Windows (PowerShell):**
```powershell
npm run setup-ps
```

**Linux/Mac:**
```bash
npm run setup
```

### Manual Setup

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd erp-inventory-backend
   npm install
   ```

2. **Configure Environment**
   Create `.env` file in root directory:
   ```env
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_NAME=erp_inventory
   
   # JWT Configuration
   JWT_SECRET=your-super-secure-jwt-secret-key
   JWT_EXPIRATION=1h
   
   # Server Configuration
   PORT=5000
   HOST=0.0.0.0
   HTTPS_PORT=5443
   NODE_ENV=live
   
   # SSL Configuration (Optional)
   SSL_KEY_PATH=./ssl/private.key
   SSL_CERT_PATH=./ssl/certificate.crt
   ```

3. **Create Admin User**
   ```bash
   npm run seed:admin
   ```

4. **Start Server**
   ```bash
   npm start
   ```

## 🌐 Access Points

- **HTTP**: http://localhost:5000
- **HTTPS**: https://localhost:5443 (if SSL configured)
- **Admin Login**: Username: `admin`, Password: `admin` (⚠️ Change immediately!)

## 📋 Table of Contents

- [Features](#features)
- [Available Scripts](#available-scripts)
- [API Endpoints](#api-endpoints)
- [Environment Variables](#environment-variables)
- [SSL/HTTPS Setup](#sslhttps-setup)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## ✨ Features

### Core Modules
- **User Management** - Create, update, delete users with role-based permissions
- **Authentication** - JWT-based secure authentication system
- **Inventory Management** - Complete item, category, and stock tracking
- **Order Management** - Purchase orders, sales orders, delivery management
- **Supplier & Customer Management** - Comprehensive contact management
- **Warehouse Management** - Location, store, cold room, and pallet tracking
- **Document Management** - GRN, invoices, and delivery documentation
- **Reporting** - Analytics and business intelligence reports
- **Multi-location Support** - Route and vehicle management

### Technical Features
- **Dual Protocol Support** - HTTP and HTTPS servers
- **SSL/TLS Security** - Production-ready encryption
- **Database Migrations** - Automated schema management
- **Security Headers** - Helmet.js integration
- **CORS Support** - Cross-origin resource sharing
- **Request Logging** - Morgan middleware
- **Error Handling** - Centralized error management

## 📝 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run setup-ps` | Complete setup for Windows (PowerShell) |
| `npm run setup` | Complete setup for Linux/Mac |
| `npm start` | Start production server |
| `npm run dev` | Start development server with nodemon |
| `npm run seed:admin` | Create admin user |
| `npm run generate-ssl-node` | Generate SSL certificates (Node.js) |
| `npm run generate-ssl` | Generate SSL certificates (OpenSSL) |
| `npm run generate-ssl-ps` | Generate SSL certificates (PowerShell) |
| `npm run test-ssl` | Test SSL connection |

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user and get JWT token

### User Management
- `GET /api/users` - Get all users (paginated)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user information
- `DELETE /api/users/:id` - Delete user
- `POST /api/users` - Create new user

### Role Management
- `GET /api/roles` - Get all roles
- `POST /api/roles` - Create new role
- `PUT /api/roles/:id` - Update role
- `DELETE /api/roles/:id` - Delete role

### Inventory Management
- `GET /api/categories` - Get all categories
- `POST /api/categories` - Create category
- `GET /api/items` - Get all items
- `POST /api/items` - Create item
- `GET /api/stock` - Get stock information
- `PUT /api/stock/:id` - Update stock levels

### Order Management
- `GET /api/purchase-orders` - Get purchase orders
- `POST /api/purchase-orders` - Create purchase order
- `GET /api/sales-orders` - Get sales orders
- `POST /api/sales-orders` - Create sales order
- `GET /api/delivery-orders` - Get delivery orders
- `POST /api/delivery-orders` - Create delivery order

### Business Partners
- `GET /api/suppliers` - Get all suppliers
- `POST /api/suppliers` - Create supplier
- `GET /api/customers` - Get all customers
- `POST /api/customers` - Create customer

### Warehouse Management
- `GET /api/locations` - Get warehouse locations
- `GET /api/stores` - Get store information
- `GET /api/cold-rooms` - Get cold room data
- `GET /api/pallets` - Get pallet information

### Documentation & Reports
- `GET /api/grns` - Get Goods Receipt Notes
- `GET /api/invoices` - Get invoices
- `GET /api/reports` - Get various reports
- `GET /api/dashboard` - Get dashboard analytics

## ⚙️ Environment Variables

### Required Variables
```env
# Database Configuration
DB_HOST=localhost                    # Database server host
DB_PORT=3306                        # Database server port
DB_USER=your_db_user                # Database username
DB_PASSWORD=your_db_password        # Database password
DB_NAME=erp_inventory               # Database name

# JWT Authentication
JWT_SECRET=your-super-secure-secret # JWT signing secret (use strong random string)
JWT_EXPIRATION=1h                   # Token expiration time

# Server Configuration
PORT=5000                           # HTTP server port
HOST=0.0.0.0                       # Server host (0.0.0.0 for all interfaces)
HTTPS_PORT=5443                     # HTTPS server port
NODE_ENV=live                       # Environment (development/live/production)
```

### Optional Variables (SSL/HTTPS)
```env
# SSL Certificate Configuration
SSL_KEY_PATH=./ssl/private.key      # Path to SSL private key
SSL_CERT_PATH=./ssl/certificate.crt # Path to SSL certificate
```

## 🔒 SSL/HTTPS Setup

### Development (Self-signed certificates)
```bash
# Generate certificates using Node.js
npm run generate-ssl-node

# Or using OpenSSL (if available)
npm run generate-ssl

# Or using PowerShell (Windows)
npm run generate-ssl-ps
```

### Production
1. Obtain SSL certificates from a Certificate Authority (CA)
2. Update `.env` with certificate paths
3. Use standard ports (80/443) for production

For detailed SSL setup instructions, see `SSL_SETUP.md`.

## 🛡️ Security

### Security Features
- **JWT Authentication** - Secure token-based authentication
- **Password Hashing** - bcrypt for secure password storage
- **Security Headers** - Helmet.js for HTTP security headers
- **CORS Protection** - Configurable cross-origin resource sharing
- **HTTPS Support** - SSL/TLS encryption for secure communication
- **Role-based Access** - Granular permission system

### Security Best Practices
1. **Change default admin password immediately**
2. **Use strong JWT secret (32+ characters)**
3. **Enable HTTPS in production**
4. **Use environment variables for sensitive data**
5. **Regularly update dependencies**
6. **Monitor application logs**

## 🐛 Troubleshooting

### Common Issues

**Database Connection Failed**
```bash
# Check database server status
# Verify credentials in .env file
# Ensure database exists
# Check network connectivity
```

**Port Already in Use**
```bash
# Change PORT in .env file
PORT=5001
HTTPS_PORT=5444
```

**SSL Certificate Errors**
```bash
# Regenerate certificates
npm run generate-ssl-node

# Verify certificate paths in .env
# Check file permissions
```

**Admin User Creation Failed**
```bash
# Ensure database is accessible
# Check if admin user already exists
# Verify database permissions
npm run seed:admin
```

### Development vs Production

**Development Mode:**
- Uses `{ alter: true }` for database sync
- Accepts self-signed SSL certificates
- More verbose logging

**Production Mode:**
- Uses `{ alter: false }` for database sync
- Requires valid SSL certificates
- Optimized for performance

## 📚 Additional Documentation

- `MIGRATION_SUMMARY.md` - Complete deployment guide
- `SSL_SETUP.md` - Detailed SSL configuration
- `QUICK_START.md` - Quick reference guide
- `api_collection/` - Postman API collections for testing

## 🏗️ Project Structure

```
fe-erp-bkd/
├── src/
│   ├── app.js              # Main application file
│   ├── config/
│   │   └── db.js           # Database configuration
│   ├── controllers/        # Route controllers
│   ├── middleware/         # Custom middleware
│   ├── models/            # Sequelize models
│   ├── routes/            # API routes
│   └── utils/             # Utility functions
├── scripts/               # Setup and utility scripts
├── ssl/                   # SSL certificates (generated)
├── api_collection/        # Postman collections
└── .env                   # Environment configuration
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

Code Aqua ERP ERP Inventory Backend - A comprehensive inventory management solution developed for Code Aqua ERP Solutions.

---

**Happy Coding! 🚀**

For support or questions, please check the documentation files or create an issue in the repository.

This project is licensed under the MIT License.