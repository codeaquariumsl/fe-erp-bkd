const express = require('express');
const router = express.Router();
const palletRackController = require('../controllers/palletRackController');

router.post('/', palletRackController.createPalletRack);
router.get('/', palletRackController.listPalletRacks);
router.get('/:id', palletRackController.getPalletRack);
router.put('/:id', palletRackController.updatePalletRack);
router.delete('/:id', palletRackController.deletePalletRack);

module.exports = router;
