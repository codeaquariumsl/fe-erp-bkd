const express = require('express');
const router = express.Router();
const accountCategoryController = require('../controllers/accountCategoryController');

/**
 * Account Category Routes
 */

// Create Account Category
router.post('/', accountCategoryController.createAccountCategory);

// Get all Account Categories
router.get('/', accountCategoryController.getAllAccountCategories);

// Get next Account Category code (must be before /:id route)
router.get('/next-code', accountCategoryController.getNextAccountCategoryCode);

// Get categories by Account Type
router.get('/type/:accountTypeId', accountCategoryController.getCategoriesByAccountType);

// Get Account Category by ID
router.get('/:id', accountCategoryController.getAccountCategoryById);

// Update Account Category
router.put('/:id', accountCategoryController.updateAccountCategory);

// Deactivate Account Category
router.post('/:id/deactivate', accountCategoryController.deactivateAccountCategory);

module.exports = router;
