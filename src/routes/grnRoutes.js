const express = require('express');
const router = express.Router();
const grnController = require('../controllers/grnController');

router.post('/', grnController.createGRN);
router.patch('/:id/approve-reject', grnController.approveOrRejectGRN);
// Get GRN list and available qty for a selected item
router.get('/item-grn-availability', grnController.getItemGRNAvailability);
// Reservation management endpoints
router.post('/reserve', grnController.reserveGrnItemQuantity);
router.post('/release', grnController.releaseGrnItemQuantity);
router.get('/', grnController.getAllGRNs);
router.get('/:id', grnController.getGRNById);
router.put('/:id', grnController.updateGRN);
router.delete('/:id', grnController.deleteGRN);
// QC check a GRN after approval
router.post('/grns/:id/qc-check', grnController.qcCheckGRN);

// Sync existing Approved GRNs to transactions
router.post('/sync-transactions', grnController.syncApprovedGRNTransactions);
module.exports = router;
