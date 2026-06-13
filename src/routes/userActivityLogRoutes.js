const express = require('express');
const router = express.Router();
const userActivityLogController = require('../controllers/userActivityLogController');
const roleMiddleware = require('../middleware/roleMiddleware');

// Note: authMiddleware is now applied at app level, so no need to apply it here

// Get all user activity logs (admin only)
router.get('/', roleMiddleware(['admin']), userActivityLogController.getUserActivityLogs);

// Get activity summary/statistics (admin only)
router.get('/summary', roleMiddleware(['admin']), userActivityLogController.getActivitySummary);

// Get current user's activity logs
router.get('/my-activity', userActivityLogController.getMyActivityLogs);

// Get activity logs for a specific user (admin only)
router.get('/user/:userId', roleMiddleware(['admin']), userActivityLogController.getUserActivityById);

// Cleanup old activity logs (admin only)
router.delete('/cleanup', roleMiddleware(['admin']), userActivityLogController.cleanupOldLogs);

module.exports = router;
