const express = require('express');
const router = express.Router();
const chequeController = require('../controllers/chequeController');

// Get all cheques in hand
router.get('/in-hand', chequeController.getChequesInHand);

// Cancel a cheque
router.post('/cancel', chequeController.cancelCheque);

// Get deposited cheques
router.get('/deposited', chequeController.getDepositedCheques);

// Return a deposited cheque
router.post('/return', chequeController.returnCheque);
// Get returned/cancelled cheques for a customer for settlement
router.get('/for-settlement/:customerId', chequeController.getCustomerChequesForSettlement);

module.exports = router;
