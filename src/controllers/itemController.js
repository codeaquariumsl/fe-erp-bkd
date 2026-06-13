const GRNScheduleItem = require('../models/grnScheduleItem');
const { GRNItem, Stock, User, GRN, Category, Item } = require('../models');
const skuGenerator = require('../utils/skuGenerator');

// Create a new item
exports.createItem = async (req, res) => {
    try {
        const data = req.body;

        // Validate required fields
        if (!data.name || !data.categoryId) {
            return res.status(400).json({ error: 'Name and Category ID are required' });
        }

        const category = await Category.findByPk(data.categoryId);
        if (!category) return res.status(400).json({ error: 'Category not found' });

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        // Validate new fields
        if (data.itemsPerBox !== undefined && (!Number.isInteger(data.itemsPerBox) || data.itemsPerBox < 1)) {
            return res.status(400).json({ error: 'Items per box must be a positive integer' });
        }

        if (data.leadTimeDays !== undefined && (!Number.isInteger(data.leadTimeDays) || data.leadTimeDays < 0)) {
            return res.status(400).json({ error: 'Lead time days must be a non-negative integer' });
        }

        if (data.reorderLevelQty !== undefined && (!Number.isInteger(data.reorderLevelQty) || data.reorderLevelQty < 0)) {
            return res.status(400).json({ error: 'Reorder level quantity must be a non-negative integer' });
        }

        // Validate boolean fields
        if (data.doNotAllowDirectSale !== undefined && typeof data.doNotAllowDirectSale !== 'boolean') {
            return res.status(400).json({ error: 'doNotAllowDirectSale must be a boolean value' });
        }

        if (data.allowsMinus !== undefined && typeof data.allowsMinus !== 'boolean') {
            return res.status(400).json({ error: 'allowsMinus must be a boolean value' });
        }

        // Generate SKU if not provided
        if (!data.sku) {
            try {
                data.sku = await skuGenerator.generateUniqueSKU(data.categoryId, data.locationId);
            } catch (error) {
                return res.status(400).json({ error: `SKU generation failed: ${error.message}` });
            }
        } else {
            // Validate provided SKU is unique
            const isUnique = await skuGenerator.validateSKUUniqueness(data.sku);
            if (!isUnique) {
                return res.status(400).json({ error: 'SKU already exists. Please provide a unique SKU.' });
            }
        }

        const item = await Item.create({
            ...data,
            createdBy: currentUserId,
            updatedBy: currentUserId
        });

        res.status(201).json(item);
    } catch (error) {
        console.log(error);
        res.status(400).json({ error: error.message });
    }
};

// Get all items (with optional stock availability)
exports.getItems = async (req, res) => {
    try {
        const User = require('../models/user');
        const locationId = req.query.locationId || null;
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;

        // Determine if pagination is requested
        const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;

        // Ensure correct alias usage for user associations
        const options = {
            where: { status: 'active' },
            include: [
                Category,
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] }
            ],
            order: [['createdAt', 'DESC']]
        };

        if (isPaginated) {
            options.limit = limit;
            options.offset = offset;
        }

        const { count, rows: items } = isPaginated
            ? await Item.findAndCountAll(options)
            : { count: 0, rows: await Item.findAll(options) };

        // Enrich items with stock availability (parallelized)
        const result = await Promise.all(items.map(async item => {
            const obj = item.toJSON();
            obj.createdUserName = obj.Creator ? obj.Creator.username : null;
            obj.updatedUserName = obj.Updater ? obj.Updater.username : null;

            // Build stock where clause
            const stockWhere = { itemId: item.id, status: 'Active' };
            if (locationId) stockWhere.locationId = locationId;

            // Fetch stock records for this item
            const stocks = await Stock.findAll({
                where: stockWhere,
                attributes: ['id', 'itemId', 'availableQty', 'weight', 'status', 'locationId', 'storeId', 'createdAt', 'updatedAt']
            });

            const totalAvailableQuantity = stocks.reduce((sum, s) => sum + (Number(s.availableQty) || 0), 0);
            const totalWeight = stocks.reduce((sum, s) => sum + (Number(s.weight) || 0), 0);

            obj.availability = {
                totalAvailableQuantity,
                totalWeight,
                totalStockRecords: stocks.length,
                hasStock: totalAvailableQuantity > 0,
                allowsNegativeStock: item.allowsMinus
            };

            delete obj.Creator;
            delete obj.Updater;
            return obj;
        }));

        // Return response with pagination metadata if applicable
        if (isPaginated) {
            const totalPages = Math.ceil(count / limit);
            return res.json({
                data: result,
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            });
        }

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getRawMaterials = async (req, res) => {
    try {
        const items = await Item.findAll({
            where: { status: 'active', isProductionRawMaterial: true },
            include: [
                Category
            ],
            order: [['createdAt', 'DESC']]
        });
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getFinishedGoods = async (req, res) => {
    try {
        const items = await Item.findAll({
            where: { status: 'active', isProductionRawMaterial: false },
            include: [
                Category
            ],
            order: [['createdAt', 'DESC']]
        });
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get all active items with scheduled GRN for a specific date
exports.getItemsWithSchedule = async (req, res) => {
    try {
        const { date, storeId } = req.params;
        const currentDate = date || new Date().toISOString().split('T')[0];

        // Get all active items
        const items = await Item.findAll({
            where: { status: 'active' },
            include: [
                Category,
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] }
            ]
        });

        const result = await Promise.all(items.map(async (item) => {
            // Get all GRN items for this item
            const grnItems = await GRNItem.findAll({
                where: { itemId: item.id },
                include: [
                    {
                        model: GRN,
                        where: { status: ['Approved', 'QC Checked'] } // Ensure only approved or active GRNs are included
                    },
                    {
                        model: require('../models/palletRack'),
                        as: 'PalletRack',
                        attributes: ['id', 'code', 'availableQty', 'weight', 'coldRoomId']
                    }
                ],
                order: [['createdAt', 'ASC']]
            });

            // First, try to find scheduled GRN for the specific date
            let scheduleItem = await GRNScheduleItem.findOne({
                where: {
                    itemId: item.id,
                    scheduleDate: currentDate,
                    isActive: true
                }
            });

            let scheduledGrnId = null;
            let scheduledGrn = null;

            if (scheduleItem) {
                // Determine which GRN to use (priority: GRN1 > GRN2 > GRN3)
                // Get the GRN IDs and fetch the corresponding GRN details
                const grnIds = [scheduleItem.grn1Id, scheduleItem.grn2Id, scheduleItem.grn3Id].filter(Boolean);
                console.log(`Found schedule for item ${item.id} on ${currentDate} with GRN IDs: ${grnIds.join(', ')}`);

                if (grnIds.length > 0) {
                    // Find the first available GRN from the schedule
                    for (const grnId of grnIds) {
                        const correspondingGrnItem = grnItems.find(gi => gi.grnId === grnId);
                        if (correspondingGrnItem && correspondingGrnItem.GRN) {
                            scheduledGrnId = grnId;
                            scheduledGrn = {
                                id: correspondingGrnItem.GRN.id,
                                grnNumber: correspondingGrnItem.GRN.grnNumber
                            };
                            console.log(`Using scheduled GRN ${grnId} for item ${item.id}`);
                            break; // Use the first available one
                        }
                    }

                    // If no GRN from schedule is available in grnItems, fetch it separately
                    if (!scheduledGrn) {
                        const primaryGrnId = scheduleItem.grn1Id || scheduleItem.grn2Id || scheduleItem.grn3Id;
                        console.log(`Scheduled GRNs not found in active items, fetching GRN ${primaryGrnId} separately`);
                        try {
                            const primaryGrn = await GRN.findByPk(primaryGrnId);
                            if (primaryGrn) {
                                scheduledGrnId = primaryGrnId;
                                scheduledGrn = {
                                    id: primaryGrn.id,
                                    grnNumber: primaryGrn.grnNumber
                                };
                            }
                        } catch (error) {
                            console.error(`Error fetching GRN ${primaryGrnId}:`, error.message);
                        }
                    }
                }
            } else if (grnItems.length > 0) {
                // If no schedule for this date, use first active GRN
                const firstActiveGrn = grnItems[0];
                scheduledGrnId = firstActiveGrn.grnId;
                scheduledGrn = {
                    id: firstActiveGrn.GRN.id,
                    grnNumber: firstActiveGrn.GRN.grnNumber
                };
            }

            const stock = await Stock.findAll({
                where: {
                    itemId: item.id,
                    storeId: storeId,
                    status: 'Active'
                },
            });

            return {
                id: item.id,
                name: item.name,
                barcode: item.barcode,
                categoryId: item.categoryId,
                temperature: item.temperature,
                unit: item.unit,
                country: item.country,
                color: item.color,
                weight: item.weight,
                sellingPrice: item.sellingPrice,
                stockQty: stock.reduce((total, s) => total + (s.availableQty || 0), 0),
                Category: {
                    id: item.Category.id,
                    name: item.Category.name,
                    code: item.Category.code,
                    image: item.Category.image || null
                },
                scheduledGrnId: scheduledGrnId,
                scheduledGrn: scheduledGrn,
                grnItemList: grnItems.map(grnItem => ({
                    id: grnItem.id,
                    grnId: grnItem.grnId,
                    itemId: grnItem.itemId,
                    grnQty: grnItem.grnQty,
                    receivedQty: grnItem.receivedQty,
                    availableQty: grnItem.availableQty,
                    weight: grnItem.weight,
                    unitPrice: grnItem.unitPrice,
                    totalPrice: grnItem.totalPrice,
                    expiryDate: grnItem.expiryDate,
                    palletRackId: grnItem.palletRackId,
                    PalletRack: grnItem.PalletRack ? {
                        id: grnItem.PalletRack.id,
                        code: grnItem.PalletRack.code,
                        availableQty: grnItem.PalletRack.availableQty,
                        weight: grnItem.PalletRack.weight,
                        location: grnItem.PalletRack.coldRoomId
                    } : null,
                    grn: {
                        id: grnItem.GRN.id,
                        grnNumber: grnItem.GRN.grnNumber,
                        grnDate: grnItem.GRN.grnDate,
                        status: grnItem.GRN.status
                    }
                }))
            };
        }));

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get single item with scheduled GRN for a specific date
exports.getItemWithSchedule = async (req, res) => {
    try {
        const { itemId, date } = req.params;
        const currentDate = date || new Date().toISOString().split('T')[0];

        // Get the specific item
        const item = await Item.findOne({
            where: { id: itemId, status: 'active' },
            include: [
                Category,
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] }
            ]
        });

        if (!item) {
            return res.status(404).json({ error: 'Item not found or inactive' });
        }

        // Get all GRN items for this item with available quantity > 0
        const grnItems = await GRNItem.findAll({
            where: {
                itemId: item.id,
                availableQty: { [require('sequelize').Op.gt]: 0 }
            },
            include: [{
                model: GRN,
                where: { status: ['Approved', 'QC Checked'] }
            }],
            order: [['createdAt', 'DESC']]
        });

        // First, try to find scheduled GRN for the specific date
        let scheduleItem = await GRNScheduleItem.findOne({
            where: {
                itemId: item.id,
                scheduleDate: currentDate,
                isActive: true
            }
        });

        let scheduledGrnId = null;
        let scheduledGrn = null;
        let availableQty = 0;

        if (scheduleItem) {
            // Determine which GRN to use (priority: GRN1 > GRN2 > GRN3)
            // Get the GRN IDs and find the corresponding GRN details
            const grnIds = [scheduleItem.grn1Id, scheduleItem.grn2Id, scheduleItem.grn3Id].filter(Boolean);

            if (grnIds.length > 0) {
                // Find the first available GRN from the schedule
                for (const grnId of grnIds) {
                    const correspondingGrnItem = grnItems.find(gi => gi.grnId === grnId);
                    if (correspondingGrnItem && correspondingGrnItem.GRN) {
                        scheduledGrnId = grnId;
                        scheduledGrn = {
                            id: correspondingGrnItem.GRN.id,
                            grnNumber: correspondingGrnItem.GRN.grnNumber,
                            grnDate: correspondingGrnItem.GRN.grnDate,
                            status: correspondingGrnItem.GRN.status
                        };
                        availableQty = correspondingGrnItem.availableQty;
                        break; // Use the first available one
                    }
                }

                // If no GRN from schedule is available in grnItems, fetch it separately
                if (!scheduledGrn) {
                    const primaryGrnId = scheduleItem.grn1Id || scheduleItem.grn2Id || scheduleItem.grn3Id;
                    const primaryGrn = await GRN.findByPk(primaryGrnId);
                    if (primaryGrn) {
                        scheduledGrnId = primaryGrnId;
                        scheduledGrn = {
                            id: primaryGrn.id,
                            grnNumber: primaryGrn.grnNumber,
                            grnDate: primaryGrn.grnDate,
                            status: primaryGrn.status
                        };
                        // Try to find available quantity
                        const grnItem = grnItems.find(gi => gi.grnId === primaryGrnId);
                        availableQty = grnItem ? grnItem.availableQty : 0;
                    }
                }
            }
        } else if (grnItems.length > 0) {
            // No schedule for this date, use first available GRN
            const firstAvailableGrn = grnItems[0];
            scheduledGrnId = firstAvailableGrn.grnId;
            scheduledGrn = {
                id: firstAvailableGrn.GRN.id,
                grnNumber: firstAvailableGrn.GRN.grnNumber,
                grnDate: firstAvailableGrn.GRN.grnDate,
                status: firstAvailableGrn.GRN.status
            };
            availableQty = firstAvailableGrn.availableQty;
        }

        const result = {
            id: item.id,
            name: item.name,
            categoryId: item.categoryId,
            temperature: item.temperature,
            unit: item.unit,
            country: item.country,
            color: item.color,
            weight: item.weight,
            barcode: item.barcode,
            sellingPrice: item.sellingPrice,
            Category: {
                id: item.Category.id,
                name: item.Category.name,
                code: item.Category.code,
                image: item.Category.image || null
            },
            scheduledGrnId: scheduledGrnId,
            scheduledGrn: scheduledGrn,
            availableQty: availableQty,
            isScheduled: !!scheduleItem, // true if there's a schedule for this date, false if using first available
            grnItemList: grnItems.map(grnItem => ({
                id: grnItem.id,
                grnId: grnItem.grnId,
                itemId: grnItem.itemId,
                receivedQty: grnItem.receivedQty,
                availableQty: grnItem.availableQty,
                unitPrice: grnItem.unitPrice,
                totalPrice: grnItem.totalPrice,
                expiryDate: grnItem.expiryDate,
                grn: {
                    id: grnItem.GRN.id,
                    grnNumber: grnItem.GRN.grnNumber,
                    grnDate: grnItem.GRN.grnDate,
                    status: grnItem.GRN.status
                }
            }))
        };

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get a single item by ID
exports.getItemById = async (req, res) => {
    try {
        const User = require('../models/user');
        // Ensure correct alias usage for user associations
        const item = await Item.findByPk(req.params.id, {
            include: [
                Category,
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] }
            ]
        });
        if (!item) return res.status(404).json({ error: 'Item not found' });
        const obj = item.toJSON();
        obj.createdUserName = obj.Creator ? obj.Creator.username : null;
        obj.updatedUserName = obj.Updater ? obj.Updater.username : null;
        delete obj.Creator;
        delete obj.Updater;
        res.json(obj);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update an item
exports.updateItem = async (req, res) => {
    try {
        const data = req.body;
        const item = await Item.findByPk(req.params.id);
        if (!item) return res.status(404).json({ error: 'Item not found' });
        if (data.categoryId) {
            const category = await Category.findByPk(data.categoryId);
            if (!category) return res.status(400).json({ error: 'Category not found' });
        }

        // Validate new fields if they are being updated
        if (data.itemsPerBox !== undefined && (!Number.isInteger(data.itemsPerBox) || data.itemsPerBox < 1)) {
            return res.status(400).json({ error: 'Items per box must be a positive integer' });
        }

        if (data.leadTimeDays !== undefined && (!Number.isInteger(data.leadTimeDays) || data.leadTimeDays < 0)) {
            return res.status(400).json({ error: 'Lead time days must be a non-negative integer' });
        }

        if (data.reorderLevelQty !== undefined && (!Number.isInteger(data.reorderLevelQty) || data.reorderLevelQty < 0)) {
            return res.status(400).json({ error: 'Reorder level quantity must be a non-negative integer' });
        }

        // Validate boolean fields
        if (data.doNotAllowDirectSale !== undefined && typeof data.doNotAllowDirectSale !== 'boolean') {
            return res.status(400).json({ error: 'doNotAllowDirectSale must be a boolean value' });
        }

        if (data.allowsMinus !== undefined && typeof data.allowsMinus !== 'boolean') {
            return res.status(400).json({ error: 'allowsMinus must be a boolean value' });
        }

        // Validate SKU if provided and different from current
        if (data.sku && data.sku !== item.sku) {
            const isUnique = await skuGenerator.validateSKUUniqueness(data.sku, req.params.id, data.locationId);
            if (!isUnique) {
                return res.status(400).json({ error: 'SKU already exists. Please provide a unique SKU.' });
            }
        } else {
            try {
                data.sku = await skuGenerator.generateUniqueSKU(data.categoryId, data.locationId);
            } catch (error) {
                return res.status(400).json({ error: `SKU generation failed: ${error.message}` });
            }
        }

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }
        await item.update({ ...data, updatedBy: currentUserId });
        res.json(item);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Generate SKU for existing item
exports.generateSKU = async (req, res) => {
    try {
        const { id } = req.params;
        const item = await Item.findByPk(id);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        const newSKU = await skuGenerator.generateUniqueSKU(item.categoryId);
        const oldSKU = item.sku;

        await item.update({ sku: newSKU });

        res.json({
            message: 'SKU generated successfully',
            itemId: id,
            itemName: item.name,
            oldSKU: oldSKU,
            newSKU: newSKU
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Validate SKU uniqueness
exports.validateSKU = async (req, res) => {
    try {
        const { sku } = req.body;
        const { id } = req.params; // Optional: for update scenarios

        if (!sku) {
            return res.status(400).json({ error: 'SKU is required' });
        }

        const isUnique = await skuGenerator.validateSKUUniqueness(sku, id);

        res.json({
            sku: sku,
            isUnique: isUnique,
            message: isUnique ? 'SKU is available' : 'SKU already exists'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Delete an item
exports.deleteItem = async (req, res) => {
    try {
        // const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        // if (!currentUserId) {
        //     return res.status(401).json({ error: 'Unauthorized: missing user context' });
        // }
        const item = await Item.findByPk(req.params.id);
        if (!item) return res.status(404).json({ error: 'Item not found' });
        await item.update({ status: 'inactive' });
        // await item.destroy();
        res.json({ message: 'Item deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
