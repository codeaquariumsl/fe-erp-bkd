const { Customer, User, Role, Route, LedgerAccount, ControlAccount, Category, CustomerCategoryDiscount, SalesPersonCustomer, sequelize } = require('../models');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');

// Create a new customer
exports.createCustomer = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const data = { ...req.body }; // Create a copy to avoid modifying const
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        console.log("Creating customer with data:", data);

        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        let route = null;
        if (data.routeId) {
            route = await Route.findByPk(data.routeId, { transaction: t });
            if (route && !data.locationId) {
                data.locationId = route.locationId;
                console.log(`Derived locationId ${data.locationId} from route ${data.routeId}`);
            }
        }

        if (!data.locationId) {
            await t.rollback();
            return res.status(400).json({
                error: 'Validation Error',
                message: 'locationId is required. Please provide a locationId or a valid routeId.'
            });
        }

        // 1. Find the Customer Control Account
        const controlAccount = await ControlAccount.findOne({
            where: { controlType: 'CUSTOMER', status: 'Active' },
            transaction: t
        });

        let ledgerAccountId = null;

        if (controlAccount) {
            // 2. Generate Next Ledger Code
            const prefixCode = controlAccount.code;
            const lastAccount = await LedgerAccount.findOne({
                where: {
                    controlAccountId: controlAccount.id,
                    ledgerCode: { [Op.like]: `${prefixCode}%` }
                },
                order: [['ledgerCode', 'DESC']],
                attributes: ['ledgerCode'],
                transaction: t
            });

            let nextNumber = 1;
            if (lastAccount && lastAccount.ledgerCode) {
                const numericPart = lastAccount.ledgerCode.substring(prefixCode.length);
                const lastNumber = parseInt(numericPart, 10);
                if (!isNaN(lastNumber)) {
                    nextNumber = lastNumber + 1;
                }
            }
            const ledgerCode = `${prefixCode}${String(nextNumber).padStart(3, '0')}`;

            // 3. Create Ledger Account
            const ledgerAccount = await LedgerAccount.create({
                ledgerCode,
                name: `Customer - ${data.name}`,
                description: `Auto-generated ledger for customer ${data.name}`,
                accountTypeId: controlAccount.accountTypeId,
                accountCategoryId: controlAccount.accountCategoryId,
                isUseControlAccount: true,
                controlAccountId: controlAccount.id,
                ledgerType: 'GENERAL',
                createdBy: currentUserId
            }, { transaction: t });

            ledgerAccountId = ledgerAccount.id;
        }

        let userResponse = {};

        if (data.type !== "Walk-in") {
            // ... (rest of the commented out user creation logic if needed)
        } else {
            data.type = "Walking";
        }

        // 4. Create customer
        const { categoryDiscounts, ...customerData } = data;
        const customer = await Customer.create({
            ...customerData,
            ledgerAccountId,
            createdBy: currentUserId,
            updatedBy: currentUserId
        }, { transaction: t });

        // If the current user has roleId: 4, assign this customer to them as a SalesPersonCustomer
        let userRoleId = req.user ? req.user.roleId : null;
        if (!userRoleId) {
            const user = await User.findByPk(currentUserId, { transaction: t });
            if (user) userRoleId = user.roleId;
        }

        if (userRoleId === 4) {
            await SalesPersonCustomer.create({
                userId: currentUserId,
                customerId: customer.id,
                createdBy: currentUserId,
                assignedDate: new Date()
            }, { transaction: t });
            console.log(`Assigned customer ${customer.id} to sales person ${currentUserId}`);
        }

        // 5. if customer has a routeId, then push it to the route's customerIds array
        if (route) {
            let customerIds = route.customerIds || [];
            if (!customerIds.includes(customer.id)) {
                customerIds.push(customer.id);
                await route.update({ customerIds }, { transaction: t });
            }
        }

        // 6. Handle category discounts if provided
        if (Array.isArray(categoryDiscounts) && categoryDiscounts.length > 0) {
            for (const disc of categoryDiscounts) {
                await CustomerCategoryDiscount.create({
                    customerId: customer.id,
                    categoryId: disc.categoryId,
                    discountPercentage: disc.discountPercentage,
                    createdBy: currentUserId
                }, { transaction: t });
            }
        }

        await t.commit();

        // Fetch new customer with details
        const newCustomer = await Customer.findByPk(customer.id, {
            include: [
                { model: LedgerAccount, as: 'LedgerAccount' },
                {
                    model: CustomerCategoryDiscount,
                    as: 'CategoryDiscounts',
                    include: [{ model: Category, as: 'Category', attributes: ['id', 'name', 'code'] }]
                }
            ]
        });

        res.status(201).json({ customer: newCustomer, user: userResponse });
    } catch (error) {
        if (t && !t.finished) await t.rollback();
        // ... (rest of error handling)

        // Re-implementing the error handling from original file for consistency
        if (error.name === 'SequelizeUniqueConstraintError') {
            const field = error.errors[0].path;
            const value = error.errors[0].value;
            let message = `${field} '${value}' already exists.`;
            return res.status(400).json({ error: 'Duplicate Entry', field, message });
        }
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({ error: 'Validation Error', details: error.errors.map(err => ({ field: err.path, message: err.message })) });
        }
        console.error('Customer creation error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
};

// Get all customers (optionally filter by type or parentId)
exports.getCustomersByFilter = async (req, res) => {
    try {
        const { type, parentId } = req.query;
        const where = {};
        if (type) where.type = type;
        if (parentId) where.parentId = parentId;
        const customers = await Customer.findAll({
            where,
            include: [{ model: LedgerAccount, as: 'LedgerAccount', attributes: ['id', 'ledgerCode', 'name'] }]
        });
        res.json(customers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get all customers
exports.getCustomers = async (req, res) => {
    const whereClause = { status: 'Active', locationId: req.query.locationId || { [Op.ne]: null } };
    try {
        const customers = await Customer.findAll({
            where: whereClause,
            include: [
                {
                    model: User,
                    as: 'createdByUser', attributes: ['id', 'username']
                },
                {
                    model: User, as: 'updatedByUser',
                    attributes: ['id', 'username']
                },
                {
                    model: LedgerAccount,
                    as: 'LedgerAccount',
                    attributes: ['id', 'ledgerCode', 'name']
                },
                {
                    model: CustomerCategoryDiscount,
                    as: 'CategoryDiscounts',
                    attributes: ['id', 'customerId', 'categoryId', 'discountPercentage'],
                    include: [{ model: Category, as: 'Category', attributes: ['id', 'name', 'code'] }]
                }
            ],
            order: [['name', 'ASC']]
        });

        // Get all routes to find which routes each customer belongs to
        const routes = await Route.findAll({
            attributes: ['id', 'routeName', 'description', 'city', 'customerIds', 'days', 'status'],
            where: {
                customerIds: { [Op.ne]: null }
            }
        });

        const customersWithDetails = customers.map(customer => {
            const customerObj = customer.toJSON();
            customerObj.createdByUsername = customerObj.createdByUser ? customerObj.createdByUser.username : null;
            customerObj.updatedByUsername = customerObj.updatedByUser ? customerObj.updatedByUser.username : null;
            delete customerObj.createdByUser;
            delete customerObj.updatedByUser;

            // Find routes that include this customer
            const customerRoutes = routes.filter(route =>
                route.customerIds &&
                Array.isArray(route.customerIds) &&
                route.customerIds.includes(customer.id)
            );

            customerObj.routes = customerRoutes.map(route => ({
                id: route.id,
                routeName: route.routeName,
                description: route.description,
                city: route.city,
                days: route.days,
                status: route.status
            }));

            return customerObj;
        });

        res.json(customersWithDetails);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get a single customer by ID
exports.getCustomerById = async (req, res) => {
    try {
        const customer = await Customer.findByPk(req.params.id, {
            include: [
                { model: User, as: 'createdByUser', attributes: ['id', 'username'] },
                { model: User, as: 'updatedByUser', attributes: ['id', 'username'] },
                { model: LedgerAccount, as: 'LedgerAccount', attributes: ['id', 'ledgerCode', 'name'] },
                {
                    model: CustomerCategoryDiscount,
                    as: 'CategoryDiscounts',
                    include: [{ model: Category, as: 'Category', attributes: ['id', 'name', 'code'] }]
                }
            ]
        });
        if (!customer) return res.status(404).json({ error: 'Customer not found' });

        const customerObj = customer.toJSON();
        customerObj.createdByUsername = customerObj.createdByUser ? customerObj.createdByUser.username : null;
        customerObj.updatedByUsername = customerObj.updatedByUser ? customerObj.updatedByUser.username : null;
        delete customerObj.createdByUser;
        delete customerObj.updatedByUser;

        // Find routes that include this customer
        const routes = await Route.findAll({
            attributes: ['id', 'routeName', 'description', 'city', 'startPoint', 'endPoint', 'distanceKm', 'estimateTime', 'customerIds', 'days', 'status', 'vehicleId', 'driverId'],
            where: sequelize.literal('customerIds IS NOT NULL')
        });

        const customerRoutes = routes.filter(route =>
            route.customerIds &&
            Array.isArray(route.customerIds) &&
            route.customerIds.includes(customer.id)
        );

        // Get vehicle and driver details for the routes
        const Vehicle = require('../models/vehicle');
        const Driver = require('../models/driver');

        const routesWithDetails = await Promise.all(customerRoutes.map(async route => {
            const routeObj = route.toJSON();

            // Add vehicle details if vehicleId exists
            if (routeObj.vehicleId) {
                try {
                    const vehicle = await Vehicle.findByPk(routeObj.vehicleId, {
                        attributes: ['id', 'vehicleNumber', 'model', 'capacity']
                    });
                    routeObj.vehicle = vehicle ? vehicle.toJSON() : null;
                } catch (error) {
                    console.warn('Error fetching vehicle:', error.message);
                    routeObj.vehicle = null;
                }
            }

            // Add driver details if driverId exists
            if (routeObj.driverId) {
                try {
                    const driver = await Driver.findByPk(routeObj.driverId, {
                        attributes: ['id', 'driverName', 'licenseNumber', 'mobile']
                    });
                    routeObj.driver = driver ? driver.toJSON() : null;
                } catch (error) {
                    console.warn('Error fetching driver:', error.message);
                    routeObj.driver = null;
                }
            }

            return routeObj;
        }));

        customerObj.routes = routesWithDetails;
        res.json(customerObj);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update a customer
exports.updateCustomer = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const data = { ...req.body }; // Create a copy to avoid modifying req.body
        const customer = await Customer.findByPk(req.params.id, { transaction: t });
        if (!customer) {
            await t.rollback();
            return res.status(404).json({ error: 'Customer not found' });
        }

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        // Update related user record if customer is not a walk-in customer
        let userResponse = {};
        // if (customer.type !== "Walk-in" && customer.type !== "Walking") {
        //     // Find the related user account by email or username
        //     const user = await User.findOne({
        //         where: {
        //             [Op.or]: [
        //                 { email: customer.email },
        //                 { username: data.username || customer.email }
        //             ]
        //         },
        //         transaction: t
        //     });

        //     if (user) {
        //         // Prepare user update data
        //         const userUpdateData = {
        //             updatedBy: currentUserId
        //         };

        //         // Update user fields if provided in request
        //         if (data.username) userUpdateData.username = data.username;
        //         if (data.email) userUpdateData.email = data.email;
        //         if (data.name) userUpdateData.fullName = data.name;
        //         if (data.contactNumber) userUpdateData.mobile = data.contactNumber;

        //         // Handle password update if provided
        //         if (data.password && data.password.trim() !== '') {
        //             const hashedPassword = await bcrypt.hash(data.password, 10);
        //             userUpdateData.password = hashedPassword;
        //             console.log('Password updated for user:', user.username);
        //         }

        //         // Update the user record
        //         await user.update(userUpdateData, { transaction: t });

        //         userResponse = { ...user.toJSON(), ...userUpdateData };
        //         // Remove password from response
        //         delete userResponse.password;

        //         console.log('Updated user record for customer:', customer.id);
        //     } else {
        //         console.warn('No user record found for customer:', customer.id);
        //     }
        // }

        // Handle route assignment
        if (data.routeId) {
            // First, remove customer from any existing routes
            const existingRoutes = await Route.findAll({
                where: sequelize.literal(`JSON_CONTAINS(customerIds, '${customer.id}')`),
                transaction: t
            });

            // Remove customer from all existing routes
            for (const existingRoute of existingRoutes) {
                // Ensure we have an array and all values are numbers
                let customerIds = Array.isArray(existingRoute.customerIds) ? existingRoute.customerIds : [];
                const customerId = parseInt(customer.id);

                // Remove any potential duplicates and non-numeric values
                customerIds = customerIds
                    .map(id => parseInt(id))
                    .filter(id => !isNaN(id) && id !== customerId);

                // Use raw update to ensure proper JSON formatting
                await sequelize.query(
                    'UPDATE routes SET customerIds = :customerIds WHERE id = :routeId',
                    {
                        replacements: {
                            customerIds: JSON.stringify(customerIds),
                            routeId: existingRoute.id
                        },
                        type: sequelize.QueryTypes.UPDATE,
                        transaction: t
                    }
                );

                console.log(`Removed customer ${customerId} from route ${existingRoute.id}. Updated customerIds:`, customerIds);
            }

            // Add customer to new route
            const newRoute = await Route.findByPk(data.routeId, { transaction: t });
            if (newRoute) {
                let customerIds = Array.isArray(newRoute.customerIds) ? newRoute.customerIds : [];
                const customerId = parseInt(customer.id);

                // Remove any potential duplicates and non-numeric values
                customerIds = customerIds
                    .map(id => parseInt(id))
                    .filter(id => !isNaN(id));

                if (!customerIds.includes(customerId)) {
                    customerIds.push(customerId);

                    // Use raw update to ensure proper JSON formatting
                    await sequelize.query(
                        'UPDATE routes SET customerIds = :customerIds WHERE id = :routeId',
                        {
                            replacements: {
                                customerIds: JSON.stringify(customerIds),
                                routeId: data.routeId
                            },
                            type: sequelize.QueryTypes.UPDATE,
                            transaction: t
                        }
                    );

                    console.log(`Added customer ${customerId} to route ${newRoute.id}. Updated customerIds:`, customerIds);
                }
            }
        }

        // Update customer record
        const { categoryDiscounts, ...customerFields } = data;
        const customerUpdateData = { ...customerFields, updatedBy: currentUserId };
        // Remove user-specific fields from customer update
        delete customerUpdateData.username;
        delete customerUpdateData.password;

        await customer.update(customerUpdateData, { transaction: t });

        // Handle category discounts if provided
        if (Array.isArray(categoryDiscounts)) {
            // Remove existing discounts first
            await CustomerCategoryDiscount.destroy({
                where: { customerId: customer.id },
                transaction: t
            });

            // Insert new ones
            for (const disc of categoryDiscounts) {
                await CustomerCategoryDiscount.create({
                    customerId: customer.id,
                    categoryId: disc.categoryId,
                    discountPercentage: disc.discountPercentage,
                    createdBy: currentUserId,
                    updatedBy: currentUserId
                }, { transaction: t });
            }
        }

        await t.commit();

        // Fetch updated customer with related data for response
        const updatedCustomer = await Customer.findByPk(customer.id, {
            include: [
                { model: User, as: 'createdByUser', attributes: ['id', 'username'] },
                { model: User, as: 'updatedByUser', attributes: ['id', 'username'] },
                { model: LedgerAccount, as: 'LedgerAccount', attributes: ['id', 'ledgerCode', 'name'] },
                {
                    model: CustomerCategoryDiscount,
                    as: 'CategoryDiscounts',
                    include: [{ model: Category, as: 'Category', attributes: ['id', 'name', 'code'] }]
                }
            ]
        });

        res.json({
            message: 'Customer updated successfully',
            customer: updatedCustomer,
            user: Object.keys(userResponse).length > 0 ? userResponse : null,
            userUpdated: Object.keys(userResponse).length > 0
        });
    } catch (error) {
        await t.rollback();

        // Handle different types of errors with meaningful messages
        if (error.name === 'SequelizeUniqueConstraintError') {
            const field = error.errors[0].path;
            const value = error.errors[0].value;

            let message = '';
            switch (field) {
                case 'username':
                    message = `Username '${value}' is already taken. Please choose a different username.`;
                    break;
                case 'email':
                    message = `Email '${value}' is already registered. Please use a different email address.`;
                    break;
                case 'mobile':
                    message = `Mobile number '${value}' is already registered. Please use a different mobile number.`;
                    break;
                default:
                    message = `${field} '${value}' already exists. Please use a different value.`;
            }

            return res.status(400).json({
                error: 'Duplicate Entry',
                field: field,
                message: message
            });
        }

        // Handle validation errors
        if (error.name === 'SequelizeValidationError') {
            const validationErrors = error.errors.map(err => ({
                field: err.path,
                message: err.message
            }));

            return res.status(400).json({
                error: 'Validation Error',
                details: validationErrors
            });
        }

        // Handle foreign key constraint errors
        if (error.name === 'SequelizeForeignKeyConstraintError') {
            let message = 'Invalid reference: ';
            if (error.fields.includes('roleId')) {
                message += 'The specified role does not exist.';
            } else if (error.fields.includes('routeId')) {
                message += 'The specified route does not exist.';
            } else {
                message += 'One or more referenced records do not exist.';
            }

            return res.status(400).json({
                error: 'Reference Error',
                message: message,
                field: error.fields.join(', ')
            });
        }

        // Log unexpected errors for debugging
        console.error('Customer update error:', error);

        // Generic error response for unexpected errors
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'An unexpected error occurred while updating the customer.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Delete a customer
exports.deleteCustomer = async (req, res) => {
    try {
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }
        const customer = await Customer.findByPk(req.params.id);
        if (!customer) return res.status(404).json({ error: 'Customer not found' });
        await customer.update({ status: 'deleted', updatedBy: currentUserId });
        res.json({ message: 'Customer deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
