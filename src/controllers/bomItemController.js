const { BOMItem, BOM, Item, User, Category } = require('../models');
const { Op } = require('sequelize');

// Create a new BOM item
exports.createBOMItem = async (req, res) => {
    try {
        const data = req.body;
        
        // Validate required fields
        if (!data.bomId || !data.itemId || !data.quantity) {
            return res.status(400).json({ 
                error: 'BOM ID, item ID, and quantity are required' 
            });
        }

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        // Validate BOM exists and is active
        const bom = await BOM.findByPk(data.bomId);
        if (!bom || !bom.isActive) {
            return res.status(400).json({ error: 'BOM not found or inactive' });
        }

        // Validate item exists
        const item = await Item.findByPk(data.itemId);
        if (!item) {
            return res.status(400).json({ error: 'Item not found' });
        }

        // Check if BOM item already exists for this BOM and item combination
        const existingBOMItem = await BOMItem.findOne({ 
            where: { 
                bomId: data.bomId, 
                itemId: data.itemId,
                isActive: true
            } 
        });
        if (existingBOMItem) {
            return res.status(400).json({ error: 'BOM item already exists for this BOM and item combination' });
        }

        // Validate quantities and costs
        if (data.quantity <= 0) {
            return res.status(400).json({ error: 'Quantity must be greater than 0' });
        }

        if (data.cost !== undefined && data.cost < 0) {
            return res.status(400).json({ error: 'Cost must be non-negative' });
        }

        if (data.wastagePercentage !== undefined && (data.wastagePercentage < 0 || data.wastagePercentage > 100)) {
            return res.status(400).json({ error: 'Wastage percentage must be between 0 and 100' });
        }

        // Set sequence if not provided
        if (!data.sequence) {
            const maxSequence = await BOMItem.max('sequence', {
                where: { bomId: data.bomId, isActive: true }
            });
            data.sequence = (maxSequence || 0) + 1;
        }

        const bomItem = await BOMItem.create({
            ...data,
            createdBy: currentUserId,
            updatedBy: currentUserId
        });

        // Update BOM total cost
        const bomController = require('./bomController');
        await bomController.recalculateBOMCost(data.bomId);

        // Fetch the created BOM item with associations
        const createdBOMItem = await BOMItem.findByPk(bomItem.id, {
            include: [
                { 
                    model: BOM, 
                    as: 'BOM', 
                    attributes: ['id', 'name', 'version'],
                    include: [
                        { model: Item, as: 'Item', attributes: ['id', 'name', 'sku'] }
                    ]
                },
                { 
                    model: Item, 
                    as: 'Item', 
                    include: [
                        { model: Category, attributes: ['id', 'name'] }
                    ]
                },
                { model: User, as: 'Creator', attributes: ['id', 'username'] }
            ]
        });

        res.status(201).json(createdBOMItem);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get all BOM items with filtering and pagination
exports.getBOMItems = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            bomId, 
            itemId, 
            isActive,
            sortBy = 'sequence',
            sortOrder = 'ASC'
        } = req.query;

        const offset = (page - 1) * limit;
        const whereConditions = {};

        // Apply filters
        if (bomId) whereConditions.bomId = bomId;
        if (itemId) whereConditions.itemId = itemId;
        if (isActive !== undefined) whereConditions.isActive = isActive === 'true';

        const { count, rows: bomItems } = await BOMItem.findAndCountAll({
            where: whereConditions,
            include: [
                { 
                    model: BOM, 
                    as: 'BOM', 
                    attributes: ['id', 'name', 'version'],
                    include: [
                        { model: Item, as: 'Item', attributes: ['id', 'name', 'sku'] }
                    ]
                },
                { 
                    model: Item, 
                    as: 'Item',
                    include: [
                        { model: Category, attributes: ['id', 'name'] }
                    ]
                },
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] }
            ],
            order: [[sortBy, sortOrder.toUpperCase()]],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        const totalPages = Math.ceil(count / limit);

        res.json({
            bomItems,
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

// Get a specific BOM item by ID
exports.getBOMItemById = async (req, res) => {
    try {
        const { id } = req.params;

        const bomItem = await BOMItem.findByPk(id, {
            include: [
                { 
                    model: BOM, 
                    as: 'BOM',
                    include: [
                        { model: Item, as: 'Item', attributes: ['id', 'name', 'sku'] }
                    ]
                },
                { 
                    model: Item, 
                    as: 'Item',
                    include: [
                        { model: Category, attributes: ['id', 'name'] }
                    ]
                },
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] }
            ]
        });

        if (!bomItem) {
            return res.status(404).json({ error: 'BOM item not found' });
        }

        res.json(bomItem);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update a BOM item
exports.updateBOMItem = async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.body;

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const bomItem = await BOMItem.findByPk(id);
        if (!bomItem) {
            return res.status(404).json({ error: 'BOM item not found' });
        }

        // Validate quantities and costs if being updated
        if (data.quantity !== undefined && data.quantity <= 0) {
            return res.status(400).json({ error: 'Quantity must be greater than 0' });
        }

        if (data.cost !== undefined && data.cost < 0) {
            return res.status(400).json({ error: 'Cost must be non-negative' });
        }

        if (data.wastagePercentage !== undefined && (data.wastagePercentage < 0 || data.wastagePercentage > 100)) {
            return res.status(400).json({ error: 'Wastage percentage must be between 0 and 100' });
        }

        await bomItem.update({
            ...data,
            updatedBy: currentUserId
        });

        // Update BOM total cost if cost or quantity changed
        if (data.quantity !== undefined || data.cost !== undefined) {
            const bomController = require('./bomController');
            await bomController.recalculateBOMCost(bomItem.bomId);
        }

        // Fetch updated BOM item with associations
        const updatedBOMItem = await BOMItem.findByPk(id, {
            include: [
                { 
                    model: BOM, 
                    as: 'BOM', 
                    attributes: ['id', 'name', 'version'],
                    include: [
                        { model: Item, as: 'Item', attributes: ['id', 'name', 'sku'] }
                    ]
                },
                { 
                    model: Item, 
                    as: 'Item',
                    include: [
                        { model: Category, attributes: ['id', 'name'] }
                    ]
                },
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] }
            ]
        });

        res.json(updatedBOMItem);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Soft delete a BOM item
exports.deleteBOMItem = async (req, res) => {
    try {
        const { id } = req.params;

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const bomItem = await BOMItem.findByPk(id);
        if (!bomItem) {
            return res.status(404).json({ error: 'BOM item not found' });
        }

        await bomItem.update({
            isActive: false,
            updatedBy: currentUserId
        });

        // Update BOM total cost
        const bomController = require('./bomController');
        await bomController.recalculateBOMCost(bomItem.bomId);

        res.json({ message: 'BOM item deleted successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get BOM items by BOM ID
exports.getBOMItemsByBOMId = async (req, res) => {
    try {
        const { bomId } = req.params;

        const bomItems = await BOMItem.findAll({
            where: { 
                bomId: bomId,
                isActive: true
            },
            include: [
                { 
                    model: Item, 
                    as: 'Item',
                    include: [
                        { model: Category, attributes: ['id', 'name'] }
                    ]
                }
            ],
            order: [['sequence', 'ASC'], ['createdAt', 'ASC']]
        });

        res.json(bomItems);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update BOM item sequence/order
exports.updateBOMItemSequence = async (req, res) => {
    try {
        const { id } = req.params;
        const { newSequence } = req.body;

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        if (!newSequence || newSequence <= 0) {
            return res.status(400).json({ error: 'New sequence must be a positive integer' });
        }

        const bomItem = await BOMItem.findByPk(id);
        if (!bomItem) {
            return res.status(404).json({ error: 'BOM item not found' });
        }

        const oldSequence = bomItem.sequence;

        // Update sequences of other items in the same BOM
        if (newSequence > oldSequence) {
            // Moving down: shift items up
            await BOMItem.update(
                { sequence: sequelize.literal('sequence - 1') },
                {
                    where: {
                        bomId: bomItem.bomId,
                        sequence: { [Op.between]: [oldSequence + 1, newSequence] },
                        isActive: true
                    }
                }
            );
        } else if (newSequence < oldSequence) {
            // Moving up: shift items down
            await BOMItem.update(
                { sequence: sequelize.literal('sequence + 1') },
                {
                    where: {
                        bomId: bomItem.bomId,
                        sequence: { [Op.between]: [newSequence, oldSequence - 1] },
                        isActive: true
                    }
                }
            );
        }

        // Update the target item's sequence
        await bomItem.update({
            sequence: newSequence,
            updatedBy: currentUserId
        });

        // Fetch updated BOM items in order
        const updatedBOMItems = await BOMItem.findAll({
            where: { 
                bomId: bomItem.bomId,
                isActive: true
            },
            include: [
                { model: Item, as: 'Item', attributes: ['id', 'name', 'sku'] }
            ],
            order: [['sequence', 'ASC']]
        });

        res.json(updatedBOMItems);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Bulk update BOM items
exports.bulkUpdateBOMItems = async (req, res) => {
    try {
        const { bomId } = req.params;
        const { bomItems } = req.body;

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        if (!Array.isArray(bomItems) || bomItems.length === 0) {
            return res.status(400).json({ error: 'BOM items array is required' });
        }

        const bom = await BOM.findByPk(bomId);
        if (!bom) {
            return res.status(404).json({ error: 'BOM not found' });
        }

        const updatedItems = [];

        // Process each BOM item update
        for (const itemData of bomItems) {
            if (itemData.id) {
                // Update existing item
                const bomItem = await BOMItem.findByPk(itemData.id);
                if (bomItem && bomItem.bomId === parseInt(bomId)) {
                    await bomItem.update({
                        ...itemData,
                        updatedBy: currentUserId
                    });
                    updatedItems.push(bomItem);
                }
            } else {
                // Create new item
                const newBOMItem = await BOMItem.create({
                    ...itemData,
                    bomId: bomId,
                    createdBy: currentUserId,
                    updatedBy: currentUserId
                });
                updatedItems.push(newBOMItem);
            }
        }

        // Update BOM total cost
        const bomController = require('./bomController');
        await bomController.recalculateBOMCost(bomId);

        // Fetch all updated BOM items with associations
        const finalBOMItems = await BOMItem.findAll({
            where: { 
                bomId: bomId,
                isActive: true
            },
            include: [
                { 
                    model: Item, 
                    as: 'Item',
                    include: [
                        { model: Category, attributes: ['id', 'name'] }
                    ]
                }
            ],
            order: [['sequence', 'ASC']]
        });

        res.json(finalBOMItems);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Calculate cost for a BOM item based on current item price
exports.calculateBOMItemCost = async (req, res) => {
    try {
        const { itemId, quantity } = req.query;

        if (!itemId || !quantity) {
            return res.status(400).json({ error: 'Item ID and quantity are required' });
        }

        const item = await Item.findByPk(itemId);
        if (!item) {
            return res.status(400).json({ error: 'Item not found' });
        }

        // Get the latest item price (you might need to adjust this based on your pricing logic)
        const unitCost = item.sellingPrice || 0; // or get from a separate pricing table
        const totalCost = parseFloat(quantity) * parseFloat(unitCost);

        res.json({
            itemId: itemId,
            quantity: parseFloat(quantity),
            unitCost: unitCost,
            totalCost: totalCost
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};