const express = require('express');
const router = express.Router();
const fundsTransferController = require('../controllers/fundsTransferController');
const { authMiddleware } = require('../middleware/authMiddlewareWithLogging');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Funds Transfer CRUD operations
router.post('/', fundsTransferController.createFundsTransfer);
router.get('/', fundsTransferController.getAllFundsTransfers);
router.get('/:id', fundsTransferController.getFundsTransferById);
router.put('/:id', fundsTransferController.updateFundsTransfer);
router.delete('/:id', fundsTransferController.deleteFundsTransfer);

// Funds Transfer Workflow
router.post('/:id/submit', fundsTransferController.submitFundsTransfer);
router.post('/:id/approve', fundsTransferController.approveFundsTransfer);
router.post('/:id/post', fundsTransferController.postFundsTransfer);
router.post('/:id/reconcile', fundsTransferController.reconcileFundsTransfer);
router.post('/:id/reject', fundsTransferController.rejectFundsTransfer);
router.post('/:id/cancel', fundsTransferController.cancelFundsTransfer);

// Bank Account Summary
router.get('/account/:accountId/transfers', fundsTransferController.getBankAccountTransfers);

module.exports = router;
