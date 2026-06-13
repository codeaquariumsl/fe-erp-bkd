const Store = require('../models/store');
const Location = require('../models/location');
const ColdRoom = require('../models/coldRoom');
const Stock = require('../models/stock');
const Item = require('../models/item');
const { Op } = require('sequelize');

// Create a new store
exports.createStore = async (req, res) => {
    try {
        const { name, capacity, locationId, coldRoomIds } = req.body;
        // Check if location exists
        const location = await Location.findByPk(locationId);
        if (!location) return res.status(400).json({ error: 'Location not found' });
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }
        const store = await Store.create({
            name, capacity, locationId,
            createdBy: currentUserId,
            updatedBy: currentUserId
        });
        // Associate cold rooms if provided
        if (Array.isArray(coldRoomIds) && coldRoomIds.length > 0) {
            await ColdRoom.update(
                { storeId: store.id },
                { where: { id: coldRoomIds } }
            );
        }
        res.status(201).json(store);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get all stores
exports.getStores = async (req, res) => {
    try {
        const stores = await Store.findAll({
            where: { locationId: req.query.locationId || { [Op.ne]: null } },
            include: [
                Location,
                { model: require('../models/user'), as: 'Creator', attributes: ['id', 'username'] },
                { model: require('../models/user'), as: 'Updater', attributes: ['id', 'username'] },
                { model: ColdRoom, as: 'ColdRooms' },
                {
                    model: Stock,
                    required: false, // LEFT JOIN to include stores even without stocks
                    include: [
                        {
                            model: Item,
                            attributes: ['id', 'name', 'unit', 'categoryId', 'color', 'country']
                        }
                    ]
                }
            ]
        });

        // Format response to include creator/updater usernames, cold rooms, and stocks
        const result = stores.map(store => {
            const obj = store.toJSON();
            obj.createdByUsername = obj.Creator ? obj.Creator.username : null;
            obj.updatedByUsername = obj.Updater ? obj.Updater.username : null;
            obj.coldRooms = obj.ColdRooms || [];

            // Format stocks with available quantities
            obj.stocks = (obj.Stocks || []).map(stock => ({
                id: stock.id,
                itemId: stock.itemId,
                itemName: stock.Item ? stock.Item.name : null,
                itemUnit: stock.Item ? stock.Item.unit : null,
                itemColor: stock.Item ? stock.Item.color : null,
                itemCountry: stock.Item ? stock.Item.country : null,
                availableQty: stock.availableQty,
                weight: stock.weight,
                status: stock.status
            }));

            delete obj.Creator;
            delete obj.Updater;
            delete obj.ColdRooms;
            delete obj.Stocks;
            return obj;
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get a single store by ID
exports.getStoreById = async (req, res) => {
    try {
        const store = await Store.findByPk(req.params.id, {
            include: [
                Location,
                { model: require('../models/user'), as: 'Creator', attributes: ['id', 'username'] },
                { model: require('../models/user'), as: 'Updater', attributes: ['id', 'username'] },
                { model: ColdRoom, as: 'ColdRooms' },
                {
                    model: Stock,
                    required: false, // LEFT JOIN to include store even without stocks
                    include: [
                        {
                            model: Item,
                            attributes: ['id', 'name', 'unit', 'categoryId']
                        }
                    ]
                }
            ]
        });
        if (!store) return res.status(404).json({ error: 'Store not found' });

        const obj = store.toJSON();
        obj.createdByUsername = obj.Creator ? obj.Creator.username : null;
        obj.updatedByUsername = obj.Updater ? obj.Updater.username : null;
        obj.coldRooms = obj.ColdRooms || [];

        // Format stocks with available quantities
        obj.stocks = (obj.Stocks || []).map(stock => ({
            id: stock.id,
            itemId: stock.itemId,
            itemName: stock.Item ? stock.Item.name : null,
            itemUnit: stock.Item ? stock.Item.unit : null,
            availableQty: stock.availableQty,
            weight: stock.weight,
            status: stock.status
        }));

        delete obj.Creator;
        delete obj.Updater;
        delete obj.ColdRooms;
        delete obj.Stocks;
        res.json(obj);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update a store
exports.updateStore = async (req, res) => {
    try {
        const { name, capacity, locationId, coldRoomIds } = req.body;
        const store = await Store.findByPk(req.params.id);
        if (!store) return res.status(404).json({ error: 'Store not found' });
        if (locationId) {
            const location = await Location.findByPk(locationId);
            if (!location) return res.status(400).json({ error: 'Location not found' });
        }
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }
        await store.update({ name, capacity, locationId, updatedBy: currentUserId });
        // Associate cold rooms if provided
        if (Array.isArray(coldRoomIds)) {
            // First, clear previous associations for this store
            await ColdRoom.update(
                { storeId: null },
                { where: { storeId: store.id } }
            );
            // Then, set new associations
            if (coldRoomIds.length > 0) {
                await ColdRoom.update(
                    { storeId: store.id },
                    { where: { id: coldRoomIds } }
                );
            }
        }
        res.json(store);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get stores by location ID
exports.getStoresByLocation = async (req, res) => {
    try {
        const { locationId } = req.params;
        
        // Validate locationId parameter
        if (!locationId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Location ID is required' 
            });
        }

        // Check if location exists
        const location = await Location.findByPk(locationId);
        if (!location) {
            return res.status(404).json({ 
                success: false, 
                message: 'Location not found' 
            });
        }

        const stores = await Store.findAll({
            where: { locationId: locationId },
            include: [
                {
                    model: Location,
                    attributes: ['id', 'name', 'address', 'city']
                },
                { 
                    model: require('../models/user'), 
                    as: 'Creator', 
                    attributes: ['id', 'username'] 
                },
                { 
                    model: require('../models/user'), 
                    as: 'Updater', 
                    attributes: ['id', 'username'] 
                },
                { 
                    model: ColdRoom, 
                    as: 'ColdRooms',
                    required: false,
                    attributes: ['id', 'name', 'temperature', 'capacity', 'status']
                },
                {
                    model: Stock,
                    required: false, // LEFT JOIN to include stores even without stocks
                    attributes: ['id', 'itemId', 'availableQty', 'weight', 'status'],
                    include: [
                        {
                            model: Item,
                            attributes: ['id', 'name', 'unit', 'categoryId']
                        }
                    ]
                }
            ],
            order: [['name', 'ASC']] // Order by store name
        });

        // Format response to include creator/updater usernames, cold rooms, and stocks
        const result = stores.map(store => {
            const obj = store.toJSON();
            
            // Add creator and updater information
            obj.createdByUsername = obj.Creator ? obj.Creator.username : null;
            obj.updatedByUsername = obj.Updater ? obj.Updater.username : null;
            
            // Format location information
            obj.location = obj.Location ? {
                id: obj.Location.id,
                name: obj.Location.name,
                address: obj.Location.address,
                city: obj.Location.city
            } : null;
            
            // Format cold rooms
            obj.coldRooms = (obj.ColdRooms || []).map(coldRoom => ({
                id: coldRoom.id,
                name: coldRoom.name,
                temperature: coldRoom.temperature,
                capacity: coldRoom.capacity,
                status: coldRoom.status
            }));

            // Format stocks with available quantities and item details
            obj.stocks = (obj.Stocks || []).map(stock => ({
                id: stock.id,
                itemId: stock.itemId,
                itemName: stock.Item ? stock.Item.name : null,
                itemUnit: stock.Item ? stock.Item.unit : null,
                itemCategoryId: stock.Item ? stock.Item.categoryId : null,
                availableQty: stock.availableQty,
                weight: stock.weight,
                status: stock.status
            }));

            // Calculate summary statistics
            obj.summary = {
                totalColdRooms: obj.coldRooms.length,
                totalStockItems: obj.stocks.length,
                totalAvailableQty: obj.stocks.reduce((sum, stock) => sum + (stock.availableQty || 0), 0),
                totalWeight: obj.stocks.reduce((sum, stock) => sum + (stock.weight || 0), 0),
                capacityUtilization: obj.capacity > 0 ? 
                    ((obj.stocks.reduce((sum, stock) => sum + (stock.availableQty || 0), 0) / obj.capacity) * 100).toFixed(2) : 0
            };

            // Clean up the response
            delete obj.Creator;
            delete obj.Updater;
            delete obj.Location;
            delete obj.ColdRooms;
            delete obj.Stocks;
            
            return obj;
        });

        res.json({
            success: true,
            message: `Found ${result.length} store(s) in location: ${location.name}`,
            locationInfo: {
                id: location.id,
                name: location.name,
                address: location.address,
                city: location.city
            },
            data: result
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching stores by location',
            error: error.message 
        });
    }
};

// Delete a store
exports.deleteStore = async (req, res) => {
    try {
        const store = await Store.findByPk(req.params.id);
        if (!store) return res.status(404).json({ error: 'Store not found' });
        await store.destroy();
        res.json({ message: 'Store deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
