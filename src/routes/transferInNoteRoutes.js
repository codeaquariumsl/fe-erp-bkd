const express = require('express');
const router = express.Router();
const transferInNoteController = require('../controllers/transferInNoteController');

// Get all Transfer In Notes
router.get('/', transferInNoteController.getAllTransferInNotes);

// Get Transfer In Note statistics
router.get('/stats', transferInNoteController.getTransferInNoteStats);

// Get Transfer In Note by ID
router.get('/:id', transferInNoteController.getTransferInNoteById);

// Update Transfer In Note (dispatch and receiving details)
router.put('/:id', transferInNoteController.updateTransferInNote);

// Dispatch Transfer In Note (change status to In_Transit)
router.patch('/:id/dispatch', transferInNoteController.dispatchTransferInNote);

// Receive Transfer In Note (change status to Received)
router.patch('/:id/receive', transferInNoteController.receiveTransferInNote);

// Approve Transfer In Note (finalize and update stock)
router.patch('/:id/approve', transferInNoteController.approveTransferInNote);

module.exports = router;