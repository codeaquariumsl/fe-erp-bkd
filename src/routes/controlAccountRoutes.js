const express = require('express');
const router = express.Router();
const controlAccountController = require('../controllers/controlAccountController');

/**
 * Control Account Routes
 */

// Create Control Account
router.post('/', controlAccountController.createControlAccount);

// Get all Control Accounts
router.get('/', controlAccountController.getAllControlAccounts);

// Get next Control Account code
router.get('/next-code', controlAccountController.getNextControlAccountCode);

// Get Control Account by ID
router.get('/:id', controlAccountController.getControlAccountById);

// Update Control Account
router.put('/:id', controlAccountController.updateControlAccount);

// Deactivate Control Account
router.post('/:id/deactivate', controlAccountController.deactivateControlAccount);

// Get Control Accounts by Type
router.get('/type/:controlType', controlAccountController.getControlAccountsByType);

module.exports = router;
