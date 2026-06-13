const express = require('express');
const router = express.Router();
const productionOrderController = require('../controllers/productionOrderController');

// Production Order routes
router.post('/', productionOrderController.createProductionOrder);
router.post('/generate-code', productionOrderController.generateProductionOrderCode);
router.get('/', productionOrderController.getProductionOrders);
router.get('/dashboard', productionOrderController.getProductionDashboard);
router.get('/status/:status', productionOrderController.getProductionOrdersByStatus);
router.get('/:id', productionOrderController.getProductionOrderById);
router.put('/:id', productionOrderController.updateProductionOrder);
router.put('/:id/status', productionOrderController.updateProductionOrderStatus);
router.delete('/:id', productionOrderController.deleteProductionOrder);

module.exports = router;