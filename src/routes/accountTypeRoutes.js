const express = require('express');
const router = express.Router();
const accountTypeController = require('../controllers/accountTypeController');

/**
 * Account Type Routes
 * All routes require authentication
 */

// Create Account Type
router.post('/', accountTypeController.createAccountType);

// Get all Account Types
router.get('/', accountTypeController.getAllAccountTypes);

// Get Account Type by ID
router.get('/:id', accountTypeController.getAccountTypeById);

// Update Account Type
router.put('/:id', accountTypeController.updateAccountType);

// Deactivate Account Type
router.post('/:id/deactivate', accountTypeController.deactivateAccountType);

// Get Accounting Rules (Dr/Cr behavior)
router.get('/rules/all', accountTypeController.getAccountingRules);

module.exports = router;
