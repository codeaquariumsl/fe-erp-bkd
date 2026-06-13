const { User, Role, Permission, RolePermission, SalesPersonCustomer, Customer } = require('../models');
const Driver = require('../models/driver');
const bcrypt = require('bcryptjs');

// Create a new user
exports.createUser = async (req, res) => {
    try {
        const { username, password, email, fullName, mobile, status, roleId, locationId } = req.body;

        // Check if password exists
        if (!password) {
            return res.status(400).json({ message: 'Password is required' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);

        // Get createdBy from authenticated user, default to 1 if not available (for admin registration)
        const createdBy = req.user ? req.user.id : 1;

        const newUser = await User.create({
            username,
            password: hashedPassword,
            email,
            fullName,
            mobile,
            status: status || 'Active',
            roleId,
            createdBy,
            updatedBy: createdBy
        });

        // Check if the user role is "driver" and create driver record
        let driverCreated = false;
        if (roleId) {
            try {
                const userRole = await Role.findByPk(roleId);
                if (userRole && userRole.name.toLowerCase() === 'driver') {
                    await Driver.create({
                        userId: newUser.id,
                        name: fullName || username,
                        mobile: mobile || '',
                        status: status || 'Active',
                        locationId: locationId,
                        createdBy,
                        updatedBy: createdBy
                    });
                    driverCreated = true;
                    console.log('Driver record created for user:', newUser.id);
                }
            } catch (driverError) {
                console.error('Error creating driver record:', driverError);
                // Continue with user creation even if driver creation fails
            }
        }

        const userResponse = { ...newUser.toJSON() };
        delete userResponse.password;

        const response = {
            message: 'User created successfully',
            user: userResponse
        };

        if (driverCreated) {
            response.message = 'User and driver record created successfully';
        }

        res.status(201).json(response);
    } catch (error) {
        console.log(error);

        res.status(500).json({ message: 'Error creating user', error: error.message });
    }
};

// Get all users
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.findAll({ attributes: { exclude: ['password'] } });
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving users', error: error.message });
    }
};

// Get a user by ID
exports.getUserById = async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id,
            { attributes: { exclude: ['password'] } }
        );
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving user', error: error.message });
    }
};

exports.getAllSalesPersons = async (req, res) => {
    try {
        const user = await User.findAll({
            where: {
                roleId: 4
            },
            attributes: { exclude: ['password'] }
        }
        );
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving user', error: error.message });
    }
};

// Update a user
exports.updateUser = async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const { username, password, email, fullName, mobile, status, roleId } = req.body;
        let updateData = { username, email, fullName, mobile, status, roleId };
        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }
        await user.update(updateData);
        const userResponse = { ...user.toJSON() };
        delete userResponse.password;
        res.status(200).json({ message: 'User updated successfully', user: userResponse });
    } catch (error) {
        res.status(500).json({ message: 'Error updating user', error: error.message });
    }
};

// Update user password
exports.updatePassword = async (req, res) => {
    try {
        const userId = req.params.id;
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const currentUserId = (req.user && req.user.id) || null;

        // Validation
        if (!newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'New password and confirm password are required'
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'New password and confirm password do not match'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // Find the user
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if user is updating their own password or has admin privileges
        const isOwnPassword = currentUserId && currentUserId.toString() === userId.toString();
        const currentUser = currentUserId ? await User.findByPk(currentUserId, { include: [Role] }) : null;
        const isAdmin = currentUser && currentUser.Role && (currentUser.Role.name === 'admin' || currentUser.Role.name === 'super_admin');

        console.log('Password update request:', {
            userId,
            currentUserId,
            isOwnPassword,
            isAdmin,
            hasCurrentPassword: !!currentPassword
        });

        // If updating own password, verify current password
        if (isOwnPassword && currentPassword) {
            const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
            if (!isCurrentPasswordValid) {
                return res.status(400).json({
                    success: false,
                    message: 'Current password is incorrect'
                });
            }
        } else if (isOwnPassword && !currentPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password is required when updating your own password'
            });
        } else if (!isOwnPassword && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'You can only update your own password or you need admin privileges'
            });
        }

        // Hash the new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // Update the password
        await user.update({
            password: hashedNewPassword,
            updatedBy: currentUserId || userId
        });

        console.log('Password updated successfully for user:', userId);

        res.status(200).json({
            success: true,
            message: 'Password updated successfully',
            data: {
                userId: user.id,
                username: user.username,
                updatedAt: user.updatedAt
            }
        });

    } catch (error) {
        console.error('Error updating password:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating password',
            error: error.message
        });
    }
};

// Delete a user
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        await user.update({ status: 'Inactive' });

        // Update corresponding driver status to 'Inactive' if exists
        try {
            await Driver.update({ status: 'Inactive' }, { where: { userId: user.id } });
        } catch (driverError) {
            console.error('Error updating driver status:', driverError);
        }

        res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting user', error: error.message });
    }
};

// User login
exports.login = async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ where: { username } });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        // Remove password from response
        const userResponse = { ...user.toJSON() };
        delete userResponse.password;
        res.status(200).json({ message: 'Login successful', user: userResponse });
    } catch (error) {
        res.status(500).json({ message: 'Error logging in', error: error.message });
    }
};

// Get user profile
exports.getProfile = async (req, res) => {
    try {
        // Assuming user ID is available in req.user.id (set by auth middleware)
        const userId = req.user && req.user.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        const user = await User.findByPk(userId, {
            attributes: { exclude: ['password'] },
            include: [
                {
                    model: Role,
                    include: [
                        {
                            model: Permission,
                            as: 'permissions',
                            through: { attributes: [] }
                        }
                    ]
                }
            ]
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: user,
            message: 'Profile retrieved successfully'
        });
    } catch (error) {
        console.error('Error retrieving profile:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving profile',
            error: error.message
        });
    }
};

// Get user permissions
exports.getUserPermissions = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findByPk(id, {
            include: [
                {
                    model: Role,
                    include: [
                        {
                            model: Permission,
                            as: 'permissions',
                            through: { attributes: [] }
                        }
                    ]
                }
            ]
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Extract permission IDs from the user's role
        const permissions = user.Role ? user.Role.permissions.map(permission => permission.id) : [];

        res.json({
            success: true,
            data: permissions,
            message: 'User permissions retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching user permissions:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching user permissions',
            error: error.message
        });
    }
};

// Enhanced register/create user function
exports.register = async (req, res) => {
    try {
        const { username, password, email, fullName, mobile, status, roleId, locationId } = req.body;

        // Validation
        if (!username || !password || !email || !roleId) {
            return res.status(400).json({
                success: false,
                message: 'Username, password, email, and roleId are required'
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({
            where: {
                [require('sequelize').Op.or]: [
                    { username },
                    { email }
                ]
            }
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User with this username or email already exists'
            });
        }

        // Verify role exists
        const role = await Role.findByPk(roleId);
        if (!role) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role specified'
            });
        }

        // Additional validation for driver role
        if (role.name.toLowerCase() === 'driver') {
            if (!locationId) {
                return res.status(400).json({
                    success: false,
                    message: 'Location ID is required when creating a driver account'
                });
            }

            // Verify location exists
            const Location = require('../models/location');
            const location = await Location.findByPk(locationId);
            if (!location) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid location ID provided'
                });
            }
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Get createdBy from authenticated user, default to 1 if not available
        const createdBy = req.user ? req.user.id : 1;

        const newUser = await User.create({
            username,
            password: hashedPassword,
            email,
            fullName,
            mobile,
            status: status || 'Active',
            roleId,
            createdBy,
            updatedBy: createdBy
        });

        // Create driver record if role is driver
        let driverCreated = false;
        if (role.name.toLowerCase() === 'driver') {
            try {
                await Driver.create({
                    userId: newUser.id,
                    name: fullName || username,
                    mobile: mobile || '',
                    status: status || 'Active',
                    locationId: locationId,
                    createdBy,
                    updatedBy: createdBy
                });
                driverCreated = true;
            } catch (driverError) {
                console.error('Error creating driver record:', driverError);

                // If driver creation fails, delete the user record to maintain consistency
                await newUser.destroy();

                // Handle specific validation errors
                if (driverError.name === 'SequelizeValidationError') {
                    const errorMessages = driverError.errors.map(err => {
                        if (err.path === 'locationId') {
                            return 'Location ID is required for driver accounts';
                        }
                        if (err.path === 'mobile') {
                            return 'Mobile number is required for driver accounts';
                        }
                        return `${err.path}: ${err.message}`;
                    });

                    return res.status(400).json({
                        success: false,
                        message: 'Driver registration failed',
                        errors: errorMessages
                    });
                }

                // Handle foreign key constraint errors
                if (driverError.name === 'SequelizeForeignKeyConstraintError') {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid location ID provided'
                    });
                }

                // Generic error for other cases
                return res.status(500).json({
                    success: false,
                    message: 'Failed to create driver account. Please try again.'
                });
            }
        }

        // Return user without password
        const userResponse = await User.findByPk(newUser.id, {
            attributes: { exclude: ['password'] },
            include: [{ model: Role }]
        });

        res.status(201).json({
            success: true,
            data: {
                user: userResponse,
                driverCreated
            },
            message: 'User created successfully'
        });

    } catch (error) {
        console.error('Error creating user:', error);

        // Handle Sequelize validation errors
        if (error.name === 'SequelizeValidationError') {
            const errorMessages = error.errors.map(err => {
                if (err.path === 'email') {
                    return 'Please provide a valid email address';
                }
                if (err.path === 'username') {
                    return 'Username must be unique and valid';
                }
                return `${err.path}: ${err.message}`;
            });

            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errorMessages
            });
        }

        // Handle unique constraint errors
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({
                success: false,
                message: 'User with this username or email already exists'
            });
        }

        // Handle foreign key constraint errors
        if (error.name === 'SequelizeForeignKeyConstraintError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid role ID provided'
            });
        }

        // Handle database connection errors
        if (error.name === 'SequelizeConnectionError' || error.name === 'SequelizeHostNotFoundError') {
            return res.status(503).json({
                success: false,
                message: 'Database connection error. Please try again later.'
            });
        }

        // Generic error handler
        res.status(500).json({
            success: false,
            message: 'An unexpected error occurred while creating the user',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Assign customers to a sales person
exports.assignCustomers = async (req, res) => {
    try {
        const userId = req.params.id;
        const { customerIds } = req.body; // Array of customer IDs
        const currentUserId = (req.user && req.user.id) || 1;

        if (!Array.isArray(customerIds)) {
            return res.status(400).json({
                success: false,
                message: 'customerIds must be an array'
            });
        }

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Validate customers exist
        const customers = await Customer.findAll({
            where: {
                id: customerIds
            }
        });

        if (customers.length !== customerIds.length) {
            return res.status(400).json({
                success: false,
                message: 'One or more customer IDs are invalid'
            });
        }

        // Determine which customers are already assigned to avoid duplicates
        const existingAssignments = await SalesPersonCustomer.findAll({
            where: {
                userId: userId,
                customerId: customerIds
            }
        });

        const existingCustomerIds = existingAssignments.map(a => a.customerId);
        const newCustomerIds = customerIds.filter(id => !existingCustomerIds.includes(id));

        if (newCustomerIds.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'All selected customers are already assigned to this user',
                data: []
            });
        }

        const assignments = newCustomerIds.map(customerId => ({
            userId: userId,
            customerId: customerId,
            createdBy: currentUserId
        }));

        await SalesPersonCustomer.bulkCreate(assignments);

        res.status(200).json({
            success: true,
            message: `${newCustomerIds.length} customers assigned successfully`,
            data: newCustomerIds
        });

    } catch (error) {
        console.error('Error assigning customers:', error);
        res.status(500).json({
            success: false,
            message: 'Error assigning customers',
            error: error.message
        });
    }
};

// Get assigned customers for a sales person
exports.getAssignedCustomers = async (req, res) => {
    try {
        const userId = req.params.id;

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const assignedCustomers = await SalesPersonCustomer.findAll({
            where: { userId: userId },
            include: [
                {
                    model: Customer,
                    as: 'Customer',
                    attributes: ['id', 'name', 'address', 'contactPerson', 'contactNumber', 'locationId']
                }
            ],
            attributes: ['id', 'assignedDate']
        });

        const formattedCustomers = assignedCustomers.map(ac => ({
            assignmentId: ac.id,
            assignedDate: ac.assignedDate,
            ...ac.Customer.toJSON()
        }));

        res.status(200).json({
            success: true,
            data: formattedCustomers,
            message: 'Assigned customers retrieved successfully'
        });

    } catch (error) {
        console.error('Error retrieving assigned customers:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving assigned customers',
            error: error.message
        });
    }
};

// Remove assigned customer from a sales person
exports.removeAssignedCustomer = async (req, res) => {
    try {
        const userId = req.params.id; // User ID
        const customerId = req.params.customerId; // Customer ID (passed as param to be consistent)

        const assignment = await SalesPersonCustomer.findOne({
            where: {
                userId: userId,
                customerId: customerId
            }
        });

        // if assignment found remove it
        if (assignment) {
            await assignment.destroy();
        } else {
            // Find by assignment ID if passed instead of customerId, or handle appropriately
            // For now assuming customerId
            return res.status(404).json({
                success: false,
                message: 'Assignment not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Customer assignment removed successfully'
        });

    } catch (error) {
        console.error('Error removing customer assignment:', error);
        res.status(500).json({
            success: false,
            message: 'Error removing customer assignment',
            error: error.message
        });
    }
};