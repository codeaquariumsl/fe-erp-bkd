const express = require('express');
const router = express.Router();
const customerCategoryDiscountController = require('../controllers/customerCategoryDiscountController');

router.post('/', customerCategoryDiscountController.upsertDiscount);
router.post('/bulk', customerCategoryDiscountController.bulkUpsertDiscounts);
router.get('/customer/:customerId', customerCategoryDiscountController.getDiscountsByCustomer);
router.get('/category/:categoryId', customerCategoryDiscountController.getDiscountsByCategory);
router.delete('/:id', customerCategoryDiscountController.deleteDiscount);

module.exports = router;
