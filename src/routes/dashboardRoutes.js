const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

// GET /api/dashboard/summary
router.get('/summary', dashboardController.getSummary);

// GET /api/dashboard/main-details
router.get('/main-details', dashboardController.getMainDashboardDetails);

// GET /api/dashboard/low-stock
router.get('/low-stock', dashboardController.getLowStockItems);

// GET /api/dashboard/expired-items
router.get('/expired-items', dashboardController.getExpiredItems);

// GET /api/dashboard/overstock
router.get('/overstock', dashboardController.getOverstockItems);

module.exports = router;
