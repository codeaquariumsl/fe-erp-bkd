const express = require('express');
const router = express.Router();
const supplierPaymentController = require('../controllers/supplierPaymentController');

// CRUD operations for supplier payments
router.post('/', supplierPaymentController.createSupplierPayment);
router.get('/', supplierPaymentController.getSupplierPayments);
router.get('/stats', supplierPaymentController.getSupplierPaymentStats);
router.get('/outstanding', supplierPaymentController.getOutstandingPayments);
router.get('/outstanding-grns', supplierPaymentController.getOutstandingGRNs);
router.get('/:id', supplierPaymentController.getSupplierPaymentById);
router.put('/:id', supplierPaymentController.updateSupplierPayment);
router.delete('/:id', supplierPaymentController.deleteSupplierPayment);

// Special operations
router.put('/:id/approve', supplierPaymentController.approveSupplierPayment);
router.put('/:id/process', supplierPaymentController.processSupplierPayment);
router.put('/:id/cancel', supplierPaymentController.cancelSupplierPayment);

module.exports = router;