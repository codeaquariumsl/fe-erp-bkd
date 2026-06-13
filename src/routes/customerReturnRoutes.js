const express = require('express');
const router = express.Router();
const customerReturnController = require('../controllers/customerReturnController');

// CRUD operations for customer returns
router.post('/', customerReturnController.createCustomerReturn);
router.get('/', customerReturnController.getCustomerReturns);
router.get('/stats', customerReturnController.getCustomerReturnStats);
router.get('/:id', customerReturnController.getCustomerReturnById);
router.put('/:id', customerReturnController.updateCustomerReturn);
router.delete('/:id', customerReturnController.deleteCustomerReturn);

// Special operations
router.get('/invoice-remaining/:invoiceId', customerReturnController.getInvoiceRemainingQty);
router.put('/:id/approve', customerReturnController.approveCustomerReturn);

module.exports = router;
