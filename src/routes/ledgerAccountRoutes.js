const express = require('express');
const router = express.Router();
const ledgerAccountController = require('../controllers/ledgerAccountController');

/**
 * Ledger Account Routes
 */

// Create Ledger Account
router.post('/', ledgerAccountController.createLedgerAccount);

// Get all Ledger Accounts with pagination
router.get('/', ledgerAccountController.getAllLedgerAccounts);

// Get all Ledger Accounts without pagination
router.get('/all', ledgerAccountController.getAllLedgerAccountsWithoutPagination);

// Get next Ledger Account code (accountCategoryId or controlAccountId) ex: /api/ledger-accounts/next-code?accountCategoryId=1 or /api/ledger-accounts/next-code?controlAccountId=1
router.get('/next-code', ledgerAccountController.getNextLedgerAccountCode);

// Get Ledger Account by Code (must be before /:id route)
router.get('/code/:code', ledgerAccountController.getLedgerByCode);

// Get Chart of Accounts (must be before /:id route)
router.get('/chart/all', ledgerAccountController.getChartOfAccounts);

// Get Expense Ledger Accounts (must be before /:id route)
router.get('/expense/all', ledgerAccountController.getExpenseLedgers);

// Get Payment Ledger Accounts (must be before /:id route)
router.get('/payment/all', ledgerAccountController.getPaymentLedgers);

//Get Bank Ledger Accounts (must be before /:id route)
router.get('/bank/all', ledgerAccountController.getBankLedgers);

// Setup System Ledgers
router.post('/setup/system', ledgerAccountController.setupSystemLedgers);

// Get Ledger Account by ID
router.get('/:id', ledgerAccountController.getLedgerAccountById);

// Update Ledger Account
router.put('/:id', ledgerAccountController.updateLedgerAccount);

// Deactivate Ledger Account
router.post('/:id/deactivate', ledgerAccountController.deactivateLedgerAccount);

module.exports = router;
