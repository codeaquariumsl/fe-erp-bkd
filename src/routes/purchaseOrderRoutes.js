const express = require('express');
const router = express.Router();
const purchaseOrderController = require('../controllers/purchaseOrderController');

router.post('/', purchaseOrderController.createPurchaseOrder);
router.get('/', purchaseOrderController.getPurchaseOrders);
router.get('/:id', purchaseOrderController.getPurchaseOrderById);
router.put('/:id', purchaseOrderController.updatePurchaseOrder);
router.delete('/:id', purchaseOrderController.deletePurchaseOrder);
router.patch('/:id/approve-reject', purchaseOrderController.approveOrRejectPurchaseOrder);
router.post('/available', purchaseOrderController.getAvailablePurchaseOrders);

module.exports = router;
