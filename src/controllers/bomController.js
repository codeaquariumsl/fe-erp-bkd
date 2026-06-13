const { BOM, BOMItem, Item, Location, User, Category } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/db');

// Helper function to generate unique BOM code
const generateBOMCode = async (locationId = null) => {
    try {
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        
        // Base prefix for BOM codes
        let prefix = `BOM-${year}${month}`;
        
        // Add location prefix if provided
        if (locationId) {
            const location = await Location.findByPk(locationId, { attributes: ['name'] });
            if (location) {
                const locationCode = location.name.substring(0, 3).toUpperCase();
                prefix = `BOM-${locationCode}-${year}${month}`;
            }
        }

        // Find the last BOM code with this prefix
        const lastBOM = await BOM.findOne({
            where: {
                [Op.or]: [
                    { bomCode: { [Op.like]: `${prefix}%` } },
                    { bomCode: { [Op.like]: `BOM-${year}${month}%` } }
                ]
            },
            order: [['bomCode', 'DESC']],
            attributes: ['bomCode']
        });

        let sequence = 1;
        if (lastBOM && lastBOM.bomCode) {
            // Extract sequence number from the last code
            const lastSequence = lastBOM.bomCode.split('-').pop();
            if (lastSequence && !isNaN(lastSequence)) {
                sequence = parseInt(lastSequence) + 1;
            }
        }

        // Generate new code with 4-digit sequence
        const sequenceStr = String(sequence).padStart(4, '0');
        return `${prefix}-${sequenceStr}`;
    } catch (error) {
        console.error('Error generating BOM code:', error);
        // Fallback code generation
        const timestamp = Date.now().toString().slice(-6);
        return `BOM-${timestamp}`;
    }
};

// Create a new BOM with optional BOM items
// Body example:
// {
//   "bomCode": "BOM-LOC-202412-0001", // Optional - auto-generated if not provided
//   "itemId": 1,
//   "locationId": 1,
//   "quantity": 10,
//   "status": "active",
//   "bomItems": [
//     {
//       "itemId": 2,
//       "quantity": 5,
//       "unit": "kg"
//     }
//   ]
// }
exports.createBOM = async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
        const { items = [], ...bomData } = req.body;
        
        // Validate required fields
        if (!bomData.itemId || !bomData.locationId) {
            await transaction.rollback();
            return res.status(400).json({ 
                error: 'Item ID and location ID are required' 
            });
        }

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await transaction.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        // Validate item exists
        const item = await Item.findByPk(bomData.itemId);
        if (!item) {
            await transaction.rollback();
            return res.status(400).json({ error: 'Item not found' });
        }

        // Validate location exists
        const location = await Location.findByPk(bomData.locationId);
        if (!location) {
            await transaction.rollback();
            return res.status(400).json({ error: 'Location not found' });
        }

        // Validate quantity is positive
        if (bomData.qty && bomData.qty <= 0) {
            await transaction.rollback();
            return res.status(400).json({ error: 'Quantity must be greater than 0' });
        }

        // Generate BOM code if not provided
        let bomCode = bomData.bomCode;
        if (!bomCode) {
            bomCode = await generateBOMCode(bomData.locationId);
        }

        // Validate BOM code uniqueness if provided
        if (bomData.bomCode) {
            const existingBOM = await BOM.findOne({ 
                where: { bomCode: bomData.bomCode },
                transaction
            });
            if (existingBOM) {
                await transaction.rollback();
                return res.status(400).json({ error: 'BOM code already exists' });
            }
        }

        // Create BOM
        const bom = await BOM.create({
            ...bomData,
            bomCode,
            qty: bomData.qty || 1.00,
            createdBy: currentUserId,
            updatedBy: currentUserId
        }, { transaction });

        // Create BOM items if provided
        const createdItems = [];
        if (items && items.length > 0) {
            for (let i = 0; i < items.length; i++) {
                const itemData = items[i];
                
                // Validate required fields for BOM item
                if (!itemData.itemId || !itemData.quantity) {
                    await transaction.rollback();
                    return res.status(400).json({ 
                        error: `Item ID and quantity are required for BOM item at index ${i}` 
                    });
                }

                // Validate quantities and costs
                if (itemData.quantity <= 0) {
                    await transaction.rollback();
                    return res.status(400).json({ 
                        error: `Quantity must be greater than 0 for BOM item at index ${i}` 
                    });
                }

                // Validate item exists
                const bomItemExists = await Item.findByPk(itemData.itemId);
                if (!bomItemExists) {
                    await transaction.rollback();
                    return res.status(400).json({ 
                        error: `Item with ID ${itemData.itemId} not found for BOM item at index ${i}` 
                    });
                }

                const bomItem = await BOMItem.create({
                    ...itemData,
                    bomId: bom.id,
                    sequence: itemData.sequence || (i + 1),
                    createdBy: currentUserId,
                    updatedBy: currentUserId
                }, { transaction });

                createdItems.push(bomItem);
            }

            // Recalculate BOM total cost if items were added
            await this.recalculateBOMCostInTransaction(bom.id, transaction);
        }

        await transaction.commit();

        // Fetch the created BOM with all associations
        const createdBOM = await BOM.findByPk(bom.id, {
            include: [
                { 
                    model: Item, 
                    as: 'Item',
                    include: [{ model: Category, attributes: ['id', 'name'] }]
                },
                { model: Location, as: 'Location', attributes: ['id', 'name'] },
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { 
                    model: BOMItem, 
                    as: 'BOMItems',
                    where: { isActive: true },
                    required: false,
                    include: [
                        { 
                            model: Item, 
                            as: 'Item', 
                            attributes: ['id', 'name', 'sku'],
                            include: [{ model: Category, attributes: ['id', 'name'] }]
                        }
                    ],
                    order: [['sequence', 'ASC']]
                }
            ]
        });

        res.status(201).json(createdBOM);
    } catch (error) {
        await transaction.rollback();
        res.status(400).json({ error: error.message });
    }
};

// Get all BOMs with filtering and pagination
exports.getBOMs = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            itemId, 
            locationId, 
            isActive,
            search,
            sortBy = 'createdAt',
            sortOrder = 'DESC'
        } = req.query;

        const offset = (page - 1) * limit;
        const whereConditions = {};
        const itemWhereConditions = {};

        // Apply filters
        if (itemId) whereConditions.itemId = itemId;
        if (locationId) whereConditions.locationId = locationId;
        if (isActive !== undefined) whereConditions.isActive = isActive === 'true';
        
        // Search in item name or BOM name
        if (search) {
            itemWhereConditions[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
                { sku: { [Op.like]: `%${search}%` } }
            ];
        }

        const { count, rows: boms } = await BOM.findAndCountAll({
            where: whereConditions,
            include: [
                { 
                    model: Item, 
                    as: 'Item',
                    where: Object.keys(itemWhereConditions).length > 0 ? itemWhereConditions : undefined,
                    include: [
                        { model: Category, attributes: ['id', 'name'] }
                    ]
                },
                { model: Location, as: 'Location', attributes: ['id', 'name'] },
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] },
                { 
                    model: BOMItem, 
                    as: 'BOMItems',
                    required: false,
                    where: { isActive: true },
                    include: [
                        { model: Item, as: 'Item', attributes: ['id', 'name', 'sku'] }
                    ]
                }
            ],
            order: [[sortBy, sortOrder.toUpperCase()]],
            limit: parseInt(limit),
            offset: parseInt(offset),
            distinct: true
        });

        const totalPages = Math.ceil(count / limit);

        res.json({
            boms,
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

// Get a specific BOM by ID
exports.getBOMById = async (req, res) => {
    try {
        const { id } = req.params;

        const bom = await BOM.findByPk(id, {
            include: [
                { 
                    model: Item, 
                    as: 'Item',
                    include: [
                        { model: Category, attributes: ['id', 'name'] }
                    ]
                },
                { model: Location, as: 'Location' },
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] },
                { 
                    model: BOMItem, 
                    as: 'BOMItems',
                    where: { isActive: true },
                    required: false,
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
                }
            ]
        });

        if (!bom) {
            return res.status(404).json({ error: 'BOM not found' });
        }

        res.json(bom);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update a BOM with optional BOM items management
exports.updateBOM = async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
        const { id } = req.params;
        const { items, removeItems, ...bomData } = req.body;

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await transaction.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const bom = await BOM.findByPk(id, { transaction });
        if (!bom) {
            await transaction.rollback();
            return res.status(404).json({ error: 'BOM not found' });
        }

        // Validate quantity if being updated
        if (bomData.qty !== undefined && bomData.qty <= 0) {
            await transaction.rollback();
            return res.status(400).json({ error: 'Quantity must be greater than 0' });
        }

        // Validate item if being updated
        if (bomData.itemId && bomData.itemId !== bom.itemId) {
            const item = await Item.findByPk(bomData.itemId);
            if (!item) {
                await transaction.rollback();
                return res.status(400).json({ error: 'Item not found' });
            }
        }

        // Validate location if being updated
        if (bomData.locationId && bomData.locationId !== bom.locationId) {
            const location = await Location.findByPk(bomData.locationId);
            if (!location) {
                await transaction.rollback();
                return res.status(400).json({ error: 'Location not found' });
            }
        }

        // Update BOM data
        await bom.update({
            ...bomData,
            updatedBy: currentUserId
        }, { transaction });

        // Handle BOM items if provided
        let itemsChanged = false;

        // Remove specified BOM items
        if (removeItems && removeItems.length > 0) {
            await BOMItem.update(
                { isActive: false, updatedBy: currentUserId },
                { 
                    where: { 
                        id: { [Op.in]: removeItems },
                        bomId: id
                    },
                    transaction
                }
            );
            itemsChanged = true;
        }

        // Add or update BOM items
        if (items && items.length > 0) {
            for (let i = 0; i < items.length; i++) {
                const itemData = items[i];
                
                if (itemData.id) {
                    // Update existing BOM item
                    const existingItem = await BOMItem.findOne({
                        where: { id: itemData.id, bomId: id, isActive: true },
                        transaction
                    });
                    
                    if (existingItem) {
                        await existingItem.update({
                            ...itemData,
                            updatedBy: currentUserId
                        }, { transaction });
                        itemsChanged = true;
                    }
                } else {
                    // Create new BOM item
                    if (!itemData.itemId || !itemData.quantity) {
                        await transaction.rollback();
                        return res.status(400).json({ 
                            error: `Item ID and quantity are required for new BOM item at index ${i}` 
                        });
                    }

                    // Validate quantities
                    if (itemData.quantity <= 0) {
                        await transaction.rollback();
                        return res.status(400).json({ 
                            error: `Quantity must be greater than 0 for BOM item at index ${i}` 
                        });
                    }

                    // Validate item exists
                    const bomItemExists = await Item.findByPk(itemData.itemId);
                    if (!bomItemExists) {
                        await transaction.rollback();
                        return res.status(400).json({ 
                            error: `Item with ID ${itemData.itemId} not found for BOM item at index ${i}` 
                        });
                    }

                    await BOMItem.create({
                        ...itemData,
                        bomId: id,
                        sequence: itemData.sequence || (i + 1),
                        createdBy: currentUserId,
                        updatedBy: currentUserId
                    }, { transaction });
                    itemsChanged = true;
                }
            }
        }

        // Recalculate total cost if items changed or explicitly requested
        if (itemsChanged || bomData.recalculateCost) {
            await this.recalculateBOMCostInTransaction(id, transaction);
        }

        await transaction.commit();

        // Fetch updated BOM with associations
        const updatedBOM = await BOM.findByPk(id, {
            include: [
                { 
                    model: Item, 
                    as: 'Item',
                    include: [
                        { model: Category, attributes: ['id', 'name'] }
                    ]
                },
                { model: Location, as: 'Location', attributes: ['id', 'name'] },
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] },
                { 
                    model: BOMItem, 
                    as: 'BOMItems',
                    where: { isActive: true },
                    required: false,
                    include: [
                        { model: Item, as: 'Item', attributes: ['id', 'name', 'sku'] }
                    ]
                }
            ]
        });

        res.json(updatedBOM);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Soft delete a BOM
exports.deleteBOM = async (req, res) => {
    try {
        const { id } = req.params;

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const bom = await BOM.findByPk(id);
        if (!bom) {
            return res.status(404).json({ error: 'BOM not found' });
        }

        // Check if BOM has active production orders
        const { ProductionOrder } = require('../models');
        const activeProductionOrders = await ProductionOrder.count({
            where: { 
                bomId: id,
                status: { [Op.in]: ['planned', 'in_progress'] }
            }
        });

        if (activeProductionOrders > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete BOM with active production orders' 
            });
        }

        await bom.update({
            isActive: false,
            updatedBy: currentUserId
        });

        // Also deactivate all BOM items
        await BOMItem.update(
            { isActive: false, updatedBy: currentUserId },
            { where: { bomId: id } }
        );

        res.json({ message: 'BOM deleted successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get BOMs by item ID
exports.getBOMsByItemId = async (req, res) => {
    try {
        const { itemId } = req.params;
        const { locationId, onlyActive = true } = req.query;

        const whereConditions = { itemId: itemId };
        
        if (onlyActive === 'true') {
            whereConditions.isActive = true;
        }
        
        if (locationId) {
            whereConditions.locationId = locationId;
        }

        const boms = await BOM.findAll({
            where: whereConditions,
            include: [
                { model: Location, as: 'Location', attributes: ['id', 'name'] },
                { 
                    model: BOMItem, 
                    as: 'BOMItems',
                    where: { isActive: true },
                    required: false,
                    include: [
                        { model: Item, as: 'Item', attributes: ['id', 'name', 'sku'] }
                    ],
                    order: [['sequence', 'ASC']]
                }
            ],
            order: [['version', 'DESC'], ['createdAt', 'DESC']]
        });

        res.json(boms);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Recalculate BOM total cost
exports.recalculateBOMCost = async (bomId) => {
    try {
        const bomItems = await BOMItem.findAll({
            where: { bomId: bomId, isActive: true }
        });

        const totalCost = bomItems.reduce((sum, item) => {
            return sum + parseFloat(item.totalCost || 0);
        }, 0);

        await BOM.update(
            { totalCost: totalCost },
            { where: { id: bomId } }
        );

        return totalCost;
    } catch (error) {
        throw error;
    }
};

// Calculate material requirements for production
exports.calculateMaterialRequirements = async (req, res) => {
    try {
        const { id } = req.params;
        const { plannedQuantity = 1 } = req.query;

        const bom = await BOM.findByPk(id, {
            include: [
                { 
                    model: BOMItem, 
                    as: 'BOMItems',
                    where: { isActive: true },
                    required: false,
                    include: [
                        { model: Item, as: 'Item' }
                    ]
                }
            ]
        });

        if (!bom) {
            return res.status(404).json({ error: 'BOM not found' });
        }

        const requirements = bom.BOMItems.map(bomItem => {
            const requiredQuantity = parseFloat(bomItem.quantity) * parseFloat(plannedQuantity);
            const totalCost = requiredQuantity * parseFloat(bomItem.cost || 0);
            
            return {
                itemId: bomItem.itemId,
                item: bomItem.Item,
                requiredQuantity: requiredQuantity,
                unitCost: bomItem.cost,
                totalCost: totalCost,
                unit: bomItem.unit,
                wastagePercentage: bomItem.wastagePercentage || 0,
                adjustedQuantity: requiredQuantity * (1 + (bomItem.wastagePercentage || 0) / 100)
            };
        });

        const totalMaterialCost = requirements.reduce((sum, req) => sum + req.totalCost, 0);

        res.json({
            bomId: id,
            plannedQuantity: parseFloat(plannedQuantity),
            materialRequirements: requirements,
            totalMaterialCost: totalMaterialCost
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Duplicate BOM (create new version)
exports.duplicateBOM = async (req, res) => {
    try {
        const { id } = req.params;
        const { newVersion } = req.body;

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const originalBOM = await BOM.findByPk(id, {
            include: [
                { model: BOMItem, as: 'BOMItems', where: { isActive: true }, required: false }
            ]
        });

        if (!originalBOM) {
            return res.status(404).json({ error: 'BOM not found' });
        }

        // Create new BOM
        const newBOM = await BOM.create({
            itemId: originalBOM.itemId,
            qty: originalBOM.qty,
            locationId: originalBOM.locationId,
            name: originalBOM.name,
            version: newVersion || `${originalBOM.version}-copy`,
            totalCost: originalBOM.totalCost,
            createdBy: currentUserId,
            updatedBy: currentUserId
        });

        // Copy BOM items
        const newBOMItems = [];
        for (const bomItem of originalBOM.BOMItems) {
            const newBOMItem = await BOMItem.create({
                bomId: newBOM.id,
                itemId: bomItem.itemId,
                quantity: bomItem.quantity,
                unit: bomItem.unit,
                cost: bomItem.cost,
                totalCost: bomItem.totalCost,
                remark: bomItem.remark,
                sequence: bomItem.sequence,
                wastagePercentage: bomItem.wastagePercentage,
                createdBy: currentUserId,
                updatedBy: currentUserId
            });
            newBOMItems.push(newBOMItem);
        }

        // Fetch the duplicated BOM with associations
        const duplicatedBOM = await BOM.findByPk(newBOM.id, {
            include: [
                { model: Item, as: 'Item' },
                { model: Location, as: 'Location' },
                { model: BOMItem, as: 'BOMItems', include: [{ model: Item, as: 'Item' }] }
            ]
        });

        res.status(201).json(duplicatedBOM);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Create BOM with items in a single transaction
exports.createBOMWithItems = async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
        const { bomData, items = [] } = req.body;
        
        // Validate required fields
        if (!bomData.itemId || !bomData.locationId) {
            await transaction.rollback();
            return res.status(400).json({ 
                error: 'Item ID and location ID are required for BOM' 
            });
        }

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await transaction.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        // Create BOM
        const bom = await BOM.create({
            ...bomData,
            qty: bomData.qty || 1.00,
            createdBy: currentUserId,
            updatedBy: currentUserId
        }, { transaction });

        // Create BOM items
        const createdItems = [];
        for (let i = 0; i < items.length; i++) {
            const itemData = items[i];
            
            // Validate required fields for BOM item
            if (!itemData.itemId || !itemData.quantity) {
                await transaction.rollback();
                return res.status(400).json({ 
                    error: `Item ID and quantity are required for BOM item at index ${i}` 
                });
            }

            // Validate quantities and costs
            if (itemData.quantity <= 0) {
                await transaction.rollback();
                return res.status(400).json({ 
                    error: `Quantity must be greater than 0 for BOM item at index ${i}` 
                });
            }

            const bomItem = await BOMItem.create({
                ...itemData,
                bomId: bom.id,
                sequence: itemData.sequence || (i + 1),
                createdBy: currentUserId,
                updatedBy: currentUserId
            }, { transaction });

            createdItems.push(bomItem);
        }

        // Recalculate BOM total cost
        await this.recalculateBOMCostInTransaction(bom.id, transaction);

        await transaction.commit();

        // Fetch the created BOM with all associations
        const createdBOM = await BOM.findByPk(bom.id, {
            include: [
                { 
                    model: Item, 
                    as: 'Item',
                    include: [{ model: Category, attributes: ['id', 'name'] }]
                },
                { model: Location, as: 'Location', attributes: ['id', 'name'] },
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { 
                    model: BOMItem, 
                    as: 'BOMItems',
                    where: { isActive: true },
                    required: false,
                    include: [
                        { 
                            model: Item, 
                            as: 'Item', 
                            attributes: ['id', 'name', 'sku'],
                            include: [{ model: Category, attributes: ['id', 'name'] }]
                        }
                    ],
                    order: [['sequence', 'ASC']]
                }
            ]
        });

        res.status(201).json(createdBOM);
    } catch (error) {
        await transaction.rollback();
        res.status(400).json({ error: error.message });
    }
};

// Update BOM with items
exports.updateBOMWithItems = async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
        const { id } = req.params;
        const { bomData, items = [], removeItems = [] } = req.body;

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await transaction.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        // Find existing BOM
        const bom = await BOM.findByPk(id, { transaction });
        if (!bom) {
            await transaction.rollback();
            return res.status(404).json({ error: 'BOM not found' });
        }

        // Update BOM data
        await bom.update({
            ...bomData,
            updatedBy: currentUserId
        }, { transaction });

        // Remove specified BOM items
        if (removeItems.length > 0) {
            await BOMItem.update(
                { isActive: false, updatedBy: currentUserId },
                { 
                    where: { 
                        id: { [Op.in]: removeItems },
                        bomId: id
                    },
                    transaction
                }
            );
        }

        // Add or update BOM items
        for (let i = 0; i < items.length; i++) {
            const itemData = items[i];
            
            if (itemData.id) {
                // Update existing BOM item
                const existingItem = await BOMItem.findOne({
                    where: { id: itemData.id, bomId: id, isActive: true },
                    transaction
                });
                
                if (existingItem) {
                    await existingItem.update({
                        ...itemData,
                        updatedBy: currentUserId
                    }, { transaction });
                }
            } else {
                // Create new BOM item
                if (!itemData.itemId || !itemData.quantity) {
                    await transaction.rollback();
                    return res.status(400).json({ 
                        error: `Item ID and quantity are required for new BOM item at index ${i}` 
                    });
                }

                await BOMItem.create({
                    ...itemData,
                    bomId: id,
                    sequence: itemData.sequence || (i + 1),
                    createdBy: currentUserId,
                    updatedBy: currentUserId
                }, { transaction });
            }
        }

        // Recalculate BOM total cost
        await this.recalculateBOMCostInTransaction(id, transaction);

        await transaction.commit();

        // Fetch updated BOM with associations
        const updatedBOM = await BOM.findByPk(id, {
            include: [
                { 
                    model: Item, 
                    as: 'Item',
                    include: [{ model: Category, attributes: ['id', 'name'] }]
                },
                { model: Location, as: 'Location', attributes: ['id', 'name'] },
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] },
                { 
                    model: BOMItem, 
                    as: 'BOMItems',
                    where: { isActive: true },
                    required: false,
                    include: [
                        { 
                            model: Item, 
                            as: 'Item', 
                            attributes: ['id', 'name', 'sku'],
                            include: [{ model: Category, attributes: ['id', 'name'] }]
                        }
                    ],
                    order: [['sequence', 'ASC']]
                }
            ]
        });

        res.json(updatedBOM);
    } catch (error) {
        await transaction.rollback();
        res.status(500).json({ error: error.message });
    }
};

// Add single item to BOM
exports.addItemToBOM = async (req, res) => {
    try {
        const { id } = req.params; // BOM ID
        const itemData = req.body;

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        // Validate BOM exists
        const bom = await BOM.findByPk(id);
        if (!bom || !bom.isActive) {
            return res.status(400).json({ error: 'BOM not found or inactive' });
        }

        // Validate required fields
        if (!itemData.itemId || !itemData.quantity) {
            return res.status(400).json({ 
                error: 'Item ID and quantity are required' 
            });
        }

        // Check if BOM item already exists for this BOM and item combination
        const existingBOMItem = await BOMItem.findOne({ 
            where: { 
                bomId: id, 
                itemId: itemData.itemId,
                isActive: true
            } 
        });
        if (existingBOMItem) {
            return res.status(400).json({ error: 'BOM item already exists for this BOM and item combination' });
        }

        // Validate quantities and costs
        if (itemData.quantity <= 0) {
            return res.status(400).json({ error: 'Quantity must be greater than 0' });
        }

        // Set sequence if not provided
        if (!itemData.sequence) {
            const maxSequence = await BOMItem.max('sequence', {
                where: { bomId: id, isActive: true }
            });
            itemData.sequence = (maxSequence || 0) + 1;
        }

        const bomItem = await BOMItem.create({
            ...itemData,
            bomId: id,
            createdBy: currentUserId,
            updatedBy: currentUserId
        });

        // Update BOM total cost
        await this.recalculateBOMCost(id);

        // Fetch created BOM item with associations
        const createdBOMItem = await BOMItem.findByPk(bomItem.id, {
            include: [
                { 
                    model: Item, 
                    as: 'Item', 
                    include: [{ model: Category, attributes: ['id', 'name'] }]
                }
            ]
        });

        res.status(201).json(createdBOMItem);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Remove item from BOM
exports.removeItemFromBOM = async (req, res) => {
    try {
        const { id, itemId } = req.params; // BOM ID and BOM Item ID

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        // Find BOM item
        const bomItem = await BOMItem.findOne({
            where: { 
                id: itemId,
                bomId: id,
                isActive: true
            }
        });

        if (!bomItem) {
            return res.status(404).json({ error: 'BOM item not found' });
        }

        // Soft delete the BOM item
        await bomItem.update({ 
            isActive: false,
            updatedBy: currentUserId
        });

        // Recalculate BOM total cost
        await this.recalculateBOMCost(id);

        res.json({ message: 'BOM item removed successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update BOM item
exports.updateBOMItem = async (req, res) => {
    try {
        const { id, itemId } = req.params; // BOM ID and BOM Item ID
        const updateData = req.body;

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        // Find BOM item
        const bomItem = await BOMItem.findOne({
            where: { 
                id: itemId,
                bomId: id,
                isActive: true
            }
        });

        if (!bomItem) {
            return res.status(404).json({ error: 'BOM item not found' });
        }

        // Validate quantities if provided
        if (updateData.quantity !== undefined && updateData.quantity <= 0) {
            return res.status(400).json({ error: 'Quantity must be greater than 0' });
        }

        if (updateData.cost !== undefined && updateData.cost < 0) {
            return res.status(400).json({ error: 'Cost must be non-negative' });
        }

        // Update BOM item
        await bomItem.update({
            ...updateData,
            updatedBy: currentUserId
        });

        // Recalculate BOM total cost
        await this.recalculateBOMCost(id);

        // Fetch updated BOM item with associations
        const updatedBOMItem = await BOMItem.findByPk(bomItem.id, {
            include: [
                { 
                    model: Item, 
                    as: 'Item', 
                    include: [{ model: Category, attributes: ['id', 'name'] }]
                }
            ]
        });

        res.json(updatedBOMItem);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Helper method for recalculating BOM cost within transaction
exports.recalculateBOMCostInTransaction = async (bomId, transaction) => {
    try {
        // Calculate total cost from all active BOM items
        const bomItems = await BOMItem.findAll({
            where: { 
                bomId: bomId,
                isActive: true
            },
            transaction
        });

        let totalCost = 0;
        bomItems.forEach(item => {
            if (item.totalCost) {
                totalCost += parseFloat(item.totalCost);
            }
        });

        // Update BOM total cost
        await BOM.update(
            { totalCost: totalCost },
            { where: { id: bomId }, transaction }
        );

        return totalCost;
    } catch (error) {
        console.error('Error recalculating BOM cost:', error);
        throw error;
    }
};