require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const https = require('https');
const fs = require('fs');
const db = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const roleRoutes = require('./routes/roleRoutes');
const permissionRoutes = require('./routes/permissionRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const locationRoutes = require('./routes/locationRoutes');
const storeRoutes = require('./routes/storeRoutes');
const routeRoutes = require('./routes/routeRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const itemRoutes = require('./routes/itemRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const customerRoutes = require('./routes/customerRoutes');
const purchaseOrderRoutes = require('./routes/purchaseOrderRoutes');
const grnRoutes = require('./routes/grnRoutes');
const stockRoutes = require('./routes/stockRoutes');
const dbModels = require('./models');
const salesOrderRoutes = require('./routes/salesOrderRoutes');
const driverRoutes = require('./routes/driverRoutes');
const deliveryOrderRoutes = require('./routes/deliveryOrderRoutes');
const deliveryOrderSummaryItemRoutes = require('./routes/deliveryOrderSummaryItemRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const coldRoomRoutes = require('./routes/coldRoomRoutes');
const documentRoutes = require('./routes/documentRoutes');
const palletRackRoutes = require('./routes/palletRackRoutes');
const palletRoutes = require('./routes/palletRoutes');
const grnScheduleItemRoutes = require('./routes/grnScheduleItem');
const reportRoutes = require('./routes/reportRoutes');
const userActivityLogRoutes = require('./routes/userActivityLogRoutes');
const timeSlotRoutes = require('./routes/timeSlot');
const returnTypeRoutes = require('./routes/returnTypeRoutes');
const unitRoutes = require('./routes/unitRoutes');
const batchRoutes = require('./routes/batchRoutes');
const productionConfigRoutes = require('./routes/productionConfigRoutes');
const bomRoutes = require('./routes/bomRoutes');
const productionOrderRoutes = require('./routes/productionOrderRoutes');
const supplierReturnRoutes = require('./routes/supplierReturnRoutes');
const customerReturnRoutes = require('./routes/customerReturnRoutes');
const creditNoteRoutes = require('./routes/creditNoteRoutes');
const supplierPaymentRoutes = require('./routes/supplierPaymentRoutes');
const goodRequestNoteRoutes = require('./routes/goodRequestNoteRoutes');
const issueNoteRoutes = require('./routes/issueNoteRoutes');
const transferInNoteRoutes = require('./routes/transferInNoteRoutes');
const customerItemCodeRoutes = require('./routes/customerItemCodeRoutes');
const itemPriceRoutes = require('./routes/itemPriceRoutes');
const paymentTypeRoutes = require('./routes/paymentTypeRoutes');
const receiptRoutes = require('./routes/receiptRoutes');
const mobileRoutes = require('./routes/mobileRoutes');
const customerCategoryDiscountRoutes = require('./routes/customerCategoryDiscountRoutes');
const chequeRoutes = require('./routes/chequeRoutes');

const accountTypeRoutes = require('./routes/accountTypeRoutes');
const accountCategoryRoutes = require('./routes/accountCategoryRoutes');
const controlAccountRoutes = require('./routes/controlAccountRoutes');
const ledgerAccountRoutes = require('./routes/ledgerAccountRoutes');
const journalEntryRoutes = require('./routes/journalEntryRoutes');
const autoPostingRuleRoutes = require('./routes/autoPostingRuleRoutes');
const billEntryRoutes = require('./routes/billEntryRoutes');
const billPaymentRoutes = require('./routes/billPaymentRoutes');
const onePaymentRoutes = require('./routes/onePaymentRoutes');
const fundsTransferRoutes = require('./routes/fundsTransferRoutes');
const bankRoutes = require('./routes/bankRoutes');
const bankBranchRoutes = require('./routes/bankBranchRoutes');
const accountingReportsRoutes = require('./routes/accountingReportsRoutes');
const bankReconciliationRoutes = require('./routes/bankReconciliationRoutes');
const pettyCashRoutes = require('./routes/pettyCashRoutes');
const bankDepositRoutes = require('./routes/bankDepositRoutes');

const { authMiddleware, optionalAuthMiddleware, logUserActivity } = require('./middleware/authMiddlewareWithLogging');

const app = express();

// Security middleware
app.use(helmet());

// HTTPS redirect in live environment
// if (process.env.NODE_ENV === 'live') {
//     app.use((req, res, next) => {
//         if (!req.secure && req.get('x-forwarded-proto') !== 'https') {
//             return res.redirect('https://' + req.get('host') + req.url);
//         }
//         next();
//     });
// }

app.use(morgan('dev'));
app.use(cors());
app.use(express.json());
app.use(express.text({ type: 'text/plain' }));

// Middleware to parse text/plain as JSON
app.use((req, res, next) => {
    if (req.get('Content-Type') === 'text/plain;charset=UTF-8' && req.body) {
        try {
            req.body = JSON.parse(req.body);
        } catch (e) {
            // If parsing fails, leave body as is
        }
    }
    next();
});

// Auth routes - use optional auth middleware for activity logging without requiring authentication
app.use('/api/auth', logUserActivity, optionalAuthMiddleware, authRoutes);

// Apply activity logging and authentication middleware to all other routes
app.use('/api/users', logUserActivity, authMiddleware, userRoutes);
app.use('/api/roles', logUserActivity, authMiddleware, roleRoutes);
app.use('/api/permissions', logUserActivity, authMiddleware, permissionRoutes);
app.use('/api/categories', logUserActivity, authMiddleware, categoryRoutes);
app.use('/api/locations', logUserActivity, authMiddleware, locationRoutes);
app.use('/api/stores', logUserActivity, authMiddleware, storeRoutes);
app.use('/api/routes', logUserActivity, authMiddleware, routeRoutes);
app.use('/api/vehicles', logUserActivity, authMiddleware, vehicleRoutes);
app.use('/api/items', logUserActivity, authMiddleware, itemRoutes);
app.use('/api/suppliers', logUserActivity, authMiddleware, supplierRoutes);
app.use('/api/customers', logUserActivity, authMiddleware, customerRoutes);
app.use('/api/purchase-orders', logUserActivity, authMiddleware, purchaseOrderRoutes);
app.use('/api/grns', logUserActivity, authMiddleware, grnRoutes);
app.use('/api/stock', logUserActivity, authMiddleware, stockRoutes);
app.use('/api/sales-orders', logUserActivity, authMiddleware, salesOrderRoutes);
app.use('/api/drivers', logUserActivity, authMiddleware, driverRoutes);
app.use('/api/delivery-orders', logUserActivity, authMiddleware, deliveryOrderRoutes);
app.use('/api/delivery-order-summary-items', logUserActivity, authMiddleware, deliveryOrderSummaryItemRoutes);
app.use('/api/invoices', logUserActivity, authMiddleware, invoiceRoutes);
app.use('/api/dashboard', logUserActivity, authMiddleware, dashboardRoutes);
app.use('/api/cold-rooms', logUserActivity, authMiddleware, coldRoomRoutes);
app.use('/api/pallet-racks', logUserActivity, authMiddleware, palletRackRoutes);
app.use('/api/pallets', logUserActivity, authMiddleware, palletRoutes);
app.use('/api/documents', logUserActivity, authMiddleware, documentRoutes);
app.use('/api/grn-schedule-items', logUserActivity, authMiddleware, grnScheduleItemRoutes);
app.use('/api/reports', logUserActivity, reportRoutes);
app.use('/api/activity-logs', logUserActivity, authMiddleware, userActivityLogRoutes);
app.use('/api/time-slots', logUserActivity, authMiddleware, timeSlotRoutes);
app.use('/api/return-types', logUserActivity, authMiddleware, returnTypeRoutes);
app.use('/api/units', logUserActivity, authMiddleware, unitRoutes);
app.use('/api/batches', logUserActivity, authMiddleware, batchRoutes);
app.use('/api/production-configs', logUserActivity, authMiddleware, productionConfigRoutes);
app.use('/api/boms', logUserActivity, authMiddleware, bomRoutes);
app.use('/api/production-orders', logUserActivity, authMiddleware, productionOrderRoutes);
app.use('/api/supplier-returns', logUserActivity, authMiddleware, supplierReturnRoutes);
app.use('/api/customer-returns', logUserActivity, authMiddleware, customerReturnRoutes);
app.use('/api/credit-notes', logUserActivity, authMiddleware, creditNoteRoutes);
app.use('/api/supplier-payments', logUserActivity, authMiddleware, supplierPaymentRoutes);
app.use('/api/good-request-notes', logUserActivity, authMiddleware, goodRequestNoteRoutes);
app.use('/api/issue-notes', logUserActivity, authMiddleware, issueNoteRoutes);
app.use('/api/transfer-in-notes', logUserActivity, authMiddleware, transferInNoteRoutes);
app.use('/api/customer-item-codes', logUserActivity, authMiddleware, customerItemCodeRoutes);
app.use('/api/customer-category-discounts', logUserActivity, authMiddleware, customerCategoryDiscountRoutes);
app.use('/api/item-prices', logUserActivity, authMiddleware, itemPriceRoutes);
app.use('/api/payment-types', logUserActivity, authMiddleware, paymentTypeRoutes);
app.use('/api/receipts', logUserActivity, authMiddleware, receiptRoutes);
app.use('/api/cheques', logUserActivity, authMiddleware, chequeRoutes);
app.use('/api/account-types', logUserActivity, authMiddleware, accountTypeRoutes);
app.use('/api/account-categories', logUserActivity, authMiddleware, accountCategoryRoutes);
app.use('/api/control-accounts', logUserActivity, authMiddleware, controlAccountRoutes);
app.use('/api/ledger-accounts', logUserActivity, authMiddleware, ledgerAccountRoutes);
app.use('/api/journal-entries', logUserActivity, authMiddleware, journalEntryRoutes);
app.use('/api/auto-posting-rules', logUserActivity, authMiddleware, autoPostingRuleRoutes);
app.use('/api/bill-entries', logUserActivity, authMiddleware, billEntryRoutes);
app.use('/api/bill-payments', logUserActivity, authMiddleware, billPaymentRoutes);
app.use('/api/one-payments', logUserActivity, authMiddleware, onePaymentRoutes);
app.use('/api/funds-transfers', logUserActivity, authMiddleware, fundsTransferRoutes);
app.use('/api/mobile', logUserActivity, authMiddleware, mobileRoutes);
app.use('/api/banks', logUserActivity, authMiddleware, bankRoutes);
app.use('/api/bank-branches', logUserActivity, authMiddleware, bankBranchRoutes);
app.use('/api/accounting', logUserActivity, accountingReportsRoutes);
app.use('/api/accounting/bank-reconciliations', logUserActivity, authMiddleware, bankReconciliationRoutes);
app.use('/api/petty-cash', logUserActivity, authMiddleware, pettyCashRoutes);
app.use('/api/bank-deposits', logUserActivity, authMiddleware, bankDepositRoutes);

// Simple test endpoint to verify middleware is working
app.get('/api/test', (req, res) => {
    console.log('Test endpoint hit - req.user:', req.user ? 'authenticated' : 'not authenticated');
    res.json({
        message: 'Test endpoint working',
        user: req.user ? req.user.username : 'anonymous',
        timestamp: new Date().toISOString()
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 9003;
const HOST = process.env.HOST || '0.0.0.0';
const HTTPS_PORT = process.env.HTTPS_PORT || 9004;

// SSL Certificate paths
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || null;
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || null;

function startServer() {
    // Start HTTP server
    app.listen(PORT, HOST, () => {
        console.log(`Code Aqua ERP — HTTP Server running on http://${HOST}:${PORT}`);
    });

    // Start HTTPS server if SSL certificates are available
    if (SSL_KEY_PATH && SSL_CERT_PATH) {
        try {
            const privateKey = fs.readFileSync(SSL_KEY_PATH, 'utf8');
            const certificate = fs.readFileSync(SSL_CERT_PATH, 'utf8');

            const credentials = {
                key: privateKey,
                cert: certificate
            };

            const httpsServer = https.createServer(credentials, app);
            httpsServer.listen(HTTPS_PORT, HOST, () => {
                console.log(`Code Aqua ERP — HTTPS Server running on https://${HOST}:${HTTPS_PORT}`);
            });
        } catch (error) {
            console.error('SSL certificates not found or invalid. Running HTTP only.');
            console.error('Error:', error.message);
        }
    } else {
        console.log('SSL certificates not configured. Running HTTP only.');
        console.log('To enable HTTPS, set SSL_KEY_PATH and SSL_CERT_PATH in your .env file');
    }
}

if (process.env.NODE_ENV === 'development') {
    dbModels.sequelize.sync({ alter: true }).then(() => {
        console.log('Code Aqua ERP — Database synced (development mode)');
        startServer();
    });
} else {
    startServer();
}

module.exports = app;