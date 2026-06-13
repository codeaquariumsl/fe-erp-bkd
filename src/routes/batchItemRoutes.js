const express = require('express');
const router = express.Router();
const batchItemController = require('../controllers/batchItemController');

// Batch Item routes
router.post('/', batchItemController.createBatchItem);
router.get('/', batchItemController.getBatchItems);
router.get('/summary', batchItemController.getBatchItemsSummary);
router.get('/batch/:batchId', batchItemController.getBatchItemsByBatchId);
router.get('/item/:itemId', batchItemController.getBatchItemsByItemId);
router.get('/:id', batchItemController.getBatchItemById);
router.put('/:id', batchItemController.updateBatchItem);
router.put('/:id/quantity', batchItemController.updateAvailableQuantity);
router.delete('/:id', batchItemController.deleteBatchItem);

module.exports = router;