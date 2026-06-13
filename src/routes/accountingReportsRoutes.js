const express = require('express');
const router = express.Router();
const accountingReportsController = require('../controllers/accountingReportsController');
const { authMiddleware } = require('../middleware/authMiddlewareWithLogging');

/**
 * ACCOUNTING REPORTS ROUTES
 * All routes require authentication
 */

/**
 * 1. TRIAL BALANCE ENDPOINT
 * Purpose: Verify that total debits equal credits
 * GET /api/accounting/trial-balance?asOfDate=YYYY-MM-DD
 */
router.get('/trial-balance', authMiddleware, accountingReportsController.getTrialBalance);

/**
 * 2. PROFIT & LOSS STATEMENT ENDPOINT
 * Purpose: Measure business performance
 * GET /api/accounting/profit-loss?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
router.get('/profit-loss', authMiddleware, accountingReportsController.getProfitAndLoss);

/**
 * 3. BALANCE SHEET ENDPOINT
 * Purpose: Show financial position on a specific date
 * GET /api/accounting/balance-sheet?asOfDate=YYYY-MM-DD
 */
router.get('/balance-sheet', authMiddleware, accountingReportsController.getBalanceSheet);

/**
 * 4. CUSTOMER OUTSTANDING (ACCOUNTS RECEIVABLE) ENDPOINT
 * Purpose: Track money customers still owe
 * GET /api/accounting/customer-outstanding?asOfDate=YYYY-MM-DD
 */
router.get('/customer-outstanding', authMiddleware, accountingReportsController.getCustomerOutstanding);

/**
 * 5. SUPPLIER OUTSTANDING (ACCOUNTS PAYABLE) ENDPOINT
 * Purpose: Track money owed to suppliers
 * GET /api/accounting/supplier-outstanding?asOfDate=YYYY-MM-DD
 */
router.get('/supplier-outstanding', authMiddleware, accountingReportsController.getSupplierOutstanding);

/**
 * 6. STOCK VALUATION ENDPOINT
 * Purpose: Show monetary value of inventory
 * GET /api/accounting/stock-valuation?asOfDate=YYYY-MM-DD
 */
router.get('/stock-valuation', authMiddleware, accountingReportsController.getStockValuation);

/**
 * 7. CASH & BANK BOOK ENDPOINT
 * Purpose: Track real money movement
 * GET /api/accounting/cash-bank-book?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
router.get('/cash-bank-book', authMiddleware, accountingReportsController.getCashAndBankBook);

/**
 * 8. LEDGER DETAILS REPORT ENDPOINT
 * Purpose: Show all transactions for a specific ledger account within a date range
 * GET /api/accounting/ledger-details?ledgerAccountId=123&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
router.get('/ledger-details', authMiddleware, accountingReportsController.getLedgerDetailsReport);

/**
 * 9. GENERAL LEDGER REPORT ENDPOINT
 * Purpose: Show transaction details for all ledger accounts within a date range
 * GET /api/accounting/general-ledger?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
router.get('/general-ledger', authMiddleware, accountingReportsController.getGeneralLedgerReport);

/**
 * DASHBOARD ENDPOINT
 * Purpose: Get comprehensive accounting overview
 * GET /api/accounting/dashboard
 */
router.get('/dashboard', authMiddleware, accountingReportsController.getAccountingDashboard);

module.exports = router;
