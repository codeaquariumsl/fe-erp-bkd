const express = require('express');
const router = express.Router();
const bankBranchController = require('../controllers/bankBranchController');

/**
 * Bank Branch Routes
 */

// Create Bank Branch
router.post('/', bankBranchController.createBankBranch);

// Get all Bank Branches
router.get('/', bankBranchController.getAllBankBranches);

// Get Branches by Bank ID (Helper)
router.get('/bank/:bankId', bankBranchController.getBranchesByBankId);

// Get Bank Branch by ID
router.get('/:id', bankBranchController.getBankBranchById);

// Update Bank Branch
router.put('/:id', bankBranchController.updateBankBranch);

// Delete Bank Branch
router.delete('/:id', bankBranchController.deleteBankBranch);

module.exports = router;
