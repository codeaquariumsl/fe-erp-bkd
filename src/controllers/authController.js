const { User, Role, Permission, Customer, Driver } = require('../models');
const jwt = require('../utils/jwt');
const bcrypt = require('bcryptjs');

exports.register = async (req, res) => {
    const { username, password, email, roleId } = req.body;

    try {
        // Hash the password before saving
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({ username, password: hashedPassword, email, roleId });
        // Remove password from response
        const userResponse = { ...newUser.toJSON() };
        delete userResponse.password;
        res.status(201).json({ 
            success: true,
            message: 'User registered successfully', 
            data: userResponse 
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error registering user', 
            error: error.message 
        });
    }
};

exports.login = async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ 
            where: { username }, 
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

        if (!user || !(await user.validatePassword(password))) {
            return res.status(401).json({ 
                success: false,
                message: 'Invalid credentials' 
            });
        }

        // Check if user is active
        if (user.status !== 'Active') {
            return res.status(401).json({
                success: false,
                message: 'Account is not active'
            });
        }

        // Generate token with user info
        const token = jwt.generateToken({ 
            id: user.id, 
            username: user.username,
            role: user.Role.name,
            roleId: user.Role.id 
        });
        
        // Prepare user response (without password)
        const userResponse = { ...user.toJSON() };
        delete userResponse.password;
        
        // Extract permissions
        const permissions = user.Role ? user.Role.permissions.map(p => p.id) : [];
        
        // Prepare response data
        const responseData = {
            token,
            user: userResponse,
            permissions
        };

        // Check user role and fetch additional data
        const roleName = user.Role.name.toLowerCase();
        
        try {
            if (roleName === 'customer') {
                // Find customer record associated with this user
                const customer = await Customer.findOne({
                    where: { email: user.email }
                });
                
                if (customer) {
                    const customerData = customer.toJSON();
                    
                    // If customer has no parent (parentId is null), find child customers
                    if (customer.parentId === null) {
                        const childCustomers = await Customer.findAll({
                            where: { 
                                parentId: customer.id,
                                status: 'active' 
                            },
                            attributes: ['id', 'name', 'email', 'contactNumber', 'address', 'type', 'status', 'createdAt']
                        });
                        
                        customerData.childCustomers = childCustomers.map(child => child.toJSON());
                        console.log(`**** Found ${childCustomers.length} child customers for parent customer:`, customer.id);
                    } else {
                        // If customer has a parent, optionally include parent info
                        const parentCustomer = await Customer.findByPk(customer.parentId, {
                            attributes: ['id', 'name', 'email', 'contactNumber', 'type']
                        });
                        
                        if (parentCustomer) {
                            customerData.parentCustomer = parentCustomer.toJSON();
                        }
                        customerData.childCustomers = [];
                    }
                    
                    responseData.customer = customerData;
                    console.log('**** Customer data included for user:', user.username);
                }
            } else if (roleName === 'driver') {
                // Find driver record associated with this user
                const driver = await Driver.findOne({
                    where: { userId: user.id }
                });
                
                if (driver) {
                    responseData.driver = driver.toJSON();
                    console.log('**** Driver data included for user:', user.username);
                }
            }
        } catch (roleError) {
            console.warn('Warning: Could not fetch role-specific data:', roleError.message);
            // Continue without role-specific data rather than failing the login
        }
        
        res.json({ 
            success: true,
            message: 'Login successful', 
            data: responseData
        });
        
        console.log('**** User logged in:', user.username, 'Role:', user.Role.name);
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error logging in', 
            error: error.message || error 
        });
    }
};