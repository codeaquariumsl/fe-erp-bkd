const express = require('express');
const router = express.Router();
const billEntryController = require('../controllers/billEntryController');
const { authMiddleware } = require('../middleware/authMiddlewareWithLogging');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Bill Entry CRUD operations
router.post('/', billEntryController.createBillEntry);
router.get('/', billEntryController.getAllBillEntries);
router.get('/:id', billEntryController.getBillEntryById);
router.put('/:id', billEntryController.updateBillEntry);
router.delete('/:id', billEntryController.deleteBillEntry);

// Bill Entry Workflow
router.post('/:id/submit', billEntryController.submitBillEntry);
router.post('/:id/approve', billEntryController.approveBillEntry);
router.post('/:id/post', billEntryController.postBillEntry);
router.post('/:id/reject', billEntryController.rejectBillEntry);

// Bill Entry Information
router.get('/:id/payment-history', billEntryController.getBillPaymentHistory);
router.get('/supplier/:supplierId/outstanding', billEntryController.getOutstandingBills);

// Bill Entry Details
router.get('/:billEntryId/details', billEntryController.getBillEntryDetails);
router.post('/:billEntryId/details', billEntryController.addBillEntryDetail);
router.put('/:billEntryId/details/:detailId', billEntryController.updateBillEntryDetail);
router.delete('/:billEntryId/details/:detailId', billEntryController.deleteBillEntryDetail);

module.exports = router;
