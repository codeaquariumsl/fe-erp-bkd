const express = require('express');
const router = express.Router();
const journalEntryController = require('../controllers/journalEntryController');

/**
 * Journal Entry Routes
 */

// Create Manual Journal Entry
router.post('/', journalEntryController.createManualJournalEntry);

// Get all Journal Entries
router.get('/', journalEntryController.getAllJournalEntries);

// Get Journal Entry by ID
router.get('/:id', journalEntryController.getJournalEntryById);

// Update Journal Entry
router.put('/:id', journalEntryController.updateJournalEntry);

// Submit Journal for Approval
router.post('/:id/submit', journalEntryController.submitJournalEntry);

// Approve Journal Entry
router.post('/:id/approve', journalEntryController.approveJournalEntry);

// Approve and Post Journal Entry
router.post('/:id/approve-and-post', journalEntryController.approveAndPostJournalEntry);

// Post Journal Entry
router.post('/:id/post', journalEntryController.postJournalEntry);

// Unpost Journal Entry (Admin only)
router.post('/:id/unpost', journalEntryController.unpostJournalEntry);

// Reject Journal Entry
router.post('/:id/reject', journalEntryController.rejectJournalEntry);

// Delete Draft Journal
router.delete('/:id', journalEntryController.deleteDraftJournal);

// Get Journal Audit Trail
router.get('/audit/trail', journalEntryController.getJournalAuditTrail);

module.exports = router;
