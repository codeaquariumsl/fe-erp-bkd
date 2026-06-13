const { ProductionConfig, Store, Location, User } = require('../models');
const { Op } = require('sequelize');

// Create a new production configuration
exports.createProductionConfig = async (req, res) => {
    try {
        const data = req.body;
        
        // Validate required fields
        if (!data.rawMaterialStoreId || !data.finishedGoodsStoreId || !data.locationId) {
            return res.status(400).json({ 
                error: 'Raw material store ID, finished goods store ID, and location ID are required' 
            });
        }

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        // Validate stores exist
        const rawMaterialStore = await Store.findByPk(data.rawMaterialStoreId);
        if (!rawMaterialStore) {
            return res.status(400).json({ error: 'Raw material store not found' });
        }

        const finishedGoodsStore = await Store.findByPk(data.finishedGoodsStoreId);
        if (!finishedGoodsStore) {
            return res.status(400).json({ error: 'Finished goods store not found' });
        }

        // Validate location exists
        const location = await Location.findByPk(data.locationId);
        if (!location) {
            return res.status(400).json({ error: 'Location not found' });
        }

        // Check if configuration already exists for this location
        const existingConfig = await ProductionConfig.findOne({ 
            where: { 
                locationId: data.locationId,
                isActive: true
            } 
        });
        if (existingConfig) {
            return res.status(400).json({ error: 'Active production configuration already exists for this location' });
        }

        const productionConfig = await ProductionConfig.create({
            ...data,
            outputStoreId: data.finishedGoodsStoreId, // Map finishedGoodsStoreId to outputStoreId in DB
            createdBy: currentUserId,
            updatedBy: currentUserId
        });

        // Fetch the created configuration with associations
        const createdConfig = await ProductionConfig.findByPk(productionConfig.id, {
            include: [
                { model: Store, as: 'RawMaterialStore', attributes: ['id', 'name'] },
                { model: Store, as: 'OutputStore', attributes: ['id', 'name'] },
                { model: Location, as: 'Location', attributes: ['id', 'name'] },
                { model: User, as: 'Creator', attributes: ['id', 'username'] }
            ]
        });

        res.status(201).json(createdConfig);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get all production configurations
exports.getProductionConfigs = async (req, res) => {
    try {
        const { locationId, isActive, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        const whereConditions = {};

        // Apply filters
        if (locationId) whereConditions.locationId = locationId;
        if (isActive !== undefined) whereConditions.isActive = isActive === 'true';

        const { count, rows: configs } = await ProductionConfig.findAndCountAll({
            where: whereConditions,
            include: [
                { model: Store, as: 'RawMaterialStore', attributes: ['id', 'name'] },
                { model: Store, as: 'OutputStore', attributes: ['id', 'name'] },
                { model: Location, as: 'Location', attributes: ['id', 'name'] },
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] }
            ],
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        const totalPages = Math.ceil(count / limit);

        res.json({
            productionConfigs: configs,
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

// Get a specific production configuration by ID
exports.getProductionConfigById = async (req, res) => {
    try {
        const { id } = req.params;

        const config = await ProductionConfig.findByPk(id, {
            include: [
                { model: Store, as: 'RawMaterialStore' },
                { model: Store, as: 'OutputStore' },
                { model: Location, as: 'Location' },
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] }
            ]
        });

        if (!config) {
            return res.status(404).json({ error: 'Production configuration not found' });
        }

        res.json(config);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update a production configuration
exports.updateProductionConfig = async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.body;

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const config = await ProductionConfig.findByPk(id);
        if (!config) {
            return res.status(404).json({ error: 'Production configuration not found' });
        }

        // Validate stores if being updated
        if (data.rawMaterialStoreId) {
            const rawMaterialStore = await Store.findByPk(data.rawMaterialStoreId);
            if (!rawMaterialStore) {
                return res.status(400).json({ error: 'Raw material store not found' });
            }
        }

        if (data.outputStoreId) {
            const outputStore = await Store.findByPk(data.outputStoreId);
            if (!outputStore) {
                return res.status(400).json({ error: 'Output store not found' });
            }
        }

        // Validate location if being updated
        if (data.locationId && data.locationId !== config.locationId) {
            const location = await Location.findByPk(data.locationId);
            if (!location) {
                return res.status(400).json({ error: 'Location not found' });
            }

            // Check if configuration already exists for new location
            const existingConfig = await ProductionConfig.findOne({ 
                where: { 
                    locationId: data.locationId,
                    isActive: true,
                    id: { [Op.ne]: id }
                } 
            });
            if (existingConfig) {
                return res.status(400).json({ error: 'Active production configuration already exists for this location' });
            }
        }

        await config.update({
            ...data,
            updatedBy: currentUserId
        });

        // Fetch updated configuration with associations
        const updatedConfig = await ProductionConfig.findByPk(id, {
            include: [
                { model: Store, as: 'RawMaterialStore', attributes: ['id', 'name'] },
                { model: Store, as: 'OutputStore', attributes: ['id', 'name'] },
                { model: Location, as: 'Location', attributes: ['id', 'name'] },
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] }
            ]
        });

        res.json(updatedConfig);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Soft delete a production configuration
exports.deleteProductionConfig = async (req, res) => {
    try {
        const { id } = req.params;

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const config = await ProductionConfig.findByPk(id);
        if (!config) {
            return res.status(404).json({ error: 'Production configuration not found' });
        }

        await config.update({
            isActive: false,
            updatedBy: currentUserId
        });

        res.json({ message: 'Production configuration deleted successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get production configuration by location
exports.getProductionConfigByLocation = async (req, res) => {
    try {
        const { locationId } = req.params;

        const config = await ProductionConfig.findOne({
            where: { 
                locationId: locationId,
                isActive: true
            },
            include: [
                { model: Store, as: 'RawMaterialStore' },
                { model: Store, as: 'OutputStore' },
                { model: Location, as: 'Location' },
                { model: User, as: 'Creator', attributes: ['id', 'username'] }
            ]
        });

        if (!config) {
            return res.status(404).json({ error: 'No active production configuration found for this location' });
        }

        res.json(config);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};