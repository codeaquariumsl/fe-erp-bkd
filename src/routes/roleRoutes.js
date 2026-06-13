const express = require('express');
const roleController = require('../controllers/roleController');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

// Note: authMiddleware is now applied at app level, so no need to apply it here

// Create a new role
router.post('/', roleMiddleware(['admin']), roleController.createRole);

// Get all roles
router.get('/', roleController.getAllRoles);

// Get a role by ID
router.get('/:id', roleController.getRoleById);

// Update a role
router.put('/:id', roleMiddleware(['admin']), roleController.updateRole);

// Delete a role
router.delete('/:id', roleMiddleware(['admin']), roleController.deleteRole);

// Get role permissions
router.get('/:id/permissions', roleController.getRolePermissions);

// Update role permissions
router.put('/:id/permissions', roleMiddleware(['admin']), roleController.updateRolePermissions);

// Assign role to user (legacy endpoint)
router.post('/assign', roleMiddleware(['admin']), roleController.assignRoleToUser);

module.exports = router;