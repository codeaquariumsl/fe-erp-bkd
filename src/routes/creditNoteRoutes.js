const express = require('express');
const router = express.Router();
const creditNoteController = require('../controllers/creditNoteController');

// Create credit note
router.post('/', creditNoteController.createCreditNote);

// Create credit note from customer return
router.post('/from-return', creditNoteController.createCreditNoteFromReturn);

// Get all credit notes
router.get('/', creditNoteController.getAllCreditNotes);

// Get customer available credit
router.get('/customer/:customerId/available-credit', creditNoteController.getCustomerAvailableCredit);

// Get credit notes by customer ID
router.get('/customer/:customerId', creditNoteController.getCreditNotesByCustomerId);

// Get credit note by ID
router.get('/:id', creditNoteController.getCreditNoteById);

// Get credit note items
router.get('/:id/items', creditNoteController.getCreditNoteItems);

// Update credit note
router.put('/:id', creditNoteController.updateCreditNote);

// Delete credit note
router.delete('/:id', creditNoteController.deleteCreditNote);

// Approve or reject credit note
router.patch('/:id/approve-reject', creditNoteController.approveOrRejectCreditNote);

// Apply credit note to invoice
router.post('/:id/apply', creditNoteController.applyCreditNoteToInvoice);

module.exports = router;
