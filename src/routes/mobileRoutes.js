const express = require('express');
const router = express.Router();
const mobileController = require('../controllers/mobileController');
// const { authenticate } = require('../middleware/auth'); // Assuming there's an auth middleware

// All routes are prefixed with /api/mobile in app.js

/**
 * @route   GET /api/mobile/dashboard/:salespersonId
 * @desc    Get dashboard summary for a salesperson
 */
router.get('/dashboard/:salespersonId', mobileController.getDashboardBySalespersonId);

/**
 * @route   GET /api/mobile/sales-orders/:salespersonId
 * @desc    Get sales orders for a salesperson
 */
router.get('/sales-orders/:salespersonId', mobileController.getSalesOrdersBySalespersonId);

/**
 * @route   GET /api/mobile/customers/:salespersonId
 * @desc    Get customers assigned to a salesperson
 */
router.get('/customers/:salespersonId', mobileController.getCustomersBySalespersonId);

/**
 * @route   GET /api/mobile/returns/:salespersonId
 * @desc    Get customer returns for a salesperson's customers
 */
router.get('/returns/:salespersonId', mobileController.getCustomerReturnsBySalespersonId);

/**
 * @route   GET /api/mobile/outstandings/:salespersonId
 * @desc    Get outstanding invoices for a salesperson
 */
router.get('/outstandings/:salespersonId', mobileController.getCustomerOutstandingsBySalespersonId);

module.exports = router;
