const express = require('express');
const router = express.Router();
const grnScheduleItemController = require('../controllers/grnScheduleItemController');

router.post('/', grnScheduleItemController.createGRNScheduleItem);
router.get('/', grnScheduleItemController.getGRNScheduleItems);
router.get('/schedule/:date/:itemId', grnScheduleItemController.getGRNByScheduleDateAndItem);
router.get('/:id', grnScheduleItemController.getGRNScheduleItemById);
router.put('/:id', grnScheduleItemController.updateGRNScheduleItem);
router.delete('/:id', grnScheduleItemController.deleteGRNScheduleItem);
router.get('/getCustomerWisePrice/:id', grnScheduleItemController.getCustomerWisePrice);

module.exports = router;
