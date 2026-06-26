const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const multer = require('multer');

const upload = multer();

router.post('/', upload.any(), customerController.createCustomer);
router.get('/', customerController.getCustomers);
router.get('/:id', customerController.getCustomerById);
router.put('/:id', upload.any(), customerController.updateCustomer);
router.delete('/:id', customerController.deleteCustomer);

module.exports = router;
