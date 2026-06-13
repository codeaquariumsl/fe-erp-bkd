const express = require('express');
const router = express.Router();
const returnTypeController = require('../controllers/returnTypeController');

// CRUD routes for return types
router.post('/', returnTypeController.createReturnType);
router.get('/', returnTypeController.getReturnTypes);
router.get('/active', returnTypeController.getActiveReturnTypes);
router.get('/:id', returnTypeController.getReturnTypeById);
router.put('/:id', returnTypeController.updateReturnType);
router.delete('/:id', returnTypeController.deleteReturnType);

module.exports = router;