const express = require('express');
const router = express.Router();
const palletController = require('../controllers/palletController');

router.post('/', palletController.createPallet);
router.get('/', palletController.listPallets);
router.get('/:id', palletController.getPallet);
router.put('/:id', palletController.updatePallet);
router.delete('/:id', palletController.deletePallet);

module.exports = router;
