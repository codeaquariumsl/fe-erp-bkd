const express = require('express');
const router = express.Router();
const coldRoomController = require('../controllers/coldRoomController');

// Create a new cold room
router.post('/', coldRoomController.createColdRoom);
// Get cold rooms for a store with available racks
router.get('/store/:storeId/cold-rooms-with-racks', coldRoomController.getStoreColdRoomsWithRacks);
// List cold rooms
router.get('/', coldRoomController.listColdRooms);
// List recent temperature logs (must be above /:id)
router.get('/logs', coldRoomController.listColdRoomLogs);
// Get cold room details
router.get('/:id', coldRoomController.getColdRoom);
// Update cold room
router.put('/:id', coldRoomController.updateColdRoom);
// Delete cold room
router.delete('/:id', coldRoomController.deleteColdRoom);

// Add item to cold room
router.post('/item', coldRoomController.addColdRoomItem);
// Delete cold room item
router.delete('/item/:id', coldRoomController.deleteColdRoomItem);

// Log temperature/humidity for a cold room
router.post('/log', coldRoomController.createColdRoomLog);
// List recent temperature logs
router.get('/logs', coldRoomController.listColdRoomLogs);
// Delete cold room log
router.delete('/log/:id', coldRoomController.deleteColdRoomLog);

// Update cold room settings
router.put('/:id/settings', coldRoomController.updateColdRoomSettings);
// Trigger maintenance
router.post('/:id/maintenance', coldRoomController.triggerMaintenance);

module.exports = router;
