const express = require('express');
const router = express.Router();
const unitController = require('../controllers/unitController');

// CRUD routes for units
router.post('/', unitController.createUnit);
router.get('/', unitController.getUnits);
router.get('/active', unitController.getActiveUnits);
router.get('/types', unitController.getUnitTypes);
router.post('/convert', unitController.convertUnits);
router.get('/:id', unitController.getUnitById);
router.put('/:id', unitController.updateUnit);
router.delete('/:id', unitController.deleteUnit);

module.exports = router;