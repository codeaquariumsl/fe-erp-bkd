const express = require('express');
const router = express.Router();
const itemPriceController = require('../controllers/itemPriceController');

// Set or update price for a customer-item
router.post('/', itemPriceController.bulkSetItemPrices);
// Get price for a customer-item
router.get('/getCustomerWisePrice/:id', itemPriceController.getCustomerWisePrice);
router.get('/:customerId/:itemId', itemPriceController.getItemPrice);
// List all prices (filterable)
router.get('/', itemPriceController.listItemPrices);
// Delete a price entry
router.delete('/:id', itemPriceController.deleteItemPrice);
// Update item price for a customer-item
router.put('/:customerId/:itemId', itemPriceController.updateItemPrice);

module.exports = router;
