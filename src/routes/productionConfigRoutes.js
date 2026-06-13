const express = require('express');
const router = express.Router();
const productionConfigController = require('../controllers/productionConfigController');

// Production Config routes
router.post('/', productionConfigController.createProductionConfig);
router.get('/', productionConfigController.getProductionConfigs);
router.get('/location/:locationId', productionConfigController.getProductionConfigByLocation);
router.get('/:id', productionConfigController.getProductionConfigById);
router.put('/:id', productionConfigController.updateProductionConfig);
router.delete('/:id', productionConfigController.deleteProductionConfig);

module.exports = router;