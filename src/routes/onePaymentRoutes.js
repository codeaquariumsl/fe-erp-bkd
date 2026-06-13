const express = require('express');
const router = express.Router();
const onePaymentController = require('../controllers/onePaymentController');
const { authMiddleware } = require('../middleware/authMiddlewareWithLogging');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// One-Payment CRUD operations
router.post('/', onePaymentController.createOnePayment);
router.get('/', onePaymentController.getAllOnePayments);
router.get('/:id', onePaymentController.getOnePaymentById);
router.put('/:id', onePaymentController.updateOnePayment);
router.delete('/:id', onePaymentController.deleteOnePayment);

// One-Payment Workflow
router.post('/:id/submit', onePaymentController.submitOnePayment);
router.post('/:id/approve', onePaymentController.approveOnePayment);
router.post('/:id/approve-and-post', onePaymentController.approveAndPostOnePayment);
router.post('/:id/post', onePaymentController.postOnePayment);
router.post('/:id/reject', onePaymentController.rejectOnePayment);
router.post('/:id/reverse', onePaymentController.reverseOnePayment);
router.post('/:id/cancel', onePaymentController.cancelOnePayment);

module.exports = router;
