const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

// Stock Reports
router.get('/stock-summary', reportController.getStockSummaryReport);
router.get('/stock-by-store/:storeId', reportController.getStockByStoreReport);
router.get('/stock-by-item/:itemId', reportController.getStockByItemReport);
router.get('/stock-movement-summary', reportController.getStockMovementSummaryReport);

// GRN Reports
router.get('/grn-summary', reportController.getGRNSummaryReport);
router.get('/grn-by-date-range', reportController.getGRNByDateRangeReport);
router.get('/grn-item-availability', reportController.getGRNItemAvailabilityReport);
router.get('/purchasing/item-wise', reportController.getItemWisePurchasingReport);
router.get('/purchasing/supplier-wise-po', reportController.getSupplierWisePurchaseOrderReport);

// GIN Reports
router.get('/gin-summary', reportController.getGINSummaryReport);
router.get('/gin-by-date-range', reportController.getGINByDateRangeReport);
router.get('/gin-transfers', reportController.getGINTransfersReport);

// Inventory Movement Reports
router.get('/stock-movements', reportController.getStockMovementsReport);
router.get('/stock-movements/:itemId', reportController.getItemStockMovementsReport);

// Enhanced Stock Movement Reports
router.get('/stock-movements/item/:itemId/detailed', reportController.getDetailedItemStockMovementReport);
router.get('/stock-movements/store/:storeId', reportController.getStockMovementByStoreReport);
router.get('/stock-movements/trends', reportController.getStockMovementTrendsReport);

// Sales Reports
router.get('/sales/summary', reportController.getSalesSummaryReport);
router.get('/sales/customer/:customerId', reportController.getSalesByCustomerReport);
router.get('/sales/item/:itemId', reportController.getSalesByItemReport);
router.get('/sales/date-range', reportController.getSalesByDateRangeReport);
router.get('/sales/top-items', reportController.getTopSellingItemsReport);
router.get('/sales/salesperson-commission', reportController.getSalespersonCommissionReport);
router.get('/sales/sales-person/:salesPersonId', reportController.getSalesBySalesPersonReport);

// Dashboard Reports
router.get('/low-stock-items', reportController.getLowStockItemsReport);
router.get('/expired-items', reportController.getExpiredItemsReport);
router.get('/inventory-valuation', reportController.getInventoryValuationReport);
router.get('/grn-value', reportController.getTotalInventoryValueFromApprovedGRNs);

// Bin Card Report
router.get('/bincard', reportController.getBinCardReport);

router.get('/general-sales', reportController.getGeneralSalesReport);
router.get('/rep-wise-sales', reportController.getRepWiseSalesReport);
router.get('/rep-wise-sales-orders', reportController.getRepWiseSalesOrdersReport);
router.get('/expenses', reportController.getExpensesReport);

module.exports = router;
