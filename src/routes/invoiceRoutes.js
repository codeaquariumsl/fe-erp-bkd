const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');

router.post('/', invoiceController.createInvoice);
router.get('/', invoiceController.getAllInvoices);
router.get('/outstanding', invoiceController.getOutstandingInvoicesReport);
router.get('/outstanding-customers', invoiceController.getOutstandingCustomers);
router.post('/getInvoicesByDriver/:driverId', invoiceController.getInvoicesByDriverId);
router.get('/customer/:customerId', invoiceController.getInvoicesByCustomerId);
router.get('/:id', invoiceController.getInvoiceById);
router.put('/:id', invoiceController.updateInvoice);
router.delete('/:id', invoiceController.deleteInvoice);
router.patch('/:id/approve-reject', invoiceController.approveOrRejectInvoice);
router.patch('/:id/cancel', invoiceController.cancelInvoice);

module.exports = router;
