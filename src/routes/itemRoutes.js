const express = require('express');
const router = express.Router();
const itemController = require('../controllers/itemController');

router.post('/', itemController.createItem);
router.post('/:id/generate-sku', itemController.generateSKU);
router.post('/validate-sku/:id?', itemController.validateSKU);
router.get('/raw-materials', itemController.getRawMaterials);
router.get('/finished-goods', itemController.getFinishedGoods);
router.get('/with-schedule/:date/:storeId', itemController.getItemsWithSchedule);
router.get('/with-schedule/:itemId/:date', itemController.getItemWithSchedule);
router.get('/', itemController.getItems);
router.get('/:id', itemController.getItemById);
router.put('/:id', itemController.updateItem);
router.delete('/:id', itemController.deleteItem);

module.exports = router;
