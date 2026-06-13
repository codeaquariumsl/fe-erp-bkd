const express = require('express');
const router = express.Router();
const timeSlotController = require('../controllers/timeSlotController');

// Create a new time slot
router.post('/', timeSlotController.createTimeSlot);

// Get all time slots
router.get('/', timeSlotController.getAllTimeSlots);

// Get time slots by type (bulk, special, regular)
router.get('/type/:type', timeSlotController.getTimeSlotsByType);

// Get a single time slot by ID
router.get('/:id', timeSlotController.getTimeSlotById);

// Update a time slot
router.put('/:id', timeSlotController.updateTimeSlot);

// Soft delete a time slot (deactivate)
router.delete('/:id', timeSlotController.deleteTimeSlot);

// Hard delete a time slot (permanent deletion)
router.delete('/:id/permanent', timeSlotController.permanentDeleteTimeSlot);

// Restore a deactivated time slot
router.patch('/:id/restore', timeSlotController.restoreTimeSlot);

module.exports = router;
