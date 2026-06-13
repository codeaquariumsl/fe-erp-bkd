const { ProductionOrder, ProductionOrderItem, Item, Batch, BOM, BOMItem, Location, User, Category } = require('../models');
const { Op } = require('sequelize');

// Create a new production order
exports.createProductionOrder = async (req, res) => {
    try {
        const data = req.body;
        
        // Validate required fields
        if (!data.itemId || !data.bomId || !data.plannedQuantity || !data.locationId || !data.plannedStartDate) {
            return res.status(400).json({ 
                error: 'Item ID, BOM ID, planned quantity, location ID, and planned start date are required' 
            });
        }

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        // Validate item exists
        const item = await Item.findByPk(data.itemId);
        if (!item) {
            return res.status(400).json({ error: 'Item not found' });
        }

        // Validate BOM exists and is active
        const bom = await BOM.findByPk(data.bomId);
        if (!bom || !bom.isActive) {
            return res.status(400).json({ error: 'BOM not found or inactive' });
        }

        // Validate BOM is for the same item
        if (bom.itemId !== data.itemId) {
            return res.status(400).json({ error: 'BOM is not for the specified item' });
        }

        // Validate location exists
        const location = await Location.findByPk(data.locationId);
        if (!location) {
            return res.status(400).json({ error: 'Location not found' });
        }

        // Validate batch if provided
        if (data.batchId) {
            const batch = await Batch.findByPk(data.batchId);
            if (!batch || !batch.isActive) {
                return res.status(400).json({ error: 'Batch not found or inactive' });
            }
        }

        // Validate quantities
        if (data.plannedQuantity <= 0) {
            return res.status(400).json({ error: 'Planned quantity must be greater than 0' });
        }

        if (data.produceQuantity !== undefined && data.produceQuantity < 0) {
            return res.status(400).json({ error: 'Produce quantity must be non-negative' });
        }

        if (data.wastageQuantity !== undefined && data.wastageQuantity < 0) {
            return res.status(400).json({ error: 'Wastage quantity must be non-negative' });
        }

        // Generate production order code if not provided
        if (!data.code) {
            const date = new Date(data.plannedStartDate);
            const dateString = date.toISOString().slice(0, 10).replace(/-/g, '');
            const orderCount = await ProductionOrder.count({
                where: {
                    date: {
                        [Op.between]: [
                            new Date(date.getFullYear(), date.getMonth(), date.getDate()),
                            new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)
                        ]
                    }
                }
            });
            const sequence = (orderCount + 1).toString().padStart(3, '0');
            data.code = `PO-${dateString}-${sequence}`;
        }

        // Check if code is unique
        const existingOrder = await ProductionOrder.findOne({ where: { code: data.code } });
        if (existingOrder) {
            return res.status(400).json({ error: 'Production order code already exists' });
        }

        // Calculate estimated cost from BOM
        let estimatedCost = 0;
        if (bom.totalCost) {
            estimatedCost = parseFloat(bom.totalCost) * parseFloat(data.plannedQuantity);
        }

        const sequelize = require('../config/db');
        const transaction = await sequelize.transaction();
        
        try {
            const productionOrder = await ProductionOrder.create({
                ...data,
                date: data.plannedStartDate || new Date(),
                estimatedCost: data.estimatedCost || estimatedCost,
                createdBy: currentUserId,
                updatedBy: currentUserId
            }, { transaction });

            // Create production order items if provided
            if (data.productionOrderItems && Array.isArray(data.productionOrderItems)) {
                for (let i = 0; i < data.productionOrderItems.length; i++) {
                    const itemData = data.productionOrderItems[i];
                    
                    // Validate required fields for production order item
                    if (!itemData.itemId || !itemData.quantity) {
                        await transaction.rollback();
                        return res.status(400).json({ 
                            error: `Production order item at index ${i} is missing required fields (itemId, quantity)` 
                        });
                    }
                    
                    // Validate item exists
                    const itemExists = await Item.findByPk(itemData.itemId, { transaction });
                    if (!itemExists) {
                        await transaction.rollback();
                        return res.status(400).json({ 
                            error: `Item with ID ${itemData.itemId} not found for production order item at index ${i}` 
                        });
                    }
                    
                    // Calculate total cost if unit cost is provided
                    let totalCost = 0;
                    if (itemData.cost && itemData.quantity) {
                        totalCost = parseFloat(itemData.cost) * parseFloat(itemData.quantity);
                    }
                    
                    await ProductionOrderItem.create({
                        productionOrderId: productionOrder.id,
                        bomId: itemData.bomId || null,
                        itemId: itemData.itemId,
                        quantity: itemData.quantity,
                        unit: itemData.unit || null,
                        cost: itemData.cost || 0,
                        totalCost: itemData.totalCost || totalCost,
                        remark: itemData.remark || null,
                        sequence: itemData.sequence || (i + 1),
                        wastageQuantity: itemData.wastageQuantity || 0,
                        status: itemData.status || 'pending',
                        isActive: itemData.isActive !== undefined ? itemData.isActive : true,
                        createdBy: currentUserId,
                        updatedBy: currentUserId
                    }, { transaction });
                }
            }

            await transaction.commit();

                // Fetch the created production order with associations
            const createdOrder = await ProductionOrder.findByPk(productionOrder.id, {
                include: [
                    { 
                        model: Item, 
                        as: 'Item',
                        include: [
                            { model: Category, attributes: ['id', 'name'] }
                        ]
                    },
                    { 
                        model: BOM, 
                        as: 'BOM', 
                        attributes: ['id', 'name', 'version', 'totalCost'],
                        include: [
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
                    },
                    {
                        model: ProductionOrderItem,
                        as: 'ProductionOrderItems',
                        where: { isActive: true },
                        required: false,
                        include: [
                            { model: Item, as: 'Item', attributes: ['id', 'name', 'sku'] },
                            { model: BOM, as: 'BOM', attributes: ['id', 'name'] }
                        ]
                    },
                    { model: Batch, as: 'Batch', attributes: ['id', 'batchNumber'] },
                    { model: Location, as: 'Location', attributes: ['id', 'name'] },
                    { model: User, as: 'Creator', attributes: ['id', 'username'] }
                ]
            });

            res.status(201).json(createdOrder);
        } catch (transactionError) {
            await transaction.rollback();
            throw transactionError;
        }
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get all production orders with filtering and pagination
exports.getProductionOrders = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            itemId, 
            bomId,
            batchId,
            locationId, 
            status,
            priority,
            dateFrom,
            dateTo,
            isActive,
            sortBy = 'date',
            sortOrder = 'DESC'
        } = req.query;

        const offset = (page - 1) * limit;
        const whereConditions = {};

        // Apply filters
        if (itemId) whereConditions.itemId = itemId;
        if (bomId) whereConditions.bomId = bomId;
        if (batchId) whereConditions.batchId = batchId;
        if (locationId) whereConditions.locationId = locationId;
        if (status) whereConditions.status = status;
        if (priority) whereConditions.priority = priority;
        if (isActive !== undefined) whereConditions.isActive = isActive === 'true';

        // Date range filter
        if (dateFrom || dateTo) {
            whereConditions.date = {};
            if (dateFrom) whereConditions.date[Op.gte] = new Date(dateFrom);
            if (dateTo) whereConditions.date[Op.lte] = new Date(dateTo);
        }

        const { count, rows: orders } = await ProductionOrder.findAndCountAll({
            where: whereConditions,
            include: [
                { 
                    model: Item, 
                    as: 'Item',
                    include: [
                        { model: Category, attributes: ['id', 'name'] }
                    ]
                },
                { 
                    model: BOM, 
                    as: 'BOM', 
                    attributes: ['id', 'name', 'version', 'totalCost']
                },
                {
                    model: ProductionOrderItem,
                    as: 'ProductionOrderItems',
                    where: { isActive: true },
                    required: false,
                    include: [
                        { model: Item, as: 'Item', attributes: ['id', 'name', 'sku'] },
                        { model: BOM, as: 'BOM', attributes: ['id', 'name'] }
                    ],
                    order: [['sequence', 'ASC']]
                },
                { model: Batch, as: 'Batch', attributes: ['id', 'batchNumber'] },
                { model: Location, as: 'Location', attributes: ['id', 'name'] },
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] }
            ],
            order: [[sortBy, sortOrder.toUpperCase()]],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        const totalPages = Math.ceil(count / limit);

        res.json({
            productionOrders: orders,
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

// Get a specific production order by ID
exports.getProductionOrderById = async (req, res) => {
    try {
        const { id } = req.params;

        const order = await ProductionOrder.findByPk(id, {
            include: [
                { 
                    model: Item, 
                    as: 'Item',
                    include: [
                        { model: Category, attributes: ['id', 'name'] }
                    ]
                },
                { 
                    model: BOM, 
                    as: 'BOM',
                    include: [
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
                },
                {
                    model: ProductionOrderItem,
                    as: 'ProductionOrderItems',
                    where: { isActive: true },
                    required: false,
                    include: [
                        { 
                            model: Item, 
                            as: 'Item',
                            include: [
                                { model: Category, attributes: ['id', 'name'] }
                            ]
                        },
                        { model: BOM, as: 'BOM', attributes: ['id', 'name'] }
                    ],
                    order: [['sequence', 'ASC']]
                },
                { model: Batch, as: 'Batch' },
                { model: Location, as: 'Location' },
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] }
            ]
        });

        if (!order) {
            return res.status(404).json({ error: 'Production order not found' });
        }

        res.json(order);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update a production order
exports.updateProductionOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.body;

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const order = await ProductionOrder.findByPk(id);
        if (!order) {
            return res.status(404).json({ error: 'Production order not found' });
        }

        // Validate quantities if being updated
        if (data.plannedQuantity !== undefined && data.plannedQuantity <= 0) {
            return res.status(400).json({ error: 'Planned quantity must be greater than 0' });
        }

        if (data.produceQuantity !== undefined && data.produceQuantity < 0) {
            return res.status(400).json({ error: 'Produce quantity must be non-negative' });
        }

        if (data.wastageQuantity !== undefined && data.wastageQuantity < 0) {
            return res.status(400).json({ error: 'Wastage quantity must be non-negative' });
        }

        // Auto-update status based on quantities
        let updatedData = { ...data };
        if (data.produceQuantity !== undefined) {
            const plannedQty = data.plannedQuantity || order.plannedQuantity;
            const produceQty = data.produceQuantity;
            
            if (produceQty > 0 && produceQty < plannedQty && order.status === 'planned') {
                updatedData.status = 'in_progress';
            } else if (produceQty >= plannedQty) {
                updatedData.status = 'completed';
                updatedData.endDate = updatedData.endDate || new Date();
            }
        }

        // Set start date when moving to in_progress
        if (data.status === 'in_progress' && order.status === 'planned') {
            updatedData.startDate = updatedData.startDate || new Date();
        }

        // Set end date when completing
        if (data.status === 'completed' && order.status !== 'completed') {
            updatedData.endDate = updatedData.endDate || new Date();
        }

        await order.update({
            ...updatedData,
            updatedBy: currentUserId
        });

        // Fetch updated production order with associations
        const updatedOrder = await ProductionOrder.findByPk(id, {
            include: [
                { 
                    model: Item, 
                    as: 'Item',
                    include: [
                        { model: Category, attributes: ['id', 'name'] }
                    ]
                },
                { model: BOM, as: 'BOM', attributes: ['id', 'name', 'version'] },
                {
                    model: ProductionOrderItem,
                    as: 'ProductionOrderItems',
                    where: { isActive: true },
                    required: false,
                    include: [
                        { model: Item, as: 'Item', attributes: ['id', 'name', 'sku'] },
                        { model: BOM, as: 'BOM', attributes: ['id', 'name'] }
                    ],
                    order: [['sequence', 'ASC']]
                },
                { model: Batch, as: 'Batch', attributes: ['id', 'batchNumber'] },
                { model: Location, as: 'Location', attributes: ['id', 'name'] },
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] }
            ]
        });

        res.json(updatedOrder);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Soft delete a production order
exports.deleteProductionOrder = async (req, res) => {
    try {
        const { id } = req.params;

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const order = await ProductionOrder.findByPk(id);
        if (!order) {
            return res.status(404).json({ error: 'Production order not found' });
        }

        // Check if order can be deleted based on status
        if (order.status === 'in_progress') {
            return res.status(400).json({ 
                error: 'Cannot delete production order that is in progress' 
            });
        }

        await order.update({
            isActive: false,
            status: 'cancelled',
            updatedBy: currentUserId
        });

        res.json({ message: 'Production order deleted successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Update production order status
exports.updateProductionOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const validStatuses = ['planned', 'in_progress', 'completed', 'cancelled', 'on_hold'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const order = await ProductionOrder.findByPk(id);
        if (!order) {
            return res.status(404).json({ error: 'Production order not found' });
        }

        const updateData = { status, updatedBy: currentUserId };
        
        // Add timestamps based on status changes
        if (status === 'in_progress' && order.status === 'planned') {
            updateData.startDate = new Date();
        } else if (status === 'completed' && order.status !== 'completed') {
            updateData.endDate = new Date();
        }

        if (notes) {
            updateData.notes = notes;
        }

        await order.update(updateData);

        const updatedOrder = await ProductionOrder.findByPk(id, {
            include: [
                { model: Item, as: 'Item', attributes: ['id', 'name', 'sku'] },
                { model: BOM, as: 'BOM', attributes: ['id', 'name', 'version'] },
                {
                    model: ProductionOrderItem,
                    as: 'ProductionOrderItems',
                    where: { isActive: true },
                    required: false,
                    include: [
                        { model: Item, as: 'Item', attributes: ['id', 'name', 'sku'] }
                    ],
                    order: [['sequence', 'ASC']]
                }
            ]
        });

        res.json(updatedOrder);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get production orders by status
exports.getProductionOrdersByStatus = async (req, res) => {
    try {
        const { status } = req.params;
        const { locationId, priority, limit = 50 } = req.query;

        const whereConditions = { 
            status: status,
            isActive: true
        };
        
        if (locationId) whereConditions.locationId = locationId;
        if (priority) whereConditions.priority = priority;

        const orders = await ProductionOrder.findAll({
            where: whereConditions,
            include: [
                { 
                    model: Item, 
                    as: 'Item',
                    include: [
                        { model: Category, attributes: ['id', 'name'] }
                    ]
                },
                { model: BOM, as: 'BOM', attributes: ['id', 'name', 'version'] },
                {
                    model: ProductionOrderItem,
                    as: 'ProductionOrderItems',
                    where: { isActive: true },
                    required: false,
                    include: [
                        { model: Item, as: 'Item', attributes: ['id', 'name', 'sku'] },
                        { model: BOM, as: 'BOM', attributes: ['id', 'name'] }
                    ],
                    order: [['sequence', 'ASC']]
                },
                { model: Batch, as: 'Batch', attributes: ['id', 'batchNumber'] },
                { model: Location, as: 'Location', attributes: ['id', 'name'] }
            ],
            order: [
                ['priority', 'DESC'],
                ['date', 'ASC']
            ],
            limit: parseInt(limit)
        });

        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get production dashboard summary
exports.getProductionDashboard = async (req, res) => {
    try {
        const { locationId, dateFrom, dateTo } = req.query;

        const whereConditions = { isActive: true };
        if (locationId) whereConditions.locationId = locationId;

        // Date range filter
        if (dateFrom || dateTo) {
            whereConditions.date = {};
            if (dateFrom) whereConditions.date[Op.gte] = new Date(dateFrom);
            if (dateTo) whereConditions.date[Op.lte] = new Date(dateTo);
        }

        // Get counts by status
        const statusCounts = await ProductionOrder.findAll({
            where: whereConditions,
            attributes: [
                'status',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            group: ['status']
        });

        // Get priority counts
        const priorityCounts = await ProductionOrder.findAll({
            where: { ...whereConditions, status: { [Op.in]: ['planned', 'in_progress'] } },
            attributes: [
                'priority',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            group: ['priority']
        });

        // Get recent orders
        const recentOrders = await ProductionOrder.findAll({
            where: whereConditions,
            include: [
                { model: Item, as: 'Item', attributes: ['id', 'name', 'sku'] },
                { model: BOM, as: 'BOM', attributes: ['id', 'name'] },
                {
                    model: ProductionOrderItem,
                    as: 'ProductionOrderItems',
                    where: { isActive: true },
                    required: false,
                    include: [
                        { model: Item, as: 'Item', attributes: ['id', 'name', 'sku'] }
                    ],
                    order: [['sequence', 'ASC']]
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: 10
        });

        // Calculate production efficiency
        const completedOrders = await ProductionOrder.findAll({
            where: { ...whereConditions, status: 'completed' }
        });

        let totalEfficiency = 0;
        let efficiencyCount = 0;
        
        completedOrders.forEach(order => {
            if (order.plannedQuantity > 0) {
                const efficiency = (order.produceQuantity / order.plannedQuantity) * 100;
                totalEfficiency += efficiency;
                efficiencyCount++;
            }
        });

        const averageEfficiency = efficiencyCount > 0 ? totalEfficiency / efficiencyCount : 0;

        res.json({
            statusCounts: statusCounts.reduce((acc, item) => {
                acc[item.status] = parseInt(item.dataValues.count);
                return acc;
            }, {}),
            priorityCounts: priorityCounts.reduce((acc, item) => {
                acc[item.priority] = parseInt(item.dataValues.count);
                return acc;
            }, {}),
            recentOrders,
            averageEfficiency: Math.round(averageEfficiency * 100) / 100,
            totalOrders: completedOrders.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Generate production order code
exports.generateProductionOrderCode = async (req, res) => {
    try {
        const { date } = req.body;
        
        if (!date) {
            return res.status(400).json({ error: 'Date is required' });
        }

        const orderDate = new Date(date);
        const dateString = orderDate.toISOString().slice(0, 10).replace(/-/g, '');
        
        const orderCount = await ProductionOrder.count({
            where: {
                date: {
                    [Op.between]: [
                        new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate()),
                        new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate(), 23, 59, 59)
                    ]
                }
            }
        });
        
        const sequence = (orderCount + 1).toString().padStart(3, '0');
        const code = `PO-${dateString}-${sequence}`;

        res.json({ code });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};