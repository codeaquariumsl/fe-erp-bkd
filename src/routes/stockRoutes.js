const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');

// Stock transfer between stores
router.post('/transfer', stockController.transferStock);
// List all stock, filterable by item or store
router.get('/', stockController.getAllStock);
// Get stock for a specific item in all stores
router.get('/item/:itemId', stockController.getStockByItem);
// Get stock for all items in a specific store
router.get('/store/:storeId', stockController.getStockByStore);
// Get stock details for an item (optionally filter by store)
router.get('/item/:itemId/details', stockController.getStockDetailsForItem);

// Stock adjustment
router.post('/adjustment/create', stockController.createStockAdjustment); // body: { locationId, storeId, adjustmentDate, reason, notes, items: [ { itemId, batchId, systemQty, adjustedQty, newQty, remark } ] }
router.put('/adjustment/update/:id', stockController.updateStockAdjustment); // body: { reason, notes, items: [ { itemId, batchId, systemQty, adjustedQty, newQty, remark } ] }
router.post('/adjustment/approve/:id', stockController.approveStockAdjustment); // body: { approvedBy }
router.get('/adjustment/all', stockController.getAllStockAdjustments);
router.get('/adjustment/:id', stockController.getStockAdjustmentById);

// Stock reconciliation
router.post('/reconciliation/create', stockController.createStockReconciliation); // body: { locationId, storeId, reconciliationDate, notes, items: [ { itemId, batchId, systemQty, adjustedQty, newQty, remark } ] }
router.put('/reconciliation/update/:id', stockController.updateStockReconciliation); // body: { notes, items: [ { itemId, batchId, systemQty, adjustedQty, newQty, remark } ] }
router.post('/reconciliation/approve/:id', stockController.approveStockReconciliation); // body: { approvedBy }
router.get('/reconciliation/all', stockController.getAllStockReconciliations);
router.get('/reconciliation/:id', stockController.getStockReconciliationById);

// Direct (Legacy) - deprecated
router.post('/adjust', stockController.adjustStock); // body: { itemId, storeId, qty, weight, remark }
router.post('/reconcile', stockController.reconcileStock); // body: { itemId, storeId, qty, weight, remark }

module.exports = router;
