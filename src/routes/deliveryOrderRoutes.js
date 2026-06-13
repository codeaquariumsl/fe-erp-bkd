const express = require('express');
const router = express.Router();
const deliveryOrderController = require('../controllers/deliveryOrderController');

router.post('/', deliveryOrderController.createDeliveryOrder);
router.get('/', deliveryOrderController.getAllDeliveryOrders);
router.get('/approved/driver/:driverId', deliveryOrderController.getApprovedDeliveryOrdersByDriver);

// Move all specific GET routes above the dynamic :id route
router.get('/lorry-stock', deliveryOrderController.getLorryStockBalances);
router.get('/store-stock', deliveryOrderController.getStoreStockBalances);
router.get('/stock-trace', deliveryOrderController.getDeliveryOrderStockTrace);
router.get('/lorry-unload-history', deliveryOrderController.getLorryUnloadHistory);
router.get('/item-results', deliveryOrderController.getDeliveryOrderItemResults);
router.post('/unload-items', deliveryOrderController.getUnloadDeliveryOrderItems);
router.get('/invoice', deliveryOrderController.getDeliveryOrderInvoice);

// Dynamic route should come after all specific routes
router.get('/:id', deliveryOrderController.getDeliveryOrderById);

router.put('/:id', deliveryOrderController.updateDeliveryOrder);
router.delete('/:id', deliveryOrderController.deleteDeliveryOrder);
router.patch('/:id/assign', deliveryOrderController.assignDriverRouteVehicle);
router.patch('/:id/approve-reject', deliveryOrderController.approveOrRejectDeliveryOrder);
router.post('/saved-summary', deliveryOrderController.getSavedDeliveryOrderSummary);
router.post('/items-with-summary', deliveryOrderController.getDeliveryOrderItemsWithSummary);
router.post('/clear-summary', deliveryOrderController.clearDeliveryOrderSummary);
router.post('/confirm', deliveryOrderController.confirmDeliveryOrder);
// confirm delivered POST /delivery-order/confirm-delivered body {deliveryOrderId: 1}
router.post('/confirm-delivered', deliveryOrderController.confirmDeliveredOrder);
router.post('/finalize', deliveryOrderController.finalizeDeliveryOrder);
router.post('/unload-do-lorry-balance', deliveryOrderController.unloadDeliveryOrderLorryBalance);

module.exports = router;
