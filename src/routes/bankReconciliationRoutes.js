const express = require('express');
const router = express.Router();
const bankReconciliationController = require('../controllers/bankReconciliationController');

// ========== BANK RECONCILIATION ROUTES ==========

/**
 * @route   POST /api/accounting/bank-reconciliations
 * @desc    Create a new bank reconciliation
 * @access  Private
 */
router.post('/', bankReconciliationController.createBankReconciliation);

/**
 * @route   GET /api/accounting/bank-reconciliations
 * @desc    Get all bank reconciliations with filters
 * @access  Private
 * @query   bankAccountId, status, isBalanced, dateFrom, dateTo, page, limit
 */
router.get('/', bankReconciliationController.getAllBankReconciliations);

/**
 * @route   GET /api/accounting/bank-reconciliations/:id
 * @desc    Get bank reconciliation by ID
 * @access  Private
 */
router.get('/:id', bankReconciliationController.getBankReconciliationById);

/**
 * @route   PUT /api/accounting/bank-reconciliations/:id
 * @desc    Update bank reconciliation (Draft or In Progress only)
 * @access  Private
 */
router.put('/:id', bankReconciliationController.updateBankReconciliation);

/**
 * @route   DELETE /api/accounting/bank-reconciliations/:id
 * @desc    Delete bank reconciliation (Draft only)
 * @access  Private
 */
router.delete('/:id', bankReconciliationController.deleteBankReconciliation);

router.get('/unreconciled-transactions/:bankAccountId', bankReconciliationController.getUnreconciledTransactions);

/**
 * @route   GET /api/accounting/bank-reconciliations/unreconciled-transaction-details/:bankAccountId
 * @desc    Get unreconciled General Ledger transaction details for a bank account
 * @access  Private
 * @query   dateFrom, dateTo
 */
router.get('/unreconciled-transaction-details/:bankAccountId', bankReconciliationController.getUnreconciledTransactionDetails);

/**
 * @route   POST /api/accounting/bank-reconciliations/:id/items
 * @desc    Add items to reconciliation (book transactions or statement lines)
 * @access  Private
 */
router.post('/:id/items', bankReconciliationController.addReconciliationItems);

/**
 * @route   POST /api/accounting/bank-reconciliations/:id/match
 * @desc    Match book transaction with statement line
 * @access  Private
 */
router.post('/:id/match', bankReconciliationController.matchTransactions);

/**
 * @route   POST /api/accounting/bank-reconciliations/:id/unmatch
 * @desc    Unmatch transactions
 * @access  Private
 */
router.post('/:id/unmatch', bankReconciliationController.unmatchTransactions);

/**
 * @route   POST /api/accounting/bank-reconciliations/:id/complete
 * @desc    Complete reconciliation (mark as Reconciled)
 * @access  Private
 */
router.post('/:id/complete', bankReconciliationController.completeReconciliation);

/**
 * @route   POST /api/accounting/bank-reconciliations/:id/approve
 * @desc    Approve reconciliation
 * @access  Private
 */
router.post('/:id/approve', bankReconciliationController.approveReconciliation);

/**
 * @route   POST /api/accounting/bank-reconciliations/:id/reject
 * @desc    Reject reconciliation
 * @access  Private
 */
router.post('/:id/reject', bankReconciliationController.rejectReconciliation);

/**
 * @route   GET /api/accounting/bank-reconciliations/:id/summary
 * @desc    Get reconciliation summary/report
 * @access  Private
 */
router.get('/:id/summary', bankReconciliationController.getReconciliationSummary);

// ========== BANK STATEMENT ROUTES ==========

/**
 * @route   POST /api/accounting/bank-statements
 * @desc    Create a new bank statement
 * @access  Private
 */
router.post('/statements', bankReconciliationController.createBankStatement);

/**
 * @route   GET /api/accounting/bank-statements
 * @desc    Get all bank statements with filters
 * @access  Private
 * @query   bankAccountId, status, dateFrom, dateTo, page, limit
 */
router.get('/statements', bankReconciliationController.getAllBankStatements);

/**
 * @route   GET /api/accounting/bank-statements/:id
 * @desc    Get bank statement by ID
 * @access  Private
 */
router.get('/statements/:id', bankReconciliationController.getBankStatementById);

module.exports = router;
