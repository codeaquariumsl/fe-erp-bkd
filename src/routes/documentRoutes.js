const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');

// Generate document number
router.post('/generate', documentController.generateDocumentNumber);
// List all document sequences
router.get('/', documentController.listDocumentSequences);
// Get a document sequence by type
router.get('/:documentType', documentController.getDocumentSequence);
// Create a new document sequence
router.post('/', documentController.createDocumentSequence);
// Update a document sequence
router.put('/:documentType', documentController.updateDocumentSequence);
// Delete a document sequence
router.delete('/:documentType', documentController.deleteDocumentSequence);

module.exports = router;
