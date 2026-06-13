const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batchController');

// ========================
// BATCH ROUTES
// ========================

// Batch routes
router.post('/', batchController.createBatch);
router.get('/', batchController.getBatches);
router.get('/expiring', batchController.getExpiringBatches);
router.post('/generate-batch-number', batchController.generateBatchNumber);
router.post('/auto-generate/grn/:grnId', batchController.autoGenerateBatchesFromGRN);
router.get('/grn/:grnId', batchController.getBatchesByGrnId);
router.get('/:id', batchController.getBatchById);
router.put('/:id', batchController.updateBatch);
router.delete('/:id', batchController.deleteBatch);

// ========================
// BATCH ITEM ROUTES
// ========================

// Batch Item routes
router.post('/items', batchController.createBatchItem);
router.get('/items', batchController.getBatchItems);
router.get('/items/summary', batchController.getBatchItemsSummary);
router.get('/items/batch/:batchId', batchController.getBatchItemsByBatchId);
router.get('/items/batch-by-item/:itemId', batchController.getBatchByItemId);
router.get('/items/item/:itemId', batchController.getBatchItemsByItemId);
router.get('/items/:id', batchController.getBatchItemById);
router.put('/items/:id', batchController.updateBatchItem);
router.put('/items/:id/quantity', batchController.updateAvailableQuantity);
router.delete('/items/:id', batchController.deleteBatchItem);

module.exports = router;