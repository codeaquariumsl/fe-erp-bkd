const express = require('express');
const router = express.Router();
const goodRequestNoteController = require('../controllers/goodRequestNoteController');

// Create a new Good Request Note
router.post('/', goodRequestNoteController.createGoodRequestNote);

// Get all Good Request Notes
router.get('/', goodRequestNoteController.getAllGoodRequestNotes);

// Get Good Request Note statistics
router.get('/stats', goodRequestNoteController.getGoodRequestNoteStats);

// Get Good Request Note by ID
router.get('/:id', goodRequestNoteController.getGoodRequestNoteById);

// Update Good Request Note
router.put('/:id', goodRequestNoteController.updateGoodRequestNote);

// Approve or Reject Good Request Note
router.patch('/:id/approve-reject', goodRequestNoteController.approveOrRejectGoodRequestNote);

// Delete Good Request Note
router.delete('/:id', goodRequestNoteController.deleteGoodRequestNote);

module.exports = router;