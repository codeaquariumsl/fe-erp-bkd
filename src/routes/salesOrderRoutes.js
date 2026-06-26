const express = require('express');
const router = express.Router();
const salesOrderController = require('../controllers/salesOrderController');

router.post('/', salesOrderController.createSalesOrder);
router.post('/items-by-customer', salesOrderController.getSalesItemsByCustomer);
router.post('/items-by-customer-mobile', salesOrderController.getSalesItemsByCustomerMobile);
router.get('/', salesOrderController.getAllSalesOrders);
router.get('/:id', salesOrderController.getSalesOrderById);
router.get('/customer/:customerId', salesOrderController.getSalesOrdersByCustomerId);
router.put('/:id', salesOrderController.updateSalesOrder);
router.delete('/:id', salesOrderController.deleteSalesOrder);
router.patch('/:id/approve-reject', salesOrderController.approveOrRejectSalesOrder);
router.patch('/:id/cancel', salesOrderController.cancelSalesOrder);

module.exports = router;
