const express = require('express');
const router = express.Router();
const bomController = require('../controllers/bomController');

// BOM routes (integrated with BOM items management)
router.post('/', bomController.createBOM);
router.get('/', bomController.getBOMs);
router.get('/item/:itemId', bomController.getBOMsByItemId);
router.get('/:id', bomController.getBOMById);
router.put('/:id', bomController.updateBOM);
router.delete('/:id', bomController.deleteBOM);

// Individual BOM Items management (for specific operations)
router.post('/:id/items', bomController.addItemToBOM);
router.put('/:id/items/:itemId', bomController.updateBOMItem);
router.delete('/:id/items/:itemId', bomController.removeItemFromBOM);

// BOM utilities
router.get('/:id/calculate-requirements', bomController.calculateMaterialRequirements);
router.post('/:id/duplicate', bomController.duplicateBOM);

module.exports = router;