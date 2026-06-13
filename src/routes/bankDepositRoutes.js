const express = require('express');
const router = express.Router();
const bankDepositController = require('../controllers/bankDepositController');
const { authMiddleware } = require('../middleware/authMiddlewareWithLogging');

router.get('/pending-payments', authMiddleware, bankDepositController.getPendingPayments);
router.post('/', authMiddleware, bankDepositController.createBankDeposit);
router.get('/', authMiddleware, bankDepositController.getAllBankDeposits);
router.get('/:id', authMiddleware, bankDepositController.getBankDepositById);
router.post('/:id/post', authMiddleware, bankDepositController.postBankDeposit);
router.post('/:id/cancel', authMiddleware, bankDepositController.cancelBankDeposit);
router.delete('/:id', authMiddleware, bankDepositController.deleteBankDeposit);

module.exports = router;
