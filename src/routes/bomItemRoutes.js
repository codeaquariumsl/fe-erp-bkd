const express = require('express');
const router = express.Router();
const bomItemController = require('../controllers/bomItemController');

// BOM Item routes
router.post('/', bomItemController.createBOMItem);
router.get('/', bomItemController.getBOMItems);
router.get('/calculate-cost', bomItemController.calculateBOMItemCost);
router.get('/bom/:bomId', bomItemController.getBOMItemsByBOMId);
router.put('/bom/:bomId/bulk-update', bomItemController.bulkUpdateBOMItems);
router.get('/:id', bomItemController.getBOMItemById);
router.put('/:id', bomItemController.updateBOMItem);
router.put('/:id/sequence', bomItemController.updateBOMItemSequence);
router.delete('/:id', bomItemController.deleteBOMItem);

module.exports = router;