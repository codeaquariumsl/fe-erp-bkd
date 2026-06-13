const express = require('express');
const router = express.Router();
const deliveryOrderSummaryItemController = require('../controllers/deliveryOrderSummaryItemController');

// ===============================
// DELIVERY ORDER SUMMARY ROUTES
// ===============================

// Create delivery order summary with items (POST body: { orderIds: [], dateTime?, isScheduled? })
router.post('/', deliveryOrderSummaryItemController.createDeliveryOrderSummary);

// Get all delivery order summaries with pagination and filters
router.get('/', deliveryOrderSummaryItemController.getAllDeliveryOrderSummaries);

// Get delivery order summary by ID
router.get('/summary/:id', deliveryOrderSummaryItemController.getDeliveryOrderSummaryById);

// Update delivery order summary
router.put('/summary/:id', deliveryOrderSummaryItemController.updateDeliveryOrderSummary);

// Delete delivery order summary (soft delete)
router.delete('/summary/:id', deliveryOrderSummaryItemController.deleteDeliveryOrderSummary);

// ===============================
// DELIVERY ORDER SUMMARY ITEM ROUTES
// ===============================

// Get delivery order summary item by ID
router.get('/:id', deliveryOrderSummaryItemController.getDeliveryOrderSummaryItemById);

// Update delivery order summary item
router.put('/:id', deliveryOrderSummaryItemController.updateDeliveryOrderSummaryItem);

// Delete delivery order summary item (soft delete)
router.delete('/:id', deliveryOrderSummaryItemController.deleteDeliveryOrderSummaryItem);

// ===============================
// ADDITIONAL UTILITY ROUTES
// ===============================

// Get summary items grouped by route with filters (GET /route?routeId=1&date=2023-01-01&status=Pending)
router.get('/route/summary', deliveryOrderSummaryItemController.getDeliveryOrderSummaryByRoute);

// Get delivery order summaries grouped by timeslot (GET /timeslot?date=2023-01-01&routeId=1&currentTime=14:30)
router.post('/timeslot', deliveryOrderSummaryItemController.getDeliveryOrderSummariesByTimeslot);

// Bulk update summary items (POST body: { itemIds: [], updateData: { isReady: true, ... } })
router.put('/bulk/update', deliveryOrderSummaryItemController.bulkUpdateSummaryItems);

// Manual Batch assignment to summary item (POST body: { summaryItemId: 1, batchId: 1, qty?: 10 })
router.post('/assign-batch', deliveryOrderSummaryItemController.assignBatchToSummaryItem);

// Dispatch delivery order summary (POST body: { summaryId: 1, items: [{ id: 1, batchId: 1 }], user: { id: 1 } })
router.post('/dispatched', deliveryOrderSummaryItemController.dispatchDeliveryOrderSummary);

router.post('/getDeliveryOrderSummaryItemsByDriverId/:driverId', deliveryOrderSummaryItemController.getDeliveryOrderSummaryItemsByDriverId);
router.put('/:itemId/release', deliveryOrderSummaryItemController.releaseDeliveryOrderSummaryItem);

module.exports = router;
