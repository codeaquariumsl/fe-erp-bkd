const DeliveryOrder = require('../models/deliveryOrder');
const DeliveryOrderItem = require('../models/deliveryOrderItem');
const DeliveryOrderSummaryItem = require('../models/deliveryOrderSummaryItem');
const SalesOrder = require('../models/salesOrder');
const SalesOrderItem = require('../models/salesOrderItem');
const Driver = require('../models/driver');
const Route = require('../models/route');
const Vehicle = require('../models/vehicle');
const Item = require('../models/item');
const { sequelize, GRNItem, Category, GRN, Batch, User } = require('../models');
const { Op } = require('sequelize');
const { generateDocumentNumber } = require('./documentControllerClient');
const Customer = require('../models/customer');
const {
    calculateEffectiveAvailableQty,
    getEffectiveAvailableQtyCondition,
    reserveGrnItemQty,
    releaseGrnItemQty,
    bulkReserveGrnItemQty
} = require('../utils/grnReservationHelper');

// Create Delivery Order (with items, linked to SalesOrder)
exports.createDeliveryOrder = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        // Generate order number if not provided
        const { salesOrderId, items, locationId } = req.body;
        let orderNumber = await generateDocumentNumber('DO', locationId);
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }
        const salesOrder = await SalesOrder.findByPk(salesOrderId);
        if (!salesOrder) {
            await t.rollback();
            return res.status(400).json({ error: 'Sales Order not found' });
        }
        const deliveryOrder = await DeliveryOrder.create({ doNumber: orderNumber, salesOrderId, status: 'Pending', createdBy: currentUserId, updatedBy: currentUserId }, { transaction: t });
        if (Array.isArray(items)) {
            for (const item of items) {
                await DeliveryOrderItem.create({
                    deliveryOrderId: deliveryOrder.id,
                    itemId: item.itemId,
                    qty: item.qty
                }, { transaction: t });
            }
        }
        await t.commit();
        const result = await DeliveryOrder.findByPk(deliveryOrder.id, {
            include: [
                { model: SalesOrder },
                { model: DeliveryOrderItem, include: [Item] }
            ]
        });
        res.status(201).json(result);
    } catch (error) {
        await t.rollback();
        res.status(400).json({ error: error.message });
    }
};

// List all Delivery Orders
exports.getAllDeliveryOrders = async (req, res) => {
    try {
        const { BatchItem, Batch } = require('../models');
        const {
            page = 1,
            limit = 10,
            locationId,
            search,
            status,
            customerId,
            driverId,
            routeId,
            date
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        const where = {
            locationId: locationId || { [Op.ne]: null }
        };

        if (status && status !== '__all__') {
            where.status = status;
        }

        if (driverId && driverId !== '__all__') {
            where.driverId = driverId;
        }

        if (routeId && routeId !== '__all__') {
            where.routeId = routeId;
        }

        if (date) {
            where.orderDate = {
                [Op.gte]: new Date(date),
                [Op.lt]: new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000)
            };
        }

        if (customerId && customerId !== '__all__') {
            where.customerId = customerId;
        }

        const include = [
            {
                model: SalesOrder,
                include: [
                    Customer,
                    { model: User, as: 'SalesPerson', attributes: ['id', 'fullName', 'mobile'] },
                ]
            },
            { model: Driver },
            { model: Route },
            { model: Vehicle },
            {
                model: DeliveryOrderItem,
                include: [
                    Item,
                    Batch,
                    { model: require('../models/store'), as: 'ReleaseStore', attributes: ['id', 'name'] }
                ]
            }
        ];

        if (search) {
            // Pre-fetch customer and driver IDs matching the search name to avoid complex joins and subquery issues
            const [matchingCustomers, matchingDrivers] = await Promise.all([
                Customer.findAll({
                    where: { name: { [Op.like]: `%${search}%` } },
                    attributes: ['id'],
                    raw: true
                }),
                Driver.findAll({
                    where: { name: { [Op.like]: `%${search}%` } },
                    attributes: ['id'],
                    raw: true
                })
            ]);

            const customerIdsByName = matchingCustomers.map(c => c.id);
            const driverIdsByName = matchingDrivers.map(d => d.id);

            where[Op.or] = [
                { doNumber: { [Op.like]: `%${search}%` } },
                { status: { [Op.like]: `%${search}%` } },
                { customerId: { [Op.in]: customerIdsByName } },
                { driverId: { [Op.in]: driverIdsByName } }
            ];
        }

        const { count, rows: orders } = await DeliveryOrder.findAndCountAll({
            where,
            include,
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset),
            distinct: true
        });

        // For each delivery order, check batch availability for each item
        const ordersWithBatchInfo = await Promise.all(orders.map(async (order) => {
            const orderData = order.toJSON();

            // Process each delivery order item
            if (orderData.DeliveryOrderItems && orderData.DeliveryOrderItems.length > 0) {
                orderData.DeliveryOrderItems = await Promise.all(
                    orderData.DeliveryOrderItems.map(async (doItem) => {
                        try {
                            // Find all available batches for this item
                            const batchItems = await BatchItem.findAll({
                                where: {
                                    itemId: doItem.itemId,
                                    isActive: true,
                                    availableQuantity: { [Op.gt]: 0 },
                                    ...(order.locationId && { locationId: order.locationId }),
                                    ...(order.storeId && { storeId: order.storeId })
                                },
                                include: [
                                    {
                                        model: Batch,
                                        as: 'Batch',
                                        attributes: ['id', 'batchNumber', 'expireDate'],
                                        include: [
                                            { model: GRN, as: 'GRN', attributes: ['id', 'grnNumber'] }
                                        ]
                                    }
                                ],
                                order: [['Batch', 'expireDate', 'ASC']] // FIFO - First to expire first
                            });

                            // Calculate total available quantity across all batches
                            const totalAvailableQty = batchItems.reduce((sum, batchItem) => {
                                return sum + parseFloat(batchItem.availableQuantity || 0);
                            }, 0);

                            // Check if there's sufficient quantity
                            const requiredQty = parseFloat(doItem.qty || 0);
                            const hasSufficientStock = totalAvailableQty >= requiredQty;
                            const stockShortage = hasSufficientStock ? 0 : (requiredQty - totalAvailableQty);

                            // Add batch availability info to the delivery order item
                            return {
                                ...doItem,
                                batchAvailability: {
                                    totalAvailableQty,
                                    requiredQty,
                                    hasSufficientStock,
                                    stockShortage,
                                    batchCount: batchItems.length,
                                    batches: batchItems.map(bi => ({
                                        batchId: bi.Batch?.id,
                                        batchNumber: bi.Batch?.batchNumber,
                                        expireDate: bi.Batch?.expireDate,
                                        availableQuantity: bi.availableQuantity,
                                        grnNumber: bi.Batch?.GRN?.grnNumber
                                    }))
                                }
                            };
                        } catch (error) {
                            console.error(`Error checking batch availability for item ${doItem.itemId}:`, error);
                            return {
                                ...doItem,
                                batchAvailability: {
                                    error: error.message,
                                    totalAvailableQty: 0,
                                    requiredQty: parseFloat(doItem.qty || 0),
                                    hasSufficientStock: false,
                                    stockShortage: parseFloat(doItem.qty || 0),
                                    batchCount: 0,
                                    batches: []
                                }
                            };
                        }
                    })
                );

                // Add overall stock status for the delivery order
                const allItemsHaveSufficientStock = orderData.DeliveryOrderItems.every(
                    item => item.batchAvailability?.hasSufficientStock
                );
                orderData.stockStatus = {
                    allItemsAvailable: allItemsHaveSufficientStock,
                    itemsWithShortage: orderData.DeliveryOrderItems.filter(
                        item => !item.batchAvailability?.hasSufficientStock
                    ).length
                };
            }

            return orderData;
        }));

        const statusCounts = await DeliveryOrder.findAll({
            where: { locationId: where.locationId },
            attributes: [
                'status',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            group: ['status']
        });

        const summary = {
            total: 0,
            Pending: 0,
            Approved: 0,
            Scheduled: 0,
            'In Transit': 0,
            Delivered: 0,
            Dispatched: 0,
            Finalized: 0,
            Failed: 0
        };

        statusCounts.forEach(sc => {
            const status = sc.get('status');
            const count = parseInt(sc.get('count'));
            summary[status] = count;
            summary.total += count;
        });

        res.json({
            success: true,
            data: ordersWithBatchInfo,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / limit)
            },
            summary
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get a single Delivery Order by ID
exports.getDeliveryOrderById = async (req, res) => {
    try {
        const order = await DeliveryOrder.findByPk(req.params.id, {
            include: [
                { model: SalesOrder, include: [Customer] },
                { model: Driver },
                { model: Route },
                { model: Vehicle },
                {
                    model: DeliveryOrderItem,
                    include: [
                        Item,
                        Batch,
                        { model: require('../models/store'), as: 'ReleaseStore', attributes: ['id', 'name'] }
                    ]
                },
                {
                    model: DeliveryOrderSummaryItem,
                    as: 'SummaryItems',
                    where: { isActive: true },
                    required: false,
                    include: [
                        { model: Item, as: 'Item', attributes: ['id', 'name'] },
                        { model: GRN, as: 'GRN', attributes: ['id', 'grnNumber'] },
                        {
                            model: require('../models/store'),
                            as: 'ReleaseStore',
                            attributes: ['id', 'name'],
                            required: false
                        }
                    ]
                }
            ]
        });
        if (!order) return res.status(404).json({ error: 'Delivery Order not found, Get a single Delivery Order by ID' });
        res.json(order);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update Delivery Order (only if Pending)
exports.updateDeliveryOrder = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { items, ...deliveryOrderData } = req.body;
        const deliveryOrder = await DeliveryOrder.findByPk(req.params.id, { transaction: t });

        if (!deliveryOrder) {
            await t.rollback();
            return res.status(404).json({ error: 'Delivery Order not found' });
        }

        // Optional: Check if order is in a status that allows updates
        // if (deliveryOrder.status !== 'Pending') {
        //     await t.rollback();
        //     return res.status(400).json({ error: 'Only Pending Delivery Orders can be updated' });
        // }

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        // Update delivery order main fields
        await deliveryOrder.update({
            ...deliveryOrderData,
            updatedBy: currentUserId
        }, { transaction: t });

        // Handle delivery order items if provided
        if (Array.isArray(items)) {
            // Get existing items
            const existingItems = await DeliveryOrderItem.findAll({
                where: { deliveryOrderId: deliveryOrder.id },
                transaction: t
            });

            const existingItemIds = existingItems.map(item => item.id);
            const updatedItemIds = [];

            // Process each item from the request
            for (const item of items) {
                if (item.id) {
                    // Update existing item
                    const existingItem = existingItems.find(ei => ei.id === item.id);
                    if (existingItem) {
                        await existingItem.update({
                            itemId: item.itemId !== undefined ? item.itemId : existingItem.itemId,
                            qty: item.qty !== undefined ? item.qty : existingItem.qty,
                            batchId: item.batchId !== undefined ? item.batchId : existingItem.batchId,
                            storeId: item.storeId !== undefined ? item.storeId : existingItem.storeId,
                            acceptedQty: item.acceptedQty !== undefined ? item.acceptedQty : existingItem.acceptedQty,
                            rejectedQty: item.rejectedQty !== undefined ? item.rejectedQty : existingItem.rejectedQty,
                            damagedQty: item.damagedQty !== undefined ? item.damagedQty : existingItem.damagedQty,
                            weightDiffQty: item.weightDiffQty !== undefined ? item.weightDiffQty : existingItem.weightDiffQty
                        }, { transaction: t });
                        updatedItemIds.push(item.id);
                    }
                } else {
                    // Create new item
                    const newItem = await DeliveryOrderItem.create({
                        deliveryOrderId: deliveryOrder.id,
                        itemId: item.itemId,
                        qty: item.qty,
                        batchId: item.batchId || null,
                        storeId: item.storeId || null,
                        acceptedQty: item.acceptedQty || 0,
                        rejectedQty: item.rejectedQty || 0,
                        damagedQty: item.damagedQty || 0,
                        weightDiffQty: item.weightDiffQty || 0
                    }, { transaction: t });
                    updatedItemIds.push(newItem.id);
                }
            }

            // Delete items that are no longer in the request
            const itemsToDelete = existingItemIds.filter(id => !updatedItemIds.includes(id));
            if (itemsToDelete.length > 0) {
                await DeliveryOrderItem.destroy({
                    where: { id: itemsToDelete },
                    transaction: t
                });
            }
        }

        // Fetch updated delivery order with items BEFORE committing
        const updatedDeliveryOrder = await DeliveryOrder.findByPk(deliveryOrder.id, {
            include: [
                { model: SalesOrder, include: [Customer] },
                { model: Driver },
                { model: Route },
                { model: Vehicle },
                {
                    model: DeliveryOrderItem,
                    include: [
                        Item,
                        Batch,
                        { model: require('../models/store'), as: 'ReleaseStore', attributes: ['id', 'name'] }
                    ]
                }
            ],
            transaction: t
        });

        await t.commit();

        res.json(updatedDeliveryOrder);
    } catch (error) {
        // Only rollback if transaction hasn't been committed yet
        if (t && !t.finished) {
            await t.rollback();
        }
        res.status(400).json({ error: error.message });
    }
};

// Delete Delivery Order (only if Pending)
exports.deleteDeliveryOrder = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const order = await DeliveryOrder.findByPk(req.params.id, { transaction: t });
        if (!order) {
            await t.rollback();
            return res.status(404).json({ error: 'Delivery Order not found' });
        }
        if (order.status !== 'Pending') {
            await t.rollback();
            return res.status(400).json({ error: 'Only Pending Delivery Order can be deleted' });
        }
        await DeliveryOrderItem.destroy({ where: { deliveryOrderId: order.id }, transaction: t });
        await order.destroy({ transaction: t });
        await t.commit();
        res.json({ message: 'Delivery Order deleted' });
    } catch (error) {
        await t.rollback();
        res.status(400).json({ error: error.message });
    }
};

// Assign driver, route, vehicle, and store (only if Pending)
exports.assignDriverRouteVehicle = async (req, res) => {
    try {
        const { driverId, routeId, vehicleId, storeId } = req.body;
        const order = await DeliveryOrder.findByPk(req.params.id);
        if (!order) return res.status(404).json({ error: 'Delivery Order not found' });
        if (order.status !== 'Pending') return res.status(400).json({ error: 'Only Pending Delivery Order can be assigned' });
        await order.update({ driverId, routeId, vehicleId, storeId });
        res.json(order);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Approve or reject Delivery Order
exports.approveOrRejectDeliveryOrder = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { status, locationId } = req.body; // status: 'Scheduled' or 'Rejected'
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }
        const order = await DeliveryOrder.findByPk(req.params.id, { transaction: t });
        if (!order) {
            await t.rollback();
            return res.status(404).json({ error: 'Delivery Order not found' });
        }
        if (!['Approved', 'Rejected'].includes(status)) {
            await t.rollback();
            return res.status(400).json({ error: 'Invalid status. Must be Approved or Rejected.' });
        }
        await order.update({ status }, { transaction: t });
        if (status === 'Approved') {
            // Auto-create Invoice with DO items
            const Invoice = require('../models/invoice');
            const InvoiceItem = require('../models/invoiceItem');

            // Check if an invoice already exists for this delivery order
            const existingInvoice = await Invoice.findOne({
                where: { deliveryOrderId: order.id },
                transaction: t
            });

            if (existingInvoice) {
                await t.commit();
                return res.status(200).json({
                    message: `Delivery Order approved. Invoice ${existingInvoice.invoiceNumber} already exists.`,
                    order
                });
            }
            const doItems = await DeliveryOrderItem.findAll({ where: { deliveryOrderId: order.id }, transaction: t });
            const salesOrder = await SalesOrder.findByPk(order.salesOrderId, { transaction: t });
            const customerId = salesOrder ? salesOrder.customerId : null;
            let total = 0;
            let subTotal = 0;
            let taxAmount = 0;
            // Fetch prices and discounts from SalesOrderItem and item qty to calculate discounted totals
            const taxRateValue = (salesOrder.taxRate || 0) / 100;
            for (const item of doItems) {
                const soItem = await SalesOrderItem.findOne({ where: { salesOrderId: order.salesOrderId, itemId: item.itemId }, transaction: t });
                const price = soItem ? (soItem.price || 0) : 0;
                const discountPercentage = soItem ? (soItem.discount || 0) : 0;
                const isTaxItem = soItem ? soItem.isTaxItem : false;

                // Calculate discounted amount
                const discountedAmount = price * (discountPercentage / 100);
                // Calculate amount after discount
                const afterDiscount = price - discountedAmount;
                // Calculate excluding tax amount
                const excludingTaxAmount = isTaxItem ? afterDiscount / (1 + taxRateValue) : afterDiscount;
                // Calculate total (quantity * excluding tax amount)
                const itemTotal = item.qty * excludingTaxAmount;
                // Calculate tax for this item
                const taxForItem = itemTotal * taxRateValue;

                subTotal += itemTotal;
                if (isTaxItem) {
                    taxAmount += taxForItem;
                }
            }
            total = subTotal + taxAmount;
            const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
            const currentYearStr = String(new Date().getFullYear()).slice(2);
            const prefix = `${currentYearStr}${currentMonth}_CCPL_`;

            const lastRecord = await Invoice.findOne({
                where: {
                    invoiceNumber: {
                        [Op.like]: `${prefix}%`
                    }
                },
                order: [['id', 'DESC']],
                transaction: t
            });

            let nextNumber = '00001';
            if (lastRecord && lastRecord.invoiceNumber) {
                const parts = lastRecord.invoiceNumber.split('_');
                if (parts.length === 3) {
                    const lastNum = parseInt(parts[2], 10);
                    if (!isNaN(lastNum)) {
                        nextNumber = String(lastNum + 1).padStart(5, '0');
                    }
                }
            }
            const invoiceNumber = `${prefix}${nextNumber}`;
            const invoice = await Invoice.create({
                invoiceNumber,
                customerId,
                salesOrderId: order.salesOrderId,
                deliveryOrderId: order.id,
                invoiceDate: new Date(),
                locationId,
                subTotal: subTotal,
                isTaxInvoice: salesOrder.isTaxInvoice,
                taxRate: salesOrder.taxRate,
                taxAmount: taxAmount,
                total,
                idSalesPerson: salesOrder.idSalesPerson,
                status: 'Pending',
                createdBy: currentUserId,
            }, { transaction: t });
            for (const item of doItems) {
                const soItem = await SalesOrderItem.findOne({ where: { salesOrderId: order.salesOrderId, itemId: item.itemId }, transaction: t });
                const price = soItem ? (soItem.price || 0) : 0;
                const discountPercentage = soItem ? (soItem.discount || 0) : 0;
                const isTaxItem = soItem ? soItem.isTaxItem : false;

                // Calculate discounted amount
                const discountedAmount = price * (discountPercentage / 100);
                // Calculate amount after discount
                const afterDiscount = price - discountedAmount;
                // Calculate excluding tax amount
                const excludingTaxAmount = isTaxItem ? afterDiscount / (1 + taxRateValue) : afterDiscount;
                // Calculate total (quantity * excluding tax amount)
                const itemTotal = item.qty * excludingTaxAmount;

                await InvoiceItem.create({
                    invoiceId: invoice.id,
                    itemId: item.itemId,
                    code: soItem ? soItem.code : null,
                    qty: item.qty,
                    price: price,
                    discount: discountPercentage,
                    isTaxItem: isTaxItem,
                    discountedAmount: afterDiscount, // Matches frontend behavior of saving afterDiscount to discountedAmount
                    excludingTaxAmount: excludingTaxAmount,
                    total: itemTotal,
                    createdBy: currentUserId
                }, { transaction: t });
            }

            // Commit transaction before calling external function
            await t.commit();

            // Call createDeliveryOrderSummary function with orderIds
            // try {
            //     const deliveryOrderSummaryController = require('./deliveryOrderSummaryItemController');

            //     // Create a mock request object with the required data
            //     const mockReq = {
            //         body: {
            //             orderIds: [order.id],
            //             user: { id: currentUserId }
            //         },
            //         user: { id: currentUserId }
            //     };

            //     // Create a mock response object
            //     const mockRes = {
            //         status: (code) => ({
            //             json: (data) => {
            //                 console.log(`DeliveryOrderSummary response (${code}):`, data);
            //             }
            //         }),
            //         json: (data) => {
            //             console.log('DeliveryOrderSummary response:', data);
            //         }
            //     };

            //     // Call the createDeliveryOrderSummary function
            //     await deliveryOrderSummaryController.createDeliveryOrderSummary(mockReq, mockRes);

            // } catch (summaryError) {
            //     console.error('Error creating delivery order summary:', summaryError);
            //     // Don't fail the main approval process if summary creation fails
            // }

            // Return response after all operations
            return res.json({ message: `Delivery Order ${status.toLowerCase()}`, order });
        }

        // If not approved, commit the transaction and continue normally
        if (status !== 'Approved') {
            await t.commit();
        }

        res.json({ message: `Delivery Order ${status.toLowerCase()}`, order });
    } catch (error) {
        console.log(error);
        await t.rollback();
        res.status(400).json({ error: error.message });
    }
};

// Get all approved delivery orders for a driver
exports.getApprovedDeliveryOrdersByDriver = async (req, res) => {
    const Driver = require('../models/driver');
    const Route = require('../models/route');
    const Vehicle = require('../models/vehicle');
    const SalesOrder = require('../models/salesOrder');
    const DeliveryOrderItem = require('../models/deliveryOrderItem');
    const Item = require('../models/item');
    try {
        const orders = await DeliveryOrder.findAll({
            where: { driverId: req.params.driverId, status: 'Approved' },
            include: [
                { model: Driver },
                { model: Route },
                { model: Vehicle },
                { model: SalesOrder },
                { model: DeliveryOrderItem, include: [Item] },
                {
                    model: DeliveryOrderSummaryItem,
                    as: 'SummaryItems',
                    where: { isActive: true },
                    required: false,
                    include: [
                        { model: Item, as: 'Item', attributes: ['id', 'name'] },
                        { model: GRN, as: 'GRN', attributes: ['id', 'grnNumber'] },
                        {
                            model: require('../models/store'),
                            as: 'ReleaseStore',
                            attributes: ['id', 'name'],
                            required: false
                        }
                    ]
                }
            ],
            order: [['createdAt', 'DESC']]
        });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Confirm Delivery Order (set status to 'In Transit' and transfer stock)
exports.confirmDeliveryOrder = async (req, res) => {
    const { Stock, StockDetail } = require('../models');
    const t = await sequelize.transaction();
    try {
        const { deliveryOrderId } = req.body;
        if (!deliveryOrderId) {
            return res.status(400).json({ error: 'deliveryOrderId is required' });
        }
        const order = await DeliveryOrder.findByPk(deliveryOrderId, { transaction: t });
        if (!order) {
            await t.rollback();
            return res.status(404).json({ error: 'Delivery Order not found' });
        }
        if (order.status !== 'Scheduled') {
            await t.rollback();
            return res.status(400).json({ error: 'Only Scheduled Delivery Orders can be set to In Transit' });
        }
        // Get all items for this DO
        const doItems = await DeliveryOrderItem.findAll({ where: { deliveryOrderId }, transaction: t });
        // For each item, transfer stock from store to lorry
        for (const doItem of doItems) {
            // // 1. Deduct from store stock (use order.storeId, not routeId)
            // const storeStock = await Stock.findOne({
            //     where: { itemId: doItem.itemId, storeId: order.storeId, lorryId: null },
            //     transaction: t
            // });
            // if (!storeStock || storeStock.availableQty < doItem.qty) {
            //     await t.rollback();
            //     return res.status(400).json({ error: `Insufficient stock for item ${doItem.itemId}` });
            // }
            // storeStock.availableQty -= doItem.qty;
            // await storeStock.save({ transaction: t });
            // 2. Add to lorry stock (vehicleId)
            let lorryStock = await Stock.findOne({
                where: { itemId: doItem.itemId, lorryId: order.vehicleId, storeId: null },
                transaction: t
            });
            if (!lorryStock) {
                lorryStock = await Stock.create({
                    itemId: doItem.itemId,
                    lorryId: order.vehicleId,
                    storeId: null,
                    availableQty: 0,
                    status: 'Active',
                    createdBy: order.createdBy,
                }, { transaction: t });
            }
            lorryStock.availableQty += doItem.qty;
            await lorryStock.save({ transaction: t });
            // // 3. Log stock_details for both movements
            // await StockDetail.create({
            //     stockId: storeStock.id,
            //     documentType: 'Delivery',
            //     documentId: deliveryOrderId,
            //     inOut: 'OUT',
            //     qty: doItem.qty,
            //     date: new Date(),
            //     remark: `Delivery to lorry ${order.vehicleId}`
            // }, { transaction: t });
            await StockDetail.create({
                stockId: lorryStock.id,
                documentType: 'Delivery',
                documentId: deliveryOrderId,
                inOut: 'IN',
                qty: doItem.qty,
                date: new Date(),
                remark: `Received from store for delivery`,
                createdBy: order.createdBy,
            }, { transaction: t });
        }
        await order.update({ status: 'In Transit' }, { transaction: t });
        await t.commit();
        res.json({ message: 'Delivery Order status set to In Transit and stock transferred', order });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ error: error.message });
    }
};

// Update DeliveryOrderItem model to store delivery result scenario
// (If not already present, add these fields: acceptedQty, rejectedQty, damagedQty, weightDiffQty)
// Finalize Delivery Order (driver marks accepted/rejected/damaged/weight diff)
exports.finalizeDeliveryOrder = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        console.log(req.body);

        const { deliveryOrderId, items } = req.body;
        if (!deliveryOrderId || !Array.isArray(items)) {
            return res.status(400).json({ error: 'deliveryOrderId and items[] required' });
        }
        const order = await DeliveryOrder.findByPk(deliveryOrderId, { transaction: t });
        if (!order) {
            await t.rollback();
            return res.status(404).json({ error: 'Delivery Order not found' });
        }
        if (order.status !== 'In Transit') {
            await t.rollback();
            return res.status(400).json({ error: 'Only In Transit Delivery Orders can be finalized' });
        }
        await order.update({ status: 'Finalized' }, { transaction: t });
        // For each item, update DO item with accepted/rejected/damaged/weight diff and set invoice item qty to acceptedQty
        const { Invoice, InvoiceItem } = require('../models');
        // Get invoice for this delivery order
        const invoice = await Invoice.findOne({ where: { deliveryOrderId }, transaction: t });
        if (!invoice) {
            await t.rollback();
            return res.status(404).json({ error: 'Invoice not found for this Delivery Order' });
        }
        let totalAmount = 0;
        for (const item of items) {
            const { itemId, acceptedQty = 0, rejectedQty = 0, damagedQty = 0, weightDiffQty = 0 } = item;
            await DeliveryOrderItem.update(
                { acceptedQty, rejectedQty, damagedQty, weightDiffQty },
                { where: { deliveryOrderId, itemId }, transaction: t }
            );
            // Update invoice item qty to acceptedQty (use invoiceId, not deliveryOrderId)
            const invoiceItem = await InvoiceItem.findOne({ where: { itemId, invoiceId: invoice.id }, transaction: t });
            await invoiceItem.update(
                { qty: acceptedQty, total: acceptedQty * invoiceItem.price },
                { where: { itemId, invoiceId: invoice.id }, transaction: t }
            );
            totalAmount += acceptedQty * invoiceItem.price;
        }
        await invoice.update({ total: totalAmount }, { transaction: t });
        await t.commit();
        console.log({ message: 'Delivery finalized, results stored on DeliveryOrderItems', deliveryOrderId });

        res.json({ message: 'Delivery finalized, results stored on DeliveryOrderItems', deliveryOrderId });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ error: error.message });
    }
};

// Confirm Delivery Order as Delivered (final stock and invoice approval)
exports.confirmDeliveredOrder = async (req, res) => {
    const { deliveryOrderId } = req.body;
    if (!deliveryOrderId) {
        return res.status(400).json({ error: 'deliveryOrderId is required' });
    }
    const { Stock, StockDetail, Invoice, InvoiceItem } = require('../models');
    const t = await sequelize.transaction();
    try {
        // 1. Get DO, items, and invoice
        const order = await DeliveryOrder.findByPk(deliveryOrderId, { transaction: t });
        if (!order) {
            await t.rollback();
            return res.status(404).json({ error: 'Delivery Order not found' });
        }
        if (order.status !== 'Dispatched') {
            await t.rollback();
            return res.status(400).json({ error: 'Only Dispatched Delivery Orders can be confirmed as Delivered' });
        }
        const doItems = await DeliveryOrderItem.findAll({ where: { deliveryOrderId }, transaction: t });
        // const invoice = await Invoice.findOne({ where: { deliveryOrderId }, transaction: t });
        // if (!invoice) {
        //     await t.rollback();
        //     return res.status(404).json({ error: 'Invoice not found for this Delivery Order' });
        // }
        // 2. For each item, manage lorry and store stocks based on accepted/rejected/damaged/weightDiff
        for (const doItem of doItems) {
            const { itemId, qty, acceptedQty = 0, rejectedQty = 0, damagedQty = 0, weightDiffQty = 0 } = doItem;
            let lorryStock = await Stock.findOne({ where: { itemId, lorryId: order.vehicleId, storeId: null }, transaction: t });
            if (lorryStock && qty > 0) {// qty is total qty of item
                lorryStock.availableQty -= qty;
                await lorryStock.save({ transaction: t });
                await StockDetail.create({
                    stockId: lorryStock.id,
                    documentType: 'Delivery-Delivered',
                    documentId: deliveryOrderId,
                    inOut: 'OUT',
                    qty: qty,
                    date: new Date(),
                    createdBy: order.createdBy,
                    remark: 'Delivered to customer'
                }, { transaction: t });
            }

            // a. Release acceptedQty from lorry stock
            // if (lorryStock && acceptedQty > 0) {
            //     lorryStock.availableQty -= acceptedQty;
            //     await lorryStock.save({ transaction: t });
            //     await StockDetail.create({
            //         stockId: lorryStock.id,
            //         documentType: 'Delivery-Delivered',
            //         documentId: deliveryOrderId,
            //         inOut: 'OUT',
            //         qty: acceptedQty,
            //         date: new Date(),
            //         createdBy: order.createdBy,
            //         remark: 'Delivered to customer'
            //     }, { transaction: t });
            // }
            // b. Move rejected/damaged/weightDiff back to lorry stock (as IN)
            // if (lorryStock && rejectedQty > 0) {
            //     // lorryStock.availableQty += rejectedQty;
            //     // await lorryStock.save({ transaction: t });
            //     await StockDetail.create({
            //         stockId: lorryStock.id,
            //         documentType: 'Delivery-Rejected',
            //         documentId: deliveryOrderId,
            //         inOut: 'IN',
            //         qty: rejectedQty,
            //         date: new Date(),
            //         createdBy: order.createdBy,
            //         remark: 'Rejected by customer (returned to lorry)'
            //     }, { transaction: t });
            // }
            // if (lorryStock && damagedQty > 0) {
            //     // lorryStock.availableQty += damagedQty;
            //     // await lorryStock.save({ transaction: t });
            //     await StockDetail.create({
            //         stockId: lorryStock.id,
            //         documentType: 'Delivery-Damaged',
            //         documentId: deliveryOrderId,
            //         inOut: 'IN',
            //         qty: damagedQty,
            //         date: new Date(),
            //         createdBy: order.createdBy,
            //         remark: 'Damaged during delivery (returned to lorry)'
            //     }, { transaction: t });
            // }
            // if (lorryStock && weightDiffQty > 0) {
            //     // lorryStock.availableQty += weightDiffQty;
            //     // await lorryStock.save({ transaction: t });
            //     await StockDetail.create({
            //         stockId: lorryStock.id,
            //         documentType: 'Delivery-WeightDiff',
            //         documentId: deliveryOrderId,
            //         inOut: 'IN',
            //         qty: weightDiffQty,
            //         date: new Date(),
            //         createdBy: order.createdBy,
            //         remark: 'Weight difference at delivery (returned to lorry)'
            //     }, { transaction: t });
            // }
        }
        // 3. Approve invoice
        // await invoice.update({ status: 'Approved' }, { transaction: t });
        // 4. Set DO status to Delivered
        await order.update({
            status: 'Delivered',
            deliveredDate: new Date(),
        }, { transaction: t });
        await t.commit();
        res.json({ message: 'Delivery Order confirmed as Delivered, stocks and invoice updated', deliveryOrderId });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ error: error.message });
    }
};

// Unload DO-assigned lorry stock balance (rejected/damaged/weightDiff) back to separate stores
exports.unloadDeliveryOrderLorryBalance = async (req, res) => {
    const { deliveryOrderId, unloads } = req.body; // unloads: [{ itemId, type, qty, storeId }], type: 'rejected'|'damaged'|'weightDiff'
    if (!deliveryOrderId || !Array.isArray(unloads)) {
        return res.status(400).json({ error: 'deliveryOrderId and unloads[] required' });
    }
    const { Stock, StockDetail, DeliveryOrder, DeliveryOrderItem } = require('../models');
    const t = await sequelize.transaction();
    try {
        const order = await DeliveryOrder.findByPk(deliveryOrderId, { transaction: t });
        if (!order) {
            await t.rollback();
            return res.status(404).json({ error: 'Delivery Order not found' });
        }
        for (const unload of unloads) {
            const { itemId, type, qty, storeId } = unload;
            if (!itemId || !qty || !storeId || !['rejected', 'damaged', 'weightDiff'].includes(type)) continue;
            // 1. Deduct from lorry stock
            let lorryStock = await Stock.findOne({ where: { itemId, lorryId: order.vehicleId, storeId: null }, transaction: t });
            if (!lorryStock || lorryStock.availableQty < qty) {
                await t.rollback();
                return res.status(400).json({ error: `Insufficient lorry stock for item ${itemId}` });
            }
            lorryStock.availableQty -= qty;
            await lorryStock.save({ transaction: t });
            await StockDetail.create({
                stockId: lorryStock.id,
                documentType: `Lorry-Unload-${type}`,
                documentId: deliveryOrderId,
                inOut: 'OUT',
                qty,
                date: new Date(),
                remark: `Unload ${type} from lorry ${order.vehicleId} to store ${storeId}`
            }, { transaction: t });
            // 2. Add to store stock
            let storeStock = await Stock.findOne({ where: { itemId, storeId, lorryId: null }, transaction: t });
            if (!storeStock) {
                storeStock = await Stock.create({
                    itemId,
                    storeId,
                    lorryId: null,
                    availableQty: 0,
                    status: 'Active'
                }, { transaction: t });
            }
            storeStock.availableQty += qty;
            await storeStock.save({ transaction: t });
            await StockDetail.create({
                stockId: storeStock.id,
                documentType: `Lorry-Unload-${type}`,
                documentId: deliveryOrderId,
                inOut: 'IN',
                qty,
                date: new Date(),
                remark: `Received ${type} from lorry ${order.vehicleId}`
            }, { transaction: t });
        }
        await t.commit();
        res.json({ message: 'Lorry stock balances unloaded to stores', deliveryOrderId });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ error: error.message });
    }
};

// GET: Lorry (vehicle) stock balances
exports.getLorryStockBalances = async (req, res) => {
    const { vehicleId } = req.query;
    if (!vehicleId) return res.status(400).json({ error: 'vehicleId required' });
    const { Stock, Item } = require('../models');
    try {
        const stocks = await Stock.findAll({
            where: { lorryId: vehicleId, storeId: null },
            include: [{ model: Item }]
        });
        res.json(stocks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// GET: Store stock balances
exports.getStoreStockBalances = async (req, res) => {
    const { storeId } = req.query;
    if (!storeId) return res.status(400).json({ error: 'storeId required' });
    const { Stock, Item } = require('../models');
    try {
        const stocks = await Stock.findAll({
            where: { storeId, lorryId: null },
            include: [{ model: Item }]
        });
        res.json(stocks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// GET: Delivery order stock trace (StockDetail)
exports.getDeliveryOrderStockTrace = async (req, res) => {
    const { deliveryOrderId } = req.query;
    if (!deliveryOrderId) return res.status(400).json({ error: 'deliveryOrderId required' });
    const { StockDetail, Stock, Item } = require('../models');
    try {
        const details = await StockDetail.findAll({
            where: { documentId: deliveryOrderId },
            include: [{ model: Stock, include: [Item] }],
            order: [['date', 'ASC']]
        });
        res.json(details);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// GET: Lorry unload history (by vehicle or delivery order)
exports.getLorryUnloadHistory = async (req, res) => {
    const { vehicleId, deliveryOrderId } = req.query;
    const { StockDetail, Stock, Item } = require('../models');
    const where = { documentType: { [Op.like]: 'Lorry-Unload%' } };
    if (vehicleId) where['$Stock.lorryId$'] = vehicleId;
    if (deliveryOrderId) where.documentId = deliveryOrderId;
    try {
        const details = await StockDetail.findAll({
            where,
            include: [{ model: Stock, include: [Item] }],
            order: [['date', 'ASC']]
        });
        res.json(details);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// GET: Delivery order item results
exports.getDeliveryOrderItemResults = async (req, res) => {
    const { deliveryOrderId } = req.query;
    if (!deliveryOrderId) return res.status(400).json({ error: 'deliveryOrderId required' });
    try {
        const deliveryOrder = await DeliveryOrder.findByPk(deliveryOrderId);
        if (!deliveryOrder) {
            return res.status(404).json({ error: 'Delivery Order not found' });
        }
        const items = await DeliveryOrderItem.findAll({
            where: { deliveryOrderId },
            include: [{ model: Item }]
        });
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// GET: Unload delivery order items for Delivered status delivery orders
exports.getUnloadDeliveryOrderItems = async (req, res) => {
    try {
        const { driverId, vehicleId, status = 'Delivered' } = req.query;

        // Build where clause for delivery orders
        const deliveryOrderWhere = { status };
        if (driverId) deliveryOrderWhere.driverId = driverId;
        if (vehicleId) deliveryOrderWhere.vehicleId = vehicleId;

        // Get delivered delivery orders with their items
        const deliveryOrders = await DeliveryOrder.findAll({
            where: deliveryOrderWhere,
            include: [
                {
                    model: Driver,
                    attributes: ['id', 'name', 'mobile']
                },
                {
                    model: Vehicle,
                    attributes: ['id', 'vehicleNumber', 'vehicleType']
                },
                {
                    model: Route,
                    attributes: ['id', 'routeName']
                },
                {
                    model: SalesOrder,
                    include: [{
                        model: Customer,
                        attributes: ['id', 'name', 'email']
                    }]
                },
                {
                    model: DeliveryOrderItem,
                    include: [{
                        model: Item,
                        attributes: ['id', 'name', 'sku', 'unit']
                    }]
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Transform the data to include unload-relevant information
        const unloadData = deliveryOrders.map(order => {
            const orderData = order.toJSON();

            // Calculate unloadable quantities for each item
            orderData.DeliveryOrderItems = orderData.DeliveryOrderItems.map(item => {
                const unloadableQty = (item.rejectedQty || 0) + (item.damagedQty || 0) + (item.weightDiffQty || 0);
                return {
                    ...item,
                    unloadableQty,
                    canUnload: unloadableQty > 0,
                    unloadDetails: {
                        rejectedQty: item.rejectedQty || 0,
                        damagedQty: item.damagedQty || 0,
                        weightDiffQty: item.weightDiffQty || 0,
                        acceptedQty: item.acceptedQty || 0,
                        originalQty: item.qty || 0
                    }
                };
            });

            // Calculate totals for the delivery order
            const totalUnloadableQty = orderData.DeliveryOrderItems.reduce((sum, item) => sum + item.unloadableQty, 0);
            const hasUnloadableItems = totalUnloadableQty > 0;

            return {
                ...orderData,
                totalUnloadableQty,
                hasUnloadableItems,
                unloadableItemsCount: orderData.DeliveryOrderItems.filter(item => item.canUnload).length,
                totalItemsCount: orderData.DeliveryOrderItems.length
            };
        });

        // Filter to only include delivery orders that have unloadable items
        const filteredUnloadData = unloadData.filter(order => order.hasUnloadableItems);

        // Calculate summary statistics
        const summary = {
            totalDeliveryOrders: filteredUnloadData.length,
            totalUnloadableItems: filteredUnloadData.reduce((sum, order) => sum + order.unloadableItemsCount, 0),
            totalUnloadableQty: filteredUnloadData.reduce((sum, order) => sum + order.totalUnloadableQty, 0),
            drivers: [...new Set(filteredUnloadData.map(order => order.Driver?.name).filter(Boolean))],
            vehicles: [...new Set(filteredUnloadData.map(order => order.Vehicle?.vehicleNumber).filter(Boolean))]
        };

        res.json({
            summary,
            deliveryOrders: filteredUnloadData,
            filter: { driverId, vehicleId, status }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// GET: Invoice and invoice items for a delivery order
exports.getDeliveryOrderInvoice = async (req, res) => {
    const { deliveryOrderId } = req.query;
    if (!deliveryOrderId) return res.status(400).json({ error: 'deliveryOrderId required' });
    const { Invoice, InvoiceItem, Item } = require('../models');
    try {
        const invoice = await Invoice.findOne({ where: { deliveryOrderId } });
        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
        const items = await InvoiceItem.findAll({ where: { invoiceId: invoice.id }, include: [Item] });
        res.json({ invoice, items });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get saved delivery order summary from database
exports.getSavedDeliveryOrderSummary = async (req, res) => {
    try {
        const { routeId, date } = req.body;
        const currentDate = date || new Date().toISOString().split('T')[0];

        // Build where clause for DeliveryOrderSummaryItem
        const summaryWhere = { isActive: true };
        if (routeId) summaryWhere.routeId = routeId;

        // Handle date filtering for full day range
        const startDate = new Date(currentDate);
        const endDate = new Date(currentDate);
        endDate.setDate(endDate.getDate() + 1); // Next day

        summaryWhere.summaryDate = {
            [Op.gte]: startDate,
            [Op.lt]: endDate
        };

        // Get summary items with all related data
        const summaryItems = await DeliveryOrderSummaryItem.findAll({
            where: summaryWhere,
            include: [
                {
                    model: DeliveryOrder,
                    as: 'DeliveryOrder',
                    include: [
                        { model: Route, attributes: ['id', 'routeName'] },
                        { model: Driver, attributes: ['id', 'name'] },
                        { model: Vehicle, attributes: ['id', 'vehicleNumber'] },
                        { model: SalesOrder, include: [{ model: Customer, attributes: ['id', 'name'] }] }
                    ]
                },
                {
                    model: DeliveryOrderItem,
                    as: 'DeliveryOrderItem'
                },
                {
                    model: Item,
                    as: 'Item',
                    include: [{ model: Category, attributes: ['id', 'name'] }]
                },
                {
                    model: GRN,
                    as: 'GRN',
                    attributes: ['id', 'grnNumber']
                }
            ],
            order: [
                ['routeId', 'ASC'],
                ['itemId', 'ASC'],
                ['id', 'ASC']
            ]
        });

        if (summaryItems.length === 0) {
            return res.json({
                message: 'No saved summary found for the given criteria',
                filter: { routeId, date: currentDate },
                items: []
            });
        }

        // Process summary data - group by itemId and deliveryOrderId
        const itemSummary = {};
        const deliveryOrderSummary = {};

        for (const summaryItem of summaryItems) {
            const itemId = summaryItem.itemId;
            const doId = summaryItem.deliveryOrderId;

            // Initialize item summary
            if (!itemSummary[itemId]) {
                itemSummary[itemId] = {
                    itemId: itemId,
                    itemName: summaryItem.Item ? summaryItem.Item.name : null,
                    category: summaryItem.Item?.Category ? {
                        id: summaryItem.Item.Category.id,
                        name: summaryItem.Item.Category.name
                    } : null,
                    totalWantedQty: 0,
                    totalAssignedQty: 0,
                    totalAvailableQty: 0,
                    assignedGrnItems: [],
                    grnList: [],
                    deliveryOrderItems: [],
                    routeId: summaryItem.routeId,
                    summaryDate: summaryItem.summaryDate,
                    lastUpdated: summaryItem.updatedAt
                };
            }

            // Initialize delivery order summary
            if (!deliveryOrderSummary[doId]) {
                deliveryOrderSummary[doId] = {
                    deliveryOrderId: doId,
                    doNumber: summaryItem.DeliveryOrder.doNumber,
                    status: summaryItem.DeliveryOrder.status,
                    driver: summaryItem.DeliveryOrder.Driver ? {
                        id: summaryItem.DeliveryOrder.Driver.id,
                        name: summaryItem.DeliveryOrder.Driver.name
                    } : null,
                    vehicle: summaryItem.DeliveryOrder.Vehicle ? {
                        id: summaryItem.DeliveryOrder.Vehicle.id,
                        vehicleNumber: summaryItem.DeliveryOrder.Vehicle.vehicleNumber
                    } : null,
                    customer: summaryItem.DeliveryOrder.SalesOrder?.Customer ? {
                        id: summaryItem.DeliveryOrder.SalesOrder.Customer.id,
                        name: summaryItem.DeliveryOrder.SalesOrder.Customer.name
                    } : null,
                    itemsCount: 0
                };
            }

            // Add GRN assignment to item summary
            const existingGrn = itemSummary[itemId].assignedGrnItems.find(g => g.grnId === summaryItem.grnId);
            if (existingGrn) {
                existingGrn.assignedQty += summaryItem.qty;
            } else {
                itemSummary[itemId].assignedGrnItems.push({
                    grnId: summaryItem.grnId,
                    grnNumber: summaryItem.GRN ? summaryItem.GRN.grnNumber : null,
                    assignedQty: summaryItem.qty,
                    availableQty: 0, // Will need to fetch from GRNItem if needed
                    isScheduled: false // Will need to determine if scheduled
                });
            }

            // Add delivery order item details
            const doItem = itemSummary[itemId].deliveryOrderItems.find(doi => doi.deliveryOrderItemId === summaryItem.deliveryOrderItemId);
            if (!doItem) {
                itemSummary[itemId].deliveryOrderItems.push({
                    deliveryOrderItemId: summaryItem.deliveryOrderItemId,
                    deliveryOrderId: summaryItem.deliveryOrderId,
                    doNumber: summaryItem.DeliveryOrder.doNumber,
                    originalQty: summaryItem.DeliveryOrderItem ? summaryItem.DeliveryOrderItem.qty : 0,
                    assignedQty: summaryItem.qty,
                    isReleased: summaryItem.isReleased,
                    releaseStoreId: summaryItem.releaseStoreId,
                    createdAt: summaryItem.createdAt,
                    updatedAt: summaryItem.updatedAt
                });
                deliveryOrderSummary[doId].itemsCount++;
            }

            // Update totals
            itemSummary[itemId].totalWantedQty = Math.max(itemSummary[itemId].totalWantedQty,
                summaryItem.DeliveryOrderItem ? summaryItem.DeliveryOrderItem.qty : 0);
            itemSummary[itemId].totalAssignedQty += summaryItem.qty;
        }

        // Calculate fulfillment status for each item
        for (const item of Object.values(itemSummary)) {
            item.canFulfill = item.totalAssignedQty >= item.totalWantedQty;
            item.shortageQty = Math.max(0, item.totalWantedQty - item.totalAssignedQty);
        }

        // Calculate overall summary
        const items = Object.values(itemSummary);
        const overallSummary = {
            totalItems: items.length,
            totalDeliveryOrders: Object.keys(deliveryOrderSummary).length,
            itemsCanFulfill: items.filter(item => item.canFulfill).length,
            itemsWithShortage: items.filter(item => !item.canFulfill).length,
            totalWantedQty: items.reduce((sum, item) => sum + item.totalWantedQty, 0),
            totalAssignedQty: items.reduce((sum, item) => sum + item.totalAssignedQty, 0),
            totalShortageQty: items.reduce((sum, item) => sum + item.shortageQty, 0),
            summaryDate: currentDate,
            hasSavedData: true
        };

        res.json({
            filter: { routeId, date: currentDate },
            summary: overallSummary,
            deliveryOrders: Object.values(deliveryOrderSummary),
            items: items
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Clear saved delivery order summary
exports.clearDeliveryOrderSummary = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { routeId, deliveryOrderIds, date } = req.body;
        const currentDate = date || new Date().toISOString().split('T')[0];

        // Handle date filtering for full day range
        const startDate = new Date(currentDate);
        const endDate = new Date(currentDate);
        endDate.setDate(endDate.getDate() + 1); // Next day

        let whereClause = {
            summaryDate: {
                [Op.gte]: startDate,
                [Op.lt]: endDate
            },
            isActive: true
        };

        if (deliveryOrderIds && Array.isArray(deliveryOrderIds)) {
            // Clear specific delivery orders
            whereClause.deliveryOrderId = { [Op.in]: deliveryOrderIds };
        } else if (routeId) {
            // Clear by route
            whereClause.routeId = routeId;
        } else {
            await t.rollback();
            return res.status(400).json({ error: 'Either routeId or deliveryOrderIds must be provided' });
        }

        // Get the summary items that will be deleted to release reservations
        const summaryItemsToDelete = await DeliveryOrderSummaryItem.findAll({
            where: whereClause,
            transaction: t
        });

        // Release GRN item reservations before deleting summary items
        if (summaryItemsToDelete.length > 0) {
            const reservationsToRelease = new Map(); // grnId -> total quantity to release

            // Calculate total quantities to release per GRN
            for (const summaryItem of summaryItemsToDelete) {
                const grnId = summaryItem.grnId;
                const qty = summaryItem.qty;

                if (reservationsToRelease.has(grnId)) {
                    reservationsToRelease.set(grnId, reservationsToRelease.get(grnId) + qty);
                } else {
                    reservationsToRelease.set(grnId, qty);
                }
            }

            // Release reservations from GRN items
            for (const [grnId, totalQtyToRelease] of reservationsToRelease) {
                // Find the GRN item for this specific GRN and item combination
                const summaryItemExample = summaryItemsToDelete.find(item => item.grnId === grnId);
                if (summaryItemExample) {
                    const grnItem = await GRNItem.findOne({
                        where: {
                            grnId: grnId,
                            itemId: summaryItemExample.itemId
                        },
                        transaction: t
                    });

                    if (grnItem && totalQtyToRelease > 0) {
                        // Release the reserved quantity
                        await releaseGrnItemQty(grnItem, totalQtyToRelease, t);
                        console.log(`Released ${totalQtyToRelease} units from GRN ${grnId}, Item ${summaryItemExample.itemId} for delivery order summary clearing`);
                    }
                }
            }
        }

        // Delete summary items from DeliveryOrderSummaryItem table
        const deletedCount = await DeliveryOrderSummaryItem.destroy({
            where: whereClause,
            transaction: t
        });

        await t.commit();

        res.json({
            message: 'Delivery order summary data cleared successfully',
            clearedItems: deletedCount,
            filter: { routeId, deliveryOrderIds, date: currentDate }
        });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ error: error.message });
    }
};

// Get all DeliveryOrderItems with summaryData by day and route
exports.getDeliveryOrderItemsWithSummary = async (req, res) => {
    try {
        const { routeId, date, status } = req.body;
        const currentDate = date || new Date().toISOString().split('T')[0];

        // Build where clause for DeliveryOrderSummaryItem
        const summaryWhere = { isActive: true };
        if (routeId) summaryWhere.routeId = routeId;

        // Handle date filtering for full day range
        const startDate = new Date(currentDate);
        const endDate = new Date(currentDate);
        endDate.setDate(endDate.getDate() + 1); // Next day

        summaryWhere.summaryDate = {
            [Op.gte]: startDate,
            [Op.lt]: endDate
        };

        // Build where clause for DeliveryOrder
        const deliveryOrderWhere = {};
        if (status) deliveryOrderWhere.status = status;

        // Get summary items with all related data
        const summaryItems = await DeliveryOrderSummaryItem.findAll({
            where: summaryWhere,
            include: [
                {
                    model: DeliveryOrder,
                    as: 'DeliveryOrder',
                    where: deliveryOrderWhere,
                    include: [
                        { model: Route, attributes: ['id', 'routeName'] },
                        { model: Driver, attributes: ['id', 'name'] },
                        { model: Vehicle, attributes: ['id', 'vehicleNumber'] },
                        { model: SalesOrder, include: [{ model: Customer, attributes: ['id', 'name'] }] }
                    ]
                },
                {
                    model: DeliveryOrderItem,
                    as: 'DeliveryOrderItem'
                },
                {
                    model: Item,
                    as: 'Item',
                    include: [{ model: Category, attributes: ['id', 'name'] }]
                },
                {
                    model: GRN,
                    as: 'GRN',
                    attributes: ['id', 'grnNumber']
                }
            ],
            order: [
                ['routeId', 'ASC'],
                ['itemId', 'ASC'],
                ['id', 'ASC']
            ]
        });

        if (summaryItems.length === 0) {
            return res.json({
                message: 'No delivery order items with summary data found for the given criteria',
                filter: { routeId, date: currentDate, status },
                summary: {
                    totalItems: 0,
                    totalDeliveryOrders: 0,
                    routesCount: 0
                },
                items: []
            });
        }

        // Process and organize the data - merge items by itemId and route
        const routeSummary = {};
        const deliveryOrderSummary = {};
        const itemSummary = {}; // Merge items by itemId to avoid duplicates

        for (const summaryItem of summaryItems) {
            const route = summaryItem.DeliveryOrder.Route;
            const routeId = route ? route.id : 'unassigned';
            const routeName = route ? route.routeName : 'Unassigned';
            const itemId = summaryItem.itemId;

            // Initialize route summary
            if (!routeSummary[routeId]) {
                routeSummary[routeId] = {
                    routeId: routeId,
                    routeName: routeName,
                    routeCode: route ? route.routeName : null,
                    totalItems: 0,
                    deliveryOrders: [],
                    items: []
                };
            }

            // Track delivery orders
            const doId = summaryItem.deliveryOrderId;
            if (!deliveryOrderSummary[doId]) {
                deliveryOrderSummary[doId] = {
                    deliveryOrderId: doId,
                    doNumber: summaryItem.DeliveryOrder.doNumber,
                    status: summaryItem.DeliveryOrder.status,
                    driver: summaryItem.DeliveryOrder.Driver ? {
                        id: summaryItem.DeliveryOrder.Driver.id,
                        name: summaryItem.DeliveryOrder.Driver.name
                    } : null,
                    vehicle: summaryItem.DeliveryOrder.Vehicle ? {
                        id: summaryItem.DeliveryOrder.Vehicle.id,
                        vehicleNumber: summaryItem.DeliveryOrder.Vehicle.vehicleNumber
                    } : null,
                    customer: summaryItem.DeliveryOrder.SalesOrder?.Customer ? {
                        id: summaryItem.DeliveryOrder.SalesOrder.Customer.id,
                        name: summaryItem.DeliveryOrder.SalesOrder.Customer.name
                    } : null,
                    itemsCount: 0
                };
                routeSummary[routeId].deliveryOrders.push(deliveryOrderSummary[doId]);
            }

            deliveryOrderSummary[doId].itemsCount++;

            // Merge items by itemId
            if (!itemSummary[itemId]) {
                itemSummary[itemId] = {
                    itemId: itemId,
                    itemName: summaryItem.Item ? summaryItem.Item.name : null,
                    category: summaryItem.Item?.Category ? {
                        id: summaryItem.Item.Category.id,
                        name: summaryItem.Item.Category.name
                    } : null,
                    totalWantedQty: 0,
                    totalAssignedQty: 0,
                    assignedGrnItems: [],
                    deliveryOrderItems: [],
                    routeId: routeId,
                    summaryDate: summaryItem.summaryDate,
                    summaryUpdatedAt: summaryItem.updatedAt
                };
            }

            // Add GRN assignment to item summary
            const existingGrn = itemSummary[itemId].assignedGrnItems.find(g => g.grnId === summaryItem.grnId);
            if (existingGrn) {
                existingGrn.assignedQty += summaryItem.qty;
            } else {
                itemSummary[itemId].assignedGrnItems.push({
                    grnId: summaryItem.grnId,
                    grnNumber: summaryItem.GRN ? summaryItem.GRN.grnNumber : null,
                    assignedQty: summaryItem.qty,
                    isReleased: summaryItem.isReleased,
                    releaseStoreId: summaryItem.releaseStoreId
                });
            }

            // Add delivery order item details to the merged item
            const existingDoItem = itemSummary[itemId].deliveryOrderItems.find(doi => doi.deliveryOrderItemId === summaryItem.deliveryOrderItemId);
            if (!existingDoItem) {
                itemSummary[itemId].deliveryOrderItems.push({
                    deliveryOrderItemId: summaryItem.deliveryOrderItemId,
                    deliveryOrderId: summaryItem.deliveryOrderId,
                    doNumber: summaryItem.DeliveryOrder.doNumber,
                    originalQty: summaryItem.DeliveryOrderItem ? summaryItem.DeliveryOrderItem.qty : 0,
                    assignedQty: summaryItem.qty,
                    isReleased: summaryItem.isReleased,
                    releaseStoreId: summaryItem.releaseStoreId,
                    createdAt: summaryItem.createdAt,
                    updatedAt: summaryItem.updatedAt
                });
            }

            // Update totals
            itemSummary[itemId].totalWantedQty = Math.max(itemSummary[itemId].totalWantedQty,
                summaryItem.DeliveryOrderItem ? summaryItem.DeliveryOrderItem.qty : 0);
            itemSummary[itemId].totalAssignedQty += summaryItem.qty;

            // Add merged item to route summary if not already added
            const existingItem = routeSummary[routeId].items.find(item => item.itemId === itemId);
            if (!existingItem) {
                routeSummary[routeId].items.push(itemSummary[itemId]);
                routeSummary[routeId].totalItems++;
            }
        }

        // Calculate fulfillment status for each item
        for (const item of Object.values(itemSummary)) {
            item.canFulfill = item.totalAssignedQty >= item.totalWantedQty;
            item.shortageQty = Math.max(0, item.totalWantedQty - item.totalAssignedQty);
        }

        // Calculate overall summary using merged items
        const mergedItems = Object.values(itemSummary);
        const overallSummary = {
            totalItems: mergedItems.length,
            totalDeliveryOrders: Object.keys(deliveryOrderSummary).length,
            routesCount: Object.keys(routeSummary).length,
            itemsCanFulfill: mergedItems.filter(item => item.canFulfill).length,
            itemsWithShortage: mergedItems.filter(item => !item.canFulfill).length,
            totalWantedQty: mergedItems.reduce((sum, item) => sum + (item.totalWantedQty || 0), 0),
            totalAssignedQty: mergedItems.reduce((sum, item) => sum + (item.totalAssignedQty || 0), 0),
            totalShortageQty: mergedItems.reduce((sum, item) => sum + (item.shortageQty || 0), 0)
        };

        res.json({
            filter: { routeId, date: currentDate, status },
            summary: overallSummary,
            routes: Object.values(routeSummary),
            items: mergedItems.map(item => ({
                itemId: item.itemId,
                itemName: item.itemName,
                category: item.category,
                totalWantedQty: item.totalWantedQty,
                totalAssignedQty: item.totalAssignedQty,
                canFulfill: item.canFulfill,
                shortageQty: item.shortageQty,
                assignedGrnItems: item.assignedGrnItems,
                summaryDate: item.summaryDate,
                summaryUpdatedAt: item.summaryUpdatedAt,
                deliveryOrderItems: item.deliveryOrderItems,
                routeId: item.routeId
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
