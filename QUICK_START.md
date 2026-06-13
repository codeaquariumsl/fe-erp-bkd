# 🚀 Quick Start Guide

## One-Command Setup (Windows)

```powershell
npm run setup-ps
```

## One-Command Setup (Linux/Mac)

```bash
npm run setup
```

## Manual Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create/update `.env` file:
```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_user
DB_PASSWORD=your_password
DB_NAME=erp_inventory

# Security
JWT_SECRET=your-super-secure-secret
JWT_EXPIRATION=1h

# Server
PORT=5000
HOST=0.0.0.0
NODE_ENV=live
```

### 3. Create Admin User
```bash
npm run seed:admin
```

### 4. Start Server
```bash
npm start
```

## 🌐 Access Points

- **HTTP**: http://localhost:5000
- **HTTPS**: https://localhost:5443 (if SSL configured)
- **Admin Login**: Username: `admin`, Password: `admin`

## 🔒 SSL Setup (Optional)

```bash
npm run generate-ssl-node
```

Then update `.env`:
```env
SSL_KEY_PATH=./ssl/private.key
SSL_CERT_PATH=./ssl/certificate.crt
```

## 📝 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run setup-ps` | Complete setup (Windows) |
| `npm run setup` | Complete setup (Linux/Mac) |
| `npm start` | Start production server |
| `npm run dev` | Start development server |
| `npm run seed:admin` | Create admin user |
| `npm run generate-ssl-node` | Generate SSL certificates |
| `npm run test-ssl` | Test SSL connection |

## ⚠️ Important Security Notes

1. **Change default admin password immediately**
2. **Use strong JWT secret in production**
3. **Use proper SSL certificates for production**
4. **Secure your database credentials**

## 📊 API Endpoints

Base URL: `http://localhost:5000/api/`

### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - User registration

### Core Modules
- `/users/` - User management
- `/categories/` - Category management
- `/items/` - Item management
- `/stock/` - Stock management
- `/suppliers/` - Supplier management
- `/customers/` - Customer management
- `/purchase-orders/` - Purchase orders
- `/sales-orders/` - Sales orders
- `/grns/` - Goods Receipt Notes
- `/delivery-orders/` - Delivery orders
- `/invoices/` - Invoice management
- `/reports/` - Reports and analytics

## 🐛 Troubleshooting

### Database Connection Issues
1. Verify database server is running
2. Check credentials in `.env`
3. Ensure database exists

### Port Already in Use
```bash
# Change PORT in .env file
PORT=5001
```

### SSL Certificate Issues
```bash
# Regenerate certificates
npm run generate-ssl-node
```

## 📖 Full Documentation

See `MIGRATION_SUMMARY.md` for complete deployment and configuration guide.
