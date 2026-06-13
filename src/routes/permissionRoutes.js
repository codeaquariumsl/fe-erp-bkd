const express = require('express');
const router = express.Router();
const permissionController = require('../controllers/permissionController');

// Note: authMiddleware is now applied at app level, so no need to apply it here

// Get all permissions
router.get('/', permissionController.getAllPermissions);

// Get permissions grouped by module
router.get('/by-module', permissionController.getPermissionsByModule);

// Create permission (usually done via seeding)
router.post('/', permissionController.createPermission);

// Update permission
router.put('/:id', permissionController.updatePermission);

// Delete permission
router.delete('/:id', permissionController.deletePermission);

module.exports = router;
