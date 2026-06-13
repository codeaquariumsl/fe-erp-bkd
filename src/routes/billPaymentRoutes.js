const express = require('express');
const router = express.Router();
const billPaymentController = require('../controllers/billPaymentController');
const { authMiddleware } = require('../middleware/authMiddlewareWithLogging');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Bill Payment CRUD operations
router.post('/', billPaymentController.createBillPayment);
router.get('/', billPaymentController.getAllBillPayments);
router.get('/:id', billPaymentController.getBillPaymentById);
router.delete('/:id', billPaymentController.deleteBillPayment);
router.put('/:id', billPaymentController.updateBillPayment);

// Payment Entries
router.post('/:id/allocate', billPaymentController.allocatePaymentToBills);
router.get('/:id/entries', billPaymentController.getBillPaymentEntries);
router.get('/:id/allocations', billPaymentController.getBillPaymentEntries); // Keeping alias for compatibility

// Bill Payment Workflow
router.post('/:id/submit', billPaymentController.submitBillPayment);
router.post('/:id/approve', billPaymentController.approveBillPayment);
router.post('/:id/post', billPaymentController.postBillPayment);
router.post('/:id/reject', billPaymentController.rejectBillPayment);
router.post('/:id/cancel', billPaymentController.cancelBillPayment);

module.exports = router;
