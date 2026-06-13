const { Batch, BatchItem, GRN, Location, Store, Item, User, Category } = require('../models');
const { Op } = require('sequelize');

// Create a new batch with items
exports.createBatch = async (req, res) => {
    try {
        const data = req.body;
        const { items = [] } = req.body;

        // Validate required fields
        if (!data.batchNumber || !data.batchDate || !data.grnId || !data.locationId || !data.storeId) {
            return res.status(400).json({
                error: 'Batch number, batch date, GRN ID, location ID, and store ID are required'
            });
        }

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        // Validate GRN exists
        const grn = await GRN.findByPk(data.grnId);
        if (!grn) {
            return res.status(400).json({ error: 'GRN not found' });
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

        // Check if batch number is unique
        const existingBatch = await Batch.findOne({ where: { batchNumber: data.batchNumber } });
        if (existingBatch) {
            return res.status(400).json({ error: 'Batch number already exists' });
        }

        // Validate expire date is after batch date
        if (data.expireDate && new Date(data.expireDate) <= new Date(data.batchDate)) {
            return res.status(400).json({ error: 'Expire date must be after batch date' });
        }

        // Create the batch
        const batch = await Batch.create({
            batchNumber: data.batchNumber,
            batchDate: data.batchDate,
            expireDate: data.expireDate,
            grnId: data.grnId,
            locationId: data.locationId,
            storeId: data.storeId,
            reference: data.reference || null,
            notes: data.notes || null,
            createdBy: currentUserId,
            updatedBy: currentUserId
        });

        // Create batch items if provided
        const batchItems = [];
        if (Array.isArray(items) && items.length > 0) {
            for (const itemData of items) {
                // Validate required fields for each item
                if (!itemData.itemId || !itemData.batchQuantity) {
                    throw new Error(`Item validation failed: itemId and batchQuantity are required for each item`);
                }

                // Validate item exists
                const item = await Item.findByPk(itemData.itemId);
                if (!item) {
                    throw new Error(`Item with ID ${itemData.itemId} not found`);
                }

                // Validate quantities
                if (itemData.batchQuantity <= 0) {
                    throw new Error(`Batch quantity must be greater than 0 for item ${itemData.itemId}`);
                }

                // Set available quantity to batch quantity if not provided
                const availableQuantity = itemData.availableQuantity !== undefined ? itemData.availableQuantity : itemData.batchQuantity;

                if (availableQuantity < 0 || availableQuantity > itemData.batchQuantity) {
                    throw new Error(`Available quantity must be between 0 and batch quantity for item ${itemData.itemId}`);
                }

                // Create batch item
                const createdBatchItem = await BatchItem.create({
                    batchId: batch.id,
                    itemId: itemData.itemId,
                    batchQuantity: itemData.batchQuantity,
                    availableQuantity: availableQuantity,
                    locationId: data.locationId,
                    storeId: data.storeId,
                    createdBy: currentUserId,
                    updatedBy: currentUserId
                });

                batchItems.push(createdBatchItem);
            }
        }

        // Fetch the created batch with associations
        const createdBatch = await Batch.findByPk(batch.id, {
            include: [
                { model: GRN, as: 'GRN', attributes: ['id', 'grnNumber', 'grnDate'] },
                { model: Location, as: 'Location', attributes: ['id', 'name'] },
                { model: Store, as: 'Store', attributes: ['id', 'name'] },
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                {
                    model: BatchItem,
                    as: 'BatchItems',
                    include: [
                        {
                            model: Item,
                            as: 'Item',
                            include: [
                                { model: Category, attributes: ['id', 'name'] }
                            ]
                        }
                    ]
                }
            ]
        });

        res.status(201).json(createdBatch);
    } catch (error) {
        console.log(error);

        res.status(400).json({ error: error.message });
    }
};

// Get all batches with filtering and pagination
exports.getBatches = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search,
            locationId,
            storeId,
            grnId,
            isActive,
            expiringSoon,
            sortBy = 'createdAt',
            sortOrder = 'DESC'
        } = req.query;

        const offset = (page - 1) * limit;
        const whereConditions = {};

        // Apply filters
        if (search) {
            whereConditions[Op.or] = [
                { batchNumber: { [Op.like]: `%${search}%` } },
                { reference: { [Op.like]: `%${search}%` } }
            ];
        }

        if (locationId) whereConditions.locationId = locationId;
        if (storeId) whereConditions.storeId = storeId;
        if (grnId) whereConditions.grnId = grnId;
        if (isActive !== undefined) whereConditions.isActive = isActive === 'true';

        // Filter for batches expiring soon (within 30 days)
        if (expiringSoon === 'true') {
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

            whereConditions.expireDate = {
                [Op.lte]: thirtyDaysFromNow,
                [Op.gte]: new Date()
            };
        }

        const { count, rows: batches } = await Batch.findAndCountAll({
            where: whereConditions,
            include: [
                { model: GRN, as: 'GRN', attributes: ['id', 'grnNumber', 'grnDate'] },
                { model: Location, as: 'Location', attributes: ['id', 'name'] },
                { model: Store, as: 'Store', attributes: ['id', 'name'] },
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] },
                {
                    model: BatchItem,
                    as: 'BatchItems',
                    attributes: ['id', 'batchQuantity', 'availableQuantity'],
                    include: [
                        { model: Item, as: 'Item', attributes: ['id', 'name', 'sku'] }
                    ]
                }
            ],
            order: [[sortBy, sortOrder.toUpperCase()]],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        const totalPages = Math.ceil(count / limit);

        res.json({
            batches,
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

// Get a specific batch by ID
exports.getBatchById = async (req, res) => {
    try {
        const { id } = req.params;

        const batch = await Batch.findByPk(id, {
            include: [
                { model: GRN, as: 'GRN', attributes: ['id', 'grnNumber', 'grnDate'] },
                { model: Location, as: 'Location', attributes: ['id', 'name'] },
                { model: Store, as: 'Store', attributes: ['id', 'name'] },
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] },
                {
                    model: BatchItem,
                    as: 'BatchItems',
                    include: [
                        {
                            model: Item,
                            as: 'Item',
                            include: [
                                { model: Category, attributes: ['id', 'name'] }
                            ]
                        }
                    ]
                }
            ]
        });

        if (!batch) {
            return res.status(404).json({ error: 'Batch not found' });
        }

        res.json(batch);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update a batch
exports.updateBatch = async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.body;

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const batch = await Batch.findByPk(id);
        if (!batch) {
            return res.status(404).json({ error: 'Batch not found' });
        }

        // If updating batch number, check uniqueness
        if (data.batchNumber && data.batchNumber !== batch.batchNumber) {
            const existingBatch = await Batch.findOne({
                where: {
                    batchNumber: data.batchNumber,
                    id: { [Op.ne]: id }
                }
            });
            if (existingBatch) {
                return res.status(400).json({ error: 'Batch number already exists' });
            }
        }

        // Validate expire date is after batch date
        const batchDate = data.batchDate || batch.batchDate;
        if (data.expireDate && new Date(data.expireDate) <= new Date(batchDate)) {
            return res.status(400).json({ error: 'Expire date must be after batch date' });
        }

        await batch.update({
            ...data,
            updatedBy: currentUserId
        });

        // Fetch updated batch with associations
        const updatedBatch = await Batch.findByPk(id, {
            include: [
                { model: GRN, as: 'GRN', attributes: ['id', 'grnNumber', 'grnDate'] },
                { model: Location, as: 'Location', attributes: ['id', 'name'] },
                { model: Store, as: 'Store', attributes: ['id', 'name'] },
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] }
            ]
        });

        res.json(updatedBatch);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Soft delete a batch (set isActive to false)
exports.deleteBatch = async (req, res) => {
    try {
        const { id } = req.params;

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const batch = await Batch.findByPk(id);
        if (!batch) {
            return res.status(404).json({ error: 'Batch not found' });
        }

        // Check if batch has active batch items
        const activeBatchItems = await BatchItem.count({
            where: {
                batchId: id,
                isActive: true,
                availableQuantity: { [Op.gt]: 0 }
            }
        });

        if (activeBatchItems > 0) {
            return res.status(400).json({
                error: 'Cannot delete batch with active items that have available quantity'
            });
        }

        await batch.update({
            isActive: false,
            updatedBy: currentUserId
        });

        // Also deactivate all batch items
        await BatchItem.update(
            { isActive: false, updatedBy: currentUserId },
            { where: { batchId: id } }
        );

        res.json({ message: 'Batch deleted successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get batches by GRN ID
exports.getBatchesByGrnId = async (req, res) => {
    try {
        const { grnId } = req.params;

        const batches = await Batch.findAll({
            where: {
                grnId: grnId,
                isActive: true
            },
            include: [
                { model: Location, as: 'Location', attributes: ['id', 'name'] },
                { model: Store, as: 'Store', attributes: ['id', 'name'] },
                {
                    model: BatchItem,
                    as: 'BatchItems',
                    where: { isActive: true },
                    required: false,
                    include: [
                        { model: Item, as: 'Item', attributes: ['id', 'name', 'sku'] }
                    ]
                }
            ],
            order: [['batchDate', 'ASC']]
        });

        res.json(batches);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get expiring batches (expire within specified days)
exports.getExpiringBatches = async (req, res) => {
    try {
        const { days = 30, locationId, storeId } = req.query;

        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + parseInt(days));

        const whereConditions = {
            isActive: true,
            expireDate: {
                [Op.lte]: futureDate,
                [Op.gte]: new Date()
            }
        };

        if (locationId) whereConditions.locationId = locationId;
        if (storeId) whereConditions.storeId = storeId;

        const batches = await Batch.findAll({
            where: whereConditions,
            include: [
                { model: GRN, as: 'GRN', attributes: ['id', 'grnNumber'] },
                { model: Location, as: 'Location', attributes: ['id', 'name'] },
                { model: Store, as: 'Store', attributes: ['id', 'name'] },
                {
                    model: BatchItem,
                    as: 'BatchItems',
                    where: {
                        isActive: true,
                        availableQuantity: { [Op.gt]: 0 }
                    },
                    required: false,
                    include: [
                        { model: Item, as: 'Item', attributes: ['id', 'name', 'sku'] }
                    ]
                }
            ],
            order: [['expireDate', 'ASC']]
        });

        res.json(batches);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Generate batch number
exports.generateBatchNumber = async (req, res) => {
    try {
        const { grnId } = req.body;

        if (!grnId) {
            return res.status(400).json({ error: 'GRN ID is required' });
        }

        // Get GRN details
        const grn = await GRN.findByPk(grnId);
        if (!grn) {
            return res.status(400).json({ error: 'GRN not found' });
        }

        // Generate batch number based on GRN number and date
        const grnNumber = grn.grnNumber;
        const currentDate = new Date();
        const dateString = currentDate.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD

        // Count existing batches for this GRN to create sequence
        const batchCount = await Batch.count({ where: { grnId } });
        const sequence = (batchCount + 1).toString().padStart(3, '0');

        const batchNumber = `BATCH-${grnNumber}-${dateString}-${sequence}`;

        res.json({ batchNumber });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Auto-generate batches and batch items from GRN
exports.autoGenerateBatchesFromGRN = async (req, res) => {
    try {
        const { grnId } = req.params;

        if (!grnId) {
            return res.status(400).json({ error: 'GRN ID is required' });
        }

        const currentUserId = (req.user && req.user.id) || (req.body && req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        // Validate GRN exists
        const grn = await GRN.findByPk(grnId, {
            include: [
                { model: require('../models').GRNItem, as: 'GRNItems' }
            ]
        });
        if (!grn) {
            return res.status(404).json({ error: 'GRN not found' });
        }

        // Get GRN items
        const grnItems = await require('../models').GRNItem.findAll({
            where: { grnId: grnId }
        });

        if (!grnItems || grnItems.length === 0) {
            return res.status(400).json({ error: 'No items found in this GRN' });
        }

        // Check if batches already exist for this GRN
        const existingBatches = await Batch.count({ where: { grnId: grnId } });
        if (existingBatches > 0) {
            return res.status(400).json({ error: 'Batches already exist for this GRN' });
        }

        // Create batch number
        const grnNumber = grn.grnNumber;
        const currentDate = new Date();
        const dateString = currentDate.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
        const sequence = '001';
        const batchNumber = `BATCH-${grnNumber}-${dateString}-${sequence}`;

        // Create the batch
        const batch = await Batch.create({
            batchNumber: batchNumber,
            batchDate: grn.grnDate,
            expireDate: null, // Will be set per item if available
            grnId: grnId,
            locationId: grn.locationId,
            storeId: grn.storeId,
            reference: null,
            notes: `Auto-generated from GRN ${grnNumber}`,
            createdBy: currentUserId,
            updatedBy: currentUserId
        });

        // Create batch items from GRN items
        const batchItems = [];
        for (const grnItem of grnItems) {
            // Validate item exists
            const item = await Item.findByPk(grnItem.itemId);
            if (!item) {
                throw new Error(`Item with ID ${grnItem.itemId} not found`);
            }

            // Create batch item with available quantity from GRN available quantity
            const createdBatchItem = await BatchItem.create({
                batchId: batch.id,
                itemId: grnItem.itemId,
                batchQuantity: grnItem.availableQty,
                availableQuantity: grnItem.availableQty,
                locationId: grn.locationId,
                storeId: grn.storeId,
                createdBy: currentUserId,
                updatedBy: currentUserId
            });

            batchItems.push(createdBatchItem);
        }

        // Fetch the created batch with associations
        const createdBatch = await Batch.findByPk(batch.id, {
            include: [
                { model: GRN, as: 'GRN', attributes: ['id', 'grnNumber', 'grnDate'] },
                { model: Location, as: 'Location', attributes: ['id', 'name'] },
                { model: Store, as: 'Store', attributes: ['id', 'name'] },
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                {
                    model: BatchItem,
                    as: 'BatchItems',
                    include: [
                        {
                            model: Item,
                            as: 'Item',
                            include: [
                                { model: Category, attributes: ['id', 'name'] }
                            ]
                        }
                    ]
                }
            ]
        });

        res.status(201).json({
            message: `Auto-generated batch with ${batchItems.length} items`,
            batch: createdBatch
        });
    } catch (error) {
        console.log(error);
        res.status(400).json({ error: error.message });
    }
};

// ========================
// BATCH ITEM OPERATIONS
// ========================

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

// Get batch by item ID
exports.getBatchByItemId = async (req, res) => {
    try {
        const { itemId } = req.params;

        // Find batch item by item ID
        const batchItem = await BatchItem.findOne({
            where: {
                itemId: itemId,
                isActive: true
            },
            include: [
                {
                    model: Batch,
                    as: 'Batch',
                    include: [
                        { model: GRN, as: 'GRN', attributes: ['id', 'grnNumber', 'grnDate'] }
                    ]
                },
                { model: Item, as: 'Item', attributes: ['id', 'name', 'sku'] }
            ],
            order: [['Batch', 'expireDate', 'ASC']]
        });

        if (!batchItem) {
            return res.status(404).json({ error: 'No batch found for the specified item' });
        }

        res.json(batchItem.Batch);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};