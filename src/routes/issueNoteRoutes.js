const express = require('express');
const router = express.Router();
const issueNoteController = require('../controllers/issueNoteController');

// Get all Issue Notes
router.get('/', issueNoteController.getAllIssueNotes);

// Get Issue Note statistics
router.get('/stats', issueNoteController.getIssueNoteStats);

// Get available batches for an item and location
router.get('/available-batches', issueNoteController.getAvailableBatches);

// Get Issue Note by ID
router.get('/:id', issueNoteController.getIssueNoteById);

// Update Issue Note (assign batches, adjust quantities)
router.put('/:id', issueNoteController.updateIssueNote);

// Approve or Reject Issue Note
router.patch('/:id/approve-reject', issueNoteController.approveOrRejectIssueNote);

// Delete Issue Note
router.delete('/:id', issueNoteController.deleteIssueNote);

module.exports = router;