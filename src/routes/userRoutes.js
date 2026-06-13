const express = require('express');
const userController = require('../controllers/userController');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

// Note: authMiddleware is now applied at app level, so no need to apply it here

// User registration (requires authentication for tracking who created the user)
router.post('/register', roleMiddleware(['admin']), userController.register);

// Get user profile
router.get('/profile', userController.getProfile);

router.get('/sales-persons', userController.getAllSalesPersons);

// Get all users (admin only)
router.get('/', roleMiddleware(['admin']), userController.getAllUsers);

// Get user by ID
router.get('/:id', userController.getUserById);

// Update user information
router.put('/:id', roleMiddleware(['admin']), userController.updateUser);

// Delete user
router.delete('/:id', roleMiddleware(['admin']), userController.deleteUser);

// Get user permissions
router.get('/:id/permissions', userController.getUserPermissions);

// Legacy endpoints for backward compatibility
router.post('/create', roleMiddleware(['admin']), userController.createUser);
router.put('/update/:id', userController.updateUser);
router.delete('/delete/:id', roleMiddleware(['admin']), userController.deleteUser);
router.put('/:id/password', userController.updatePassword);

// Sales Person Customer Assignment
router.post('/:id/customers', roleMiddleware(['admin', 'admin']), userController.assignCustomers);
router.get('/:id/customers', userController.getAssignedCustomers);
router.delete('/:id/customers/:customerId', roleMiddleware(['admin', 'admin']), userController.removeAssignedCustomer);

module.exports = router;