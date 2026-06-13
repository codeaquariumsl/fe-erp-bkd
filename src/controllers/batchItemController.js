const { BatchItem, Batch, Item, Location, Store, User, Category, GRN } = require('../models');
const { Op } = require('sequelize');

// Create a new batch item
exports.createBatchItem = async (req, res) => {
    try {
        const data = req.body;
        
        // Validate required fields
        if (!data.batchId || !data.itemId || !data.batchQuantity || !data.locationId || !data.storeId) {
            return res.status(400).json({ 
                error: 'Batch ID, item ID, batch quantity, location ID, and store ID are required' 
            });
        }

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        // Validate batch exists and is active
        const batch = await Batch.findByPk(data.batchId);
        if (!batch || !batch.isActive) {
            return res.status(400).json({ error: 'Batch not found or inactive' });
        }

        // Validate item exists
        const item = await Item.findByPk(data.itemId);
        if (!item) {
            return res.status(400).json({ error: 'Item not found' });
        }

        // Validate location exists
        const location = await Location.findByPk(data.locationId);
        if (!location) {
            return res.status(400).json({ error: 'Location not found' });
        }

        // Validate store exists
        const store = await Store.findByPk(data.storeId);
        if (!store) {
            return res.status(400).json({ error: 'Store not found' });
        }

        // Check if batch item already exists for this batch and item combination
        const existingBatchItem = await BatchItem.findOne({ 
            where: { 
                batchId: data.batchId, 
                itemId: data.itemId 
            } 
        });
        if (existingBatchItem) {
            return res.status(400).json({ error: 'Batch item already exists for this batch and item combination' });
        }

        // Validate quantities
        if (data.batchQuantity <= 0) {
            return res.status(400).json({ error: 'Batch quantity must be greater than 0' });
        }

        // Set available quantity to batch quantity if not provided
        const availableQuantity = data.availableQuantity !== undefined ? data.availableQuantity : data.batchQuantity;

        if (availableQuantity < 0 || availableQuantity > data.batchQuantity) {
            return res.status(400).json({ error: 'Available quantity must be between 0 and batch quantity' });
        }

        const batchItem = await BatchItem.create({
            ...data,
            availableQuantity,
            createdBy: currentUserId,
            updatedBy: currentUserId
        });

        // Fetch the created batch item with associations
        const createdBatchItem = await BatchItem.findByPk(batchItem.id, {
            include: [
                { 
                    model: Batch, 
                    as: 'Batch', 
                    attributes: ['id', 'batchNumber', 'batchDate', 'expireDate'],
                    include: [
                        { model: GRN, as: 'GRN', attributes: ['id', 'grnNumber'] }
                    ]
                },
                { 
                    model: Item, 
                    as: 'Item', 
                    include: [
                        { model: Category, attributes: ['id', 'name'] }
                    ]
                },
                { model: Location, as: 'Location', attributes: ['id', 'name'] },
                { model: Store, as: 'Store', attributes: ['id', 'name'] },
                { model: User, as: 'Creator', attributes: ['id', 'username'] }
            ]
        });

        res.status(201).json(createdBatchItem);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get all batch items with filtering and pagination
exports.getBatchItems = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            batchId, 
            itemId, 
            locationId, 
            storeId, 
            isActive,
            hasAvailableQuantity,
            sortBy = 'createdAt',
            sortOrder = 'DESC'
        } = req.query;

        const offset = (page - 1) * limit;
        const whereConditions = {};

        // Apply filters
        if (batchId) whereConditions.batchId = batchId;
        if (itemId) whereConditions.itemId = itemId;
        if (locationId) whereConditions.locationId = locationId;
        if (storeId) whereConditions.storeId = storeId;
        if (isActive !== undefined) whereConditions.isActive = isActive === 'true';
        if (hasAvailableQuantity === 'true') {
            whereConditions.availableQuantity = { [Op.gt]: 0 };
        }

        const { count, rows: batchItems } = await BatchItem.findAndCountAll({
            where: whereConditions,
            include: [
                { 
                    model: Batch, 
                    as: 'Batch', 
                    attributes: ['id', 'batchNumber', 'batchDate', 'expireDate'],
                    include: [
                        { model: GRN, as: 'GRN', attributes: ['id', 'grnNumber'] }
                    ]
                },
                { 
                    model: Item, 
                    as: 'Item',
                    include: [
                        { model: Category, attributes: ['id', 'name'] }
                    ]
                },
                { model: Location, as: 'Location', attributes: ['id', 'name'] },
                { model: Store, as: 'Store', attributes: ['id', 'name'] },
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] }
            ],
            order: [[sortBy, sortOrder.toUpperCase()]],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        const totalPages = Math.ceil(count / limit);

        res.json({
            batchItems,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalItems: count,
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get a specific batch item by ID
exports.getBatchItemById = async (req, res) => {
    try {
        const { id } = req.params;

        const batchItem = await BatchItem.findByPk(id, {
            include: [
                { 
                    model: Batch, 
                    as: 'Batch',
                    include: [
                        { model: GRN, as: 'GRN', attributes: ['id', 'grnNumber', 'grnDate'] }
                    ]
                },
                { 
                    model: Item, 
                    as: 'Item',
                    include: [
                        { model: Category, attributes: ['id', 'name'] }
                    ]
                },
                { model: Location, as: 'Location', attributes: ['id', 'name'] },
                { model: Store, as: 'Store', attributes: ['id', 'name'] },
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] }
            ]
        });

        if (!batchItem) {
            return res.status(404).json({ error: 'Batch item not found' });
        }

        res.json(batchItem);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update a batch item
exports.updateBatchItem = async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.body;

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const batchItem = await BatchItem.findByPk(id);
        if (!batchItem) {
            return res.status(404).json({ error: 'Batch item not found' });
        }

        // Validate quantities if being updated
        if (data.batchQuantity !== undefined && data.batchQuantity <= 0) {
            return res.status(400).json({ error: 'Batch quantity must be greater than 0' });
        }

        const batchQuantity = data.batchQuantity !== undefined ? data.batchQuantity : batchItem.batchQuantity;
        const availableQuantity = data.availableQuantity !== undefined ? data.availableQuantity : batchItem.availableQuantity;

        if (availableQuantity < 0 || availableQuantity > batchQuantity) {
            return res.status(400).json({ error: 'Available quantity must be between 0 and batch quantity' });
        }

        await batchItem.update({
            ...data,
            updatedBy: currentUserId
        });

        // Fetch updated batch item with associations
        const updatedBatchItem = await BatchItem.findByPk(id, {
            include: [
                { 
                    model: Batch, 
                    as: 'Batch', 
                    attributes: ['id', 'batchNumber', 'batchDate', 'expireDate'],
                    include: [
                        { model: GRN, as: 'GRN', attributes: ['id', 'grnNumber'] }
                    ]
                },
                { 
                    model: Item, 
                    as: 'Item',
                    include: [
                        { model: Category, attributes: ['id', 'name'] }
                    ]
                },
                { model: Location, as: 'Location', attributes: ['id', 'name'] },
                { model: Store, as: 'Store', attributes: ['id', 'name'] },
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] }
            ]
        });

        res.json(updatedBatchItem);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Soft delete a batch item (set isActive to false)
exports.deleteBatchItem = async (req, res) => {
    try {
        const { id } = req.params;

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const batchItem = await BatchItem.findByPk(id);
        if (!batchItem) {
            return res.status(404).json({ error: 'Batch item not found' });
        }

        // Check if batch item has available quantity
        if (batchItem.availableQuantity > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete batch item with available quantity. Please consume or transfer the quantity first.' 
            });
        }

        await batchItem.update({
            isActive: false,
            updatedBy: currentUserId
        });

        res.json({ message: 'Batch item deleted successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get batch items by batch ID
exports.getBatchItemsByBatchId = async (req, res) => {
    try {
        const { batchId } = req.params;

        const batchItems = await BatchItem.findAll({
            where: { 
                batchId: batchId,
                isActive: true
            },
            include: [
                { 
                    model: Item, 
                    as: 'Item',
                    include: [
                        { model: Category, attributes: ['id', 'name'] }
                    ]
                },
                { model: Location, as: 'Location', attributes: ['id', 'name'] },
                { model: Store, as: 'Store', attributes: ['id', 'name'] }
            ],
            order: [['createdAt', 'ASC']]
        });

        res.json(batchItems);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get batch items by item ID
exports.getBatchItemsByItemId = async (req, res) => {
    try {
        const { itemId } = req.params;
        const { onlyAvailable = false, locationId, storeId } = req.query;

        const whereConditions = { 
            itemId: itemId,
            isActive: true
        };

        if (onlyAvailable === 'true') {
            whereConditions.availableQuantity = { [Op.gt]: 0 };
        }

        if (locationId) whereConditions.locationId = locationId;
        if (storeId) whereConditions.storeId = storeId;

        const batchItems = await BatchItem.findAll({
            where: whereConditions,
            include: [
                { 
                    model: Batch, 
                    as: 'Batch', 
                    attributes: ['id', 'batchNumber', 'batchDate', 'expireDate'],
                    include: [
                        { model: GRN, as: 'GRN', attributes: ['id', 'grnNumber'] }
                    ]
                },
                { model: Location, as: 'Location', attributes: ['id', 'name'] },
                { model: Store, as: 'Store', attributes: ['id', 'name'] }
            ],
            order: [['Batch', 'expireDate', 'ASC']] // FIFO - First to expire first
        });

        res.json(batchItems);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update available quantity (for consumption/usage)
exports.updateAvailableQuantity = async (req, res) => {
    try {
        const { id } = req.params;
        const { quantityChange, operation = 'subtract' } = req.body;

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        if (!quantityChange || quantityChange <= 0) {
            return res.status(400).json({ error: 'Quantity change must be greater than 0' });
        }

        const batchItem = await BatchItem.findByPk(id);
        if (!batchItem) {
            return res.status(404).json({ error: 'Batch item not found' });
        }

        if (!batchItem.isActive) {
            return res.status(400).json({ error: 'Cannot update inactive batch item' });
        }

        let newAvailableQuantity;
        if (operation === 'subtract') {
            newAvailableQuantity = parseFloat(batchItem.availableQuantity) - parseFloat(quantityChange);
            if (newAvailableQuantity < 0) {
                return res.status(400).json({ error: 'Insufficient available quantity' });
            }
        } else if (operation === 'add') {
            newAvailableQuantity = parseFloat(batchItem.availableQuantity) + parseFloat(quantityChange);
            if (newAvailableQuantity > batchItem.batchQuantity) {
                return res.status(400).json({ error: 'Available quantity cannot exceed batch quantity' });
            }
        } else {
            return res.status(400).json({ error: 'Invalid operation. Must be "add" or "subtract"' });
        }

        await batchItem.update({
            availableQuantity: newAvailableQuantity,
            updatedBy: currentUserId
        });

        // Fetch updated batch item with associations
        const updatedBatchItem = await BatchItem.findByPk(id, {
            include: [
                { 
                    model: Batch, 
                    as: 'Batch', 
                    attributes: ['id', 'batchNumber', 'batchDate', 'expireDate']
                },
                { model: Item, as: 'Item', attributes: ['id', 'name', 'sku'] }
            ]
        });

        res.json(updatedBatchItem);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get batch items summary by location/store
exports.getBatchItemsSummary = async (req, res) => {
    try {
        const { locationId, storeId } = req.query;

        const whereConditions = {
            isActive: true,
            availableQuantity: { [Op.gt]: 0 }
        };

        if (locationId) whereConditions.locationId = locationId;
        if (storeId) whereConditions.storeId = storeId;

        const batchItems = await BatchItem.findAll({
            where: whereConditions,
            include: [
                { 
                    model: Batch, 
                    as: 'Batch', 
                    attributes: ['id', 'batchNumber', 'expireDate'],
                    include: [
                        { model: GRN, as: 'GRN', attributes: ['id', 'grnNumber'] }
                    ]
                },
                { 
                    model: Item, 
                    as: 'Item',
                    attributes: ['id', 'name', 'sku'],
                    include: [
                        { model: Category, attributes: ['id', 'name'] }
                    ]
                },
                { model: Location, as: 'Location', attributes: ['id', 'name'] },
                { model: Store, as: 'Store', attributes: ['id', 'name'] }
            ],
            order: [['Item', 'name', 'ASC'], ['Batch', 'expireDate', 'ASC']]
        });

        // Group by item
        const summary = {};
        batchItems.forEach(batchItem => {
            const itemId = batchItem.Item.id;
            if (!summary[itemId]) {
                summary[itemId] = {
                    item: batchItem.Item,
                    totalAvailableQuantity: 0,
                    batches: []
                };
            }
            summary[itemId].totalAvailableQuantity += parseFloat(batchItem.availableQuantity);
            summary[itemId].batches.push({
                batchId: batchItem.Batch.id,
                batchNumber: batchItem.Batch.batchNumber,
                expireDate: batchItem.Batch.expireDate,
                availableQuantity: batchItem.availableQuantity,
                grnNumber: batchItem.Batch.GRN?.grnNumber
            });
        });

        res.json(Object.values(summary));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};