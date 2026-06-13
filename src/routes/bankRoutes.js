const express = require('express');
const router = express.Router();
const bankController = require('../controllers/bankController');

/**
 * Bank Routes
 */

// Create Bank
router.post('/', bankController.createBank);

// Get all Banks
router.get('/', bankController.getAllBanks);

// Get Bank by ID
router.get('/:id', bankController.getBankById);

// Update Bank
router.put('/:id', bankController.updateBank);

// Delete Bank (Soft Delete)
router.delete('/:id', bankController.deleteBank);

module.exports = router;
