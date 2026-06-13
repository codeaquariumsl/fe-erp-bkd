const express = require('express');
const router = express.Router();
const supplierReturnController = require('../controllers/supplierReturnController');

// CRUD operations for supplier returns
router.post('/', supplierReturnController.createSupplierReturn);
router.get('/', supplierReturnController.getSupplierReturns);
router.get('/stats', supplierReturnController.getSupplierReturnStats);
router.get('/:id', supplierReturnController.getSupplierReturnById);
router.put('/:id', supplierReturnController.updateSupplierReturn);
router.delete('/:id', supplierReturnController.deleteSupplierReturn);

// Special operations
router.put('/:id/approve', supplierReturnController.approveSupplierReturn);

module.exports = router;