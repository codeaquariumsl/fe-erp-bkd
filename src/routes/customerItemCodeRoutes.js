const express = require('express');
const router = express.Router();
const customerItemCodeController = require('../controllers/customerItemCodeController');

// Create a new customer item code
router.post('/', customerItemCodeController.createCustomerItemCode);

// Bulk create/update customer item codes
router.post('/bulk', customerItemCodeController.bulkUpsertCustomerItemCodes);

// Get all customer item codes with filters and pagination
router.get('/', customerItemCodeController.getCustomerItemCodes);

// Get customer item codes by customer ID
router.get('/customer/:customerId', customerItemCodeController.getCustomerItemCodesByCustomerId);

// Get customer item codes by item ID
router.get('/item/:itemId', customerItemCodeController.getCustomerItemCodesByItemId);

// Get customer item code by specific combination of customer, item, and location
router.get('/customer/:customerId/item/:itemId/location/:locationId', customerItemCodeController.getCustomerItemCodeByIds);

// Get customer item code by ID
router.get('/:id', customerItemCodeController.getCustomerItemCodeById);

// Update customer item code
router.put('/:id', customerItemCodeController.updateCustomerItemCode);

// Delete customer item code
router.delete('/:id', customerItemCodeController.deleteCustomerItemCode);

module.exports = router;