const { Op } = require('sequelize');
const CustomerItemCode = require('../models/customerItemCode');
const Customer = require('../models/customer');
const Item = require('../models/item');
const Location = require('../models/location');
const User = require('../models/user');
const Category = require('../models/category');
const { sequelize } = require('../models');

// Create a new customer item code
exports.createCustomerItemCode = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { customerId, itemId, code, locationId, isActive } = req.body;

        // Validate required fields
        if (!customerId || !itemId || !code || !locationId) {
            await transaction.rollback();
            return res.status(400).json({
                error: 'Customer ID, Item ID, Code, and Location ID are required'
            });
        }

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await transaction.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        // Validate customer exists
        const customer = await Customer.findByPk(customerId, { transaction });
        if (!customer) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Validate item exists
        const item = await Item.findByPk(itemId, { transaction });
        if (!item) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Item not found' });
        }

        // Validate location exists
        const location = await Location.findByPk(locationId, { transaction });
        if (!location) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Location not found' });
        }

        // Check if customer item code already exists for this combination
        const existingCode = await CustomerItemCode.findOne({
            where: { customerId, itemId, locationId },
            transaction
        });

        if (existingCode) {
            await transaction.rollback();
            return res.status(409).json({
                error: 'Customer item code already exists for this customer-item-location combination'
            });
        }

        // Check if the code is already used by the same customer in the same location
        const duplicateCode = await CustomerItemCode.findOne({
            where: { 
                customerId, 
                locationId, 
                code,
                itemId: { [Op.ne]: itemId }  // Different item with same code
            },
            transaction
        });

        if (duplicateCode) {
            await transaction.rollback();
            return res.status(409).json({
                error: 'This code is already used by the customer for another item in this location'
            });
        }

        // Create the customer item code
        const customerItemCode = await CustomerItemCode.create({
            customerId,
            itemId,
            code,
            locationId,
            isActive: isActive !== undefined ? isActive : true,
            createdBy: currentUserId,
            updatedBy: currentUserId
        }, { transaction });

        await transaction.commit();

        // Fetch the created record with associations
        const createdRecord = await CustomerItemCode.findByPk(customerItemCode.id, {
            include: [
                {
                    model: Customer,
                    as: 'Customer',
                    attributes: ['id', 'name', 'type', 'contactPerson']
                },
                {
                    model: Item,
                    as: 'Item',
                    attributes: ['id', 'name', 'sku', 'barcode'],
                    include: [
                        {
                            model: Category,
                            attributes: ['id', 'name']
                        }
                    ]
                },
                {
                    model: Location,
                    as: 'Location',
                    attributes: ['id', 'name', 'address']
                },
                {
                    model: User,
                    as: 'Creator',
                    attributes: ['id', 'username']
                }
            ]
        });

        res.status(201).json({
            message: 'Customer item code created successfully',
            data: createdRecord
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error creating customer item code:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get all customer item codes with filters
exports.getCustomerItemCodes = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            customerId,
            itemId,
            locationId,
            isActive,
            search,
            sortBy = 'createdAt',
            sortOrder = 'DESC'
        } = req.query;

        const offset = (page - 1) * limit;
        const whereClause = {};

        // Apply filters
        if (customerId) whereClause.customerId = customerId;
        if (itemId) whereClause.itemId = itemId;
        if (locationId) whereClause.locationId = locationId;
        if (isActive !== undefined) whereClause.isActive = isActive === 'true';

        // Include associations (without search filters to avoid complications)
        const includeClause = [
            {
                model: Customer,
                as: 'Customer',
                attributes: ['id', 'name', 'type', 'contactPerson']
            },
            {
                model: Item,
                as: 'Item',
                attributes: ['id', 'name', 'sku', 'barcode'],
                include: [
                    {
                        model: Category,
                        attributes: ['id', 'name']
                    }
                ]
            },
            {
                model: Location,
                as: 'Location',
                attributes: ['id', 'name', 'address']
            },
            {
                model: User,
                as: 'Creator',
                attributes: ['id', 'username']
            },
            {
                model: User,
                as: 'Updater',
                attributes: ['id', 'username']
            }
        ];

        // Handle search functionality with a more complex approach if needed
        if (search) {
            // For now, just search in the code field to avoid join complications
            // TODO: Implement more complex search later if needed
            whereClause[Op.or] = [
                { code: { [Op.like]: `%${search}%` } }
            ];
        }

        // Get total count first (without includes to avoid join issues)
        const totalCount = await CustomerItemCode.count({
            where: whereClause
        });

        // Get the actual data with includes
        const customerItemCodes = await CustomerItemCode.findAll({
            where: whereClause,
            include: includeClause,
            order: [[sortBy, sortOrder.toUpperCase()]],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        const totalPages = Math.ceil(totalCount / limit);

        res.json({
            data: customerItemCodes,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalCount,
                limit: parseInt(limit),
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error('Error fetching customer item codes:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get customer item code by ID
exports.getCustomerItemCodeById = async (req, res) => {
    try {
        const { id } = req.params;

        const customerItemCode = await CustomerItemCode.findByPk(id, {
            include: [
                {
                    model: Customer,
                    as: 'Customer',
                    attributes: ['id', 'name', 'type', 'contactPerson', 'contactNumber', 'email']
                },
                {
                    model: Item,
                    as: 'Item',
                    attributes: ['id', 'name', 'sku', 'barcode', 'unit'],
                    include: [
                        {
                            model: Category,
                            attributes: ['id', 'name']
                        }
                    ]
                },
                {
                    model: Location,
                    as: 'Location',
                    attributes: ['id', 'name', 'address']
                },
                {
                    model: User,
                    as: 'Creator',
                    attributes: ['id', 'username']
                },
                {
                    model: User,
                    as: 'Updater',
                    attributes: ['id', 'username']
                }
            ]
        });

        if (!customerItemCode) {
            return res.status(404).json({ error: 'Customer item code not found' });
        }

        res.json({
            data: customerItemCode
        });
    } catch (error) {
        console.error('Error fetching customer item code by ID:', error);
        res.status(500).json({ error: error.message });
    }
};

// Update customer item code
exports.updateCustomerItemCode = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { customerId, itemId, code, locationId, isActive } = req.body;

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await transaction.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        // Find the existing record
        const customerItemCode = await CustomerItemCode.findByPk(id, { transaction });
        if (!customerItemCode) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Customer item code not found' });
        }

        // If updating customer, item, or location, validate they exist
        if (customerId && customerId !== customerItemCode.customerId) {
            const customer = await Customer.findByPk(customerId, { transaction });
            if (!customer) {
                await transaction.rollback();
                return res.status(404).json({ error: 'Customer not found' });
            }
        }

        if (itemId && itemId !== customerItemCode.itemId) {
            const item = await Item.findByPk(itemId, { transaction });
            if (!item) {
                await transaction.rollback();
                return res.status(404).json({ error: 'Item not found' });
            }
        }

        if (locationId && locationId !== customerItemCode.locationId) {
            const location = await Location.findByPk(locationId, { transaction });
            if (!location) {
                await transaction.rollback();
                return res.status(404).json({ error: 'Location not found' });
            }
        }

        // Check for duplicate combination if key fields are being updated
        const newCustomerId = customerId || customerItemCode.customerId;
        const newItemId = itemId || customerItemCode.itemId;
        const newLocationId = locationId || customerItemCode.locationId;

        if (customerId || itemId || locationId) {
            const existingCode = await CustomerItemCode.findOne({
                where: {
                    customerId: newCustomerId,
                    itemId: newItemId,
                    locationId: newLocationId,
                    id: { [Op.ne]: id }  // Exclude current record
                },
                transaction
            });

            if (existingCode) {
                await transaction.rollback();
                return res.status(409).json({
                    error: 'Customer item code already exists for this customer-item-location combination'
                });
            }
        }

        // Check for duplicate code if code is being updated
        if (code && code !== customerItemCode.code) {
            const duplicateCode = await CustomerItemCode.findOne({
                where: {
                    customerId: newCustomerId,
                    locationId: newLocationId,
                    code,
                    id: { [Op.ne]: id }  // Exclude current record
                },
                transaction
            });

            if (duplicateCode) {
                await transaction.rollback();
                return res.status(409).json({
                    error: 'This code is already used by the customer for another item in this location'
                });
            }
        }

        // Update the record
        const updatedData = {
            updatedBy: currentUserId
        };

        if (customerId !== undefined) updatedData.customerId = customerId;
        if (itemId !== undefined) updatedData.itemId = itemId;
        if (code !== undefined) updatedData.code = code;
        if (locationId !== undefined) updatedData.locationId = locationId;
        if (isActive !== undefined) updatedData.isActive = isActive;

        await customerItemCode.update(updatedData, { transaction });

        await transaction.commit();

        // Fetch the updated record with associations
        const updatedRecord = await CustomerItemCode.findByPk(id, {
            include: [
                {
                    model: Customer,
                    as: 'Customer',
                    attributes: ['id', 'name', 'type', 'contactPerson']
                },
                {
                    model: Item,
                    as: 'Item',
                    attributes: ['id', 'name', 'sku', 'barcode'],
                    include: [
                        {
                            model: Category,
                            attributes: ['id', 'name']
                        }
                    ]
                },
                {
                    model: Location,
                    as: 'Location',
                    attributes: ['id', 'name', 'address']
                },
                {
                    model: User,
                    as: 'Creator',
                    attributes: ['id', 'username']
                },
                {
                    model: User,
                    as: 'Updater',
                    attributes: ['id', 'username']
                }
            ]
        });

        res.json({
            message: 'Customer item code updated successfully',
            data: updatedRecord
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error updating customer item code:', error);
        res.status(500).json({ error: error.message });
    }
};

// Delete customer item code
exports.deleteCustomerItemCode = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { id } = req.params;

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await transaction.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const customerItemCode = await CustomerItemCode.findByPk(id, { transaction });
        if (!customerItemCode) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Customer item code not found' });
        }

        await customerItemCode.destroy({ transaction });
        await transaction.commit();

        res.json({
            message: 'Customer item code deleted successfully'
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error deleting customer item code:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get customer item codes by customer ID (with parent fallback)
exports.getCustomerItemCodesByCustomerId = async (req, res) => {
    try {
        const { customerId } = req.params;
        const { isActive, locationId } = req.query;

        // Build base where clause for filtering
        const buildWhereClause = (targetCustomerId) => {
            const whereClause = { customerId: targetCustomerId };
            if (isActive !== undefined) whereClause.isActive = isActive === 'true';
            if (locationId) whereClause.locationId = locationId;
            return whereClause;
        };

        // Include clause for associations
        const includeClause = [
            {
                model: Item,
                as: 'Item',
                attributes: ['id', 'name', 'sku', 'barcode', 'unit'],
                include: [
                    {
                        model: Category,
                        attributes: ['id', 'name']
                    }
                ]
            },
            {
                model: Location,
                as: 'Location',
                attributes: ['id', 'name', 'address']
            },
            {
                model: Customer,
                as: 'Customer',
                attributes: ['id', 'name', 'type']
            }
        ];

        // First, try to get item codes for the requested customer
        let customerItemCodes = await CustomerItemCode.findAll({
            where: buildWhereClause(customerId),
            include: includeClause,
            order: [['code', 'ASC']]
        });

        let sourceCustomerId = customerId;
        let sourceCustomerInfo = null;
        let fallbackUsed = false;

        // If no item codes found, check for parent customer
        if (customerItemCodes.length === 0) {
            // Get the customer to check if they have a parent
            const customer = await Customer.findByPk(customerId, {
                attributes: ['id', 'name', 'type', 'parentId'],
                include: [
                    {
                        model: Customer,
                        as: 'Parent',
                        attributes: ['id', 'name', 'type']
                    }
                ]
            });

            if (customer && customer.parentId) {
                // Try to get item codes from parent customer
                customerItemCodes = await CustomerItemCode.findAll({
                    where: buildWhereClause(customer.parentId),
                    include: includeClause,
                    order: [['code', 'ASC']]
                });

                if (customerItemCodes.length > 0) {
                    sourceCustomerId = customer.parentId;
                    sourceCustomerInfo = customer.Parent;
                    fallbackUsed = true;
                }
            }
        }

        // Prepare response data
        const responseData = {
            data: customerItemCodes,
            metadata: {
                requestedCustomerId: parseInt(customerId),
                sourceCustomerId: parseInt(sourceCustomerId),
                fallbackUsed,
                totalRecords: customerItemCodes.length
            }
        };

        // Add source customer info if fallback was used
        if (fallbackUsed && sourceCustomerInfo) {
            responseData.metadata.sourceCustomer = {
                id: sourceCustomerInfo.id,
                name: sourceCustomerInfo.name,
                type: sourceCustomerInfo.type
            };
        }

        res.json(responseData);
        
    } catch (error) {
        console.error('Error fetching customer item codes by customer ID:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get customer item codes by item ID
exports.getCustomerItemCodesByItemId = async (req, res) => {
    try {
        const { itemId } = req.params;
        const { isActive, locationId } = req.query;

        const whereClause = { itemId };
        if (isActive !== undefined) whereClause.isActive = isActive === 'true';
        if (locationId) whereClause.locationId = locationId;

        const customerItemCodes = await CustomerItemCode.findAll({
            where: whereClause,
            include: [
                {
                    model: Customer,
                    as: 'Customer',
                    attributes: ['id', 'name', 'type', 'contactPerson']
                },
                {
                    model: Location,
                    as: 'Location',
                    attributes: ['id', 'name', 'address']
                }
            ],
            order: [['code', 'ASC']]
        });

        res.json({
            data: customerItemCodes
        });
    } catch (error) {
        console.error('Error fetching customer item codes by item ID:', error);
        res.status(500).json({ error: error.message });
    }
};

// Bulk create/update customer item codes
exports.bulkUpsertCustomerItemCodes = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { customerItemCodes } = req.body;

        if (!Array.isArray(customerItemCodes) || customerItemCodes.length === 0) {
            await transaction.rollback();
            return res.status(400).json({
                error: 'customerItemCodes must be a non-empty array'
            });
        }

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await transaction.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const results = {
            created: [],
            updated: [],
            errors: []
        };

        for (let i = 0; i < customerItemCodes.length; i++) {
            const { customerId, itemId, code, locationId, isActive } = customerItemCodes[i];

            try {
                // Validate required fields
                if (!customerId || !itemId || !code || !locationId) {
                    results.errors.push({
                        index: i,
                        data: customerItemCodes[i],
                        error: 'Customer ID, Item ID, Code, and Location ID are required'
                    });
                    continue;
                }

                // Check if record exists
                const existingRecord = await CustomerItemCode.findOne({
                    where: { customerId, itemId, locationId },
                    transaction
                });

                if (existingRecord) {
                    // Update existing record
                    await existingRecord.update({
                        code,
                        isActive: isActive !== undefined ? isActive : existingRecord.isActive,
                        updatedBy: currentUserId
                    }, { transaction });

                    results.updated.push({
                        index: i,
                        id: existingRecord.id,
                        data: customerItemCodes[i]
                    });
                } else {
                    // Create new record
                    const newRecord = await CustomerItemCode.create({
                        customerId,
                        itemId,
                        code,
                        locationId,
                        isActive: isActive !== undefined ? isActive : true,
                        createdBy: currentUserId,
                        updatedBy: currentUserId
                    }, { transaction });

                    results.created.push({
                        index: i,
                        id: newRecord.id,
                        data: customerItemCodes[i]
                    });
                }
            } catch (error) {
                results.errors.push({
                    index: i,
                    data: customerItemCodes[i],
                    error: error.message
                });
            }
        }

        await transaction.commit();

        res.json({
            message: 'Bulk operation completed',
            results
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error in bulk upsert customer item codes:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get customer item code by customer ID, item ID, and location ID
exports.getCustomerItemCodeByIds = async (req, res) => {
    try {
        const { customerId, itemId, locationId } = req.params;

        const customerItemCode = await CustomerItemCode.findOne({
            where: { customerId, itemId, locationId },
            include: [
                {
                    model: Customer,
                    as: 'Customer',
                    attributes: ['id', 'name', 'type', 'contactPerson']
                },
                {
                    model: Item,
                    as: 'Item',
                    attributes: ['id', 'name', 'sku', 'barcode'],
                    include: [
                        {
                            model: Category,
                            attributes: ['id', 'name']
                        }
                    ]
                },
                {
                    model: Location,
                    as: 'Location',
                    attributes: ['id', 'name', 'address']
                }
            ]
        });

        if (!customerItemCode) {
            return res.status(404).json({
                error: 'Customer item code not found for the specified combination'
            });
        }

        res.json({
            data: customerItemCode
        });
    } catch (error) {
        console.error('Error fetching customer item code by IDs:', error);
        res.status(500).json({ error: error.message });
    }
};