const SalesOrder = require('../models/salesOrder');
const SalesOrderItem = require('../models/salesOrderItem');
const Customer = require('../models/customer');
const Item = require('../models/item');
const Stock = require('../models/stock');
const StockDetail = require('../models/stockDetail');
const { sequelize, Route, DeliveryOrder, User, CustomerItemCode, Category, Location, Batch, BatchItem, CustomerCategoryDiscount } = require('../models');
const { generateDocumentNumber } = require('./documentControllerClient');
const { sendSalesOrderApprovedNotification } = require('../utils/smsService');
const { Op } = require('sequelize');

// Utility functions for discount calculations
const calculateDiscountedAmount = (qty, price, discount = 0) => {
    if (discount < 0 || discount > 100) {
        throw new Error(`Invalid discount ${discount}%. Discount must be between 0 and 100.`);
    }
    const baseAmount = qty * price;
    const discountAmount = (baseAmount * discount) / 100;
    return baseAmount - discountAmount;
};

const calculateItemTotals = (items) => {
    return items.reduce((totals, item) => {
        const discount = item.discount || 0;
        const baseAmount = item.qty * item.price;
        const discountAmount = (baseAmount * discount) / 100;
        const finalAmount = baseAmount - discountAmount;

        totals.baseAmount += baseAmount;
        totals.discountAmount += discountAmount;
        totals.finalAmount += finalAmount;

        return totals;
    }, { baseAmount: 0, discountAmount: 0, finalAmount: 0 });
};

// Create a new Sales Order with items
exports.createSalesOrder = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const {
            isAlreadyApproved = false,
            customerId,
            orderDate,
            routeId,
            idSalesPerson,
            isDelivery = false, // Default to false if not provided
            deliveryDate,
            dispatchDate = null,
            timeSlot = null,
            deliveryAddress,
            poNumber,
            items,
            subTotal,
            isTaxInvoice,
            taxRate,
            taxAmount,
            totalAmount,
            locationId = 1,
            totalWeight
        } = req.body;

        // Calculate total amount with discounts if items are provided
        let calculatedTotalAmount = totalAmount;
        if (Array.isArray(items) && items.length > 0) {
            const itemTotals = calculateItemTotals(items);
            calculatedTotalAmount = itemTotals.finalAmount;
        }
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }
        // Generate order number if not provided
        let orderNumber = await generateDocumentNumber('SO', locationId);

        // Always create as Pending, then approve if needed
        const salesOrder = await SalesOrder.create({
            orderNumber,
            customerId,
            orderDate,
            isDelivery,
            idSalesPerson: (idSalesPerson && idSalesPerson != 0 && idSalesPerson != '0') ? idSalesPerson : null,
            routeId,
            deliveryDate,
            dispatchDate,
            timeslot: timeSlot,
            deliveryAddress,
            poNumber,
            status: 'Pending',
            locationId,
            createdBy: currentUserId,
            updatedBy: currentUserId,
            subTotal,
            isTaxInvoice,
            taxRate,
            taxAmount,
            totalAmount: calculatedTotalAmount
        }, { transaction: t });
        if (Array.isArray(items)) {
            for (const item of items) {
                // Validate discount if provided
                const discount = item.discount || 0;
                try {
                    // This will throw an error if discount is invalid
                    calculateDiscountedAmount(item.qty, item.price, discount);
                } catch (error) {
                    await t.rollback();
                    return res.status(400).json({
                        success: false,
                        message: `Invalid discount for item ${item.itemId}: ${error.message}`
                    });
                }

                await SalesOrderItem.create({
                    salesOrderId: salesOrder.id,
                    itemId: item.itemId,
                    code: item.code,
                    qty: item.qty,
                    price: item.price,
                    discount: discount,
                    isTaxItem: item.isTaxItem || false,
                    discountedAmount: item.discountedAmount,
                    excludingTaxAmount: item.excludingTaxAmount,
                    total: item.total,
                    createdBy: currentUserId,
                    updatedBy: currentUserId
                }, { transaction: t });
            }
        }
        await t.commit();

        // If isAlreadyApproved, call approveOrRejectSalesOrder logic
        if (isAlreadyApproved) {
            // Call approveOrRejectSalesOrder with status 'Approved'
            req.params.id = salesOrder.id;
            req.body.status = 'Approved';
            // Use a new transaction for approval
            return exports.approveOrRejectSalesOrder(req, res);
        }

        const result = await SalesOrder.findByPk(salesOrder.id, {
            include: [
                { model: Customer },
                { model: SalesOrderItem, include: [Item] }
            ]
        });
        res.status(201).json(result);
    } catch (error) {
        await t.rollback();
        res.status(400).json({ error: error.message });
    }
};

// List all Sales Orders (supports pagination & filtering)
exports.getAllSalesOrders = async (req, res) => {
    try {
        const {
            page,
            limit,
            search,
            customerId,
            salesPersonId,
            isTaxInvoice,
            createdBy,
            status,
            deliveryOrderStatus,
        } = req.query;

        // ── Pagination ────────────────────────────────────────────────────────
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(500, Math.max(1, parseInt(limit) || 0)); // 0 = no pagination
        const usePagination = limitNum > 0;

        // ── Where clause ──────────────────────────────────────────────────────
        const whereClause = {};

        if (req.query.locationId) {
            whereClause.locationId = req.query.locationId;
        }

        if (status && status !== 'ALL') {
            whereClause.status = status;
        }

        if (createdBy) {
            whereClause.createdBy = createdBy;
        }

        // Customer filter
        if (customerId && customerId !== 'ALL') {
            whereClause.customerId = customerId;
        }

        // SalesPerson filter
        const salesPersonInclude = {
            model: User,
            as: 'SalesPerson',
            attributes: ['id', 'fullName', 'mobile'],
            ...(salesPersonId && salesPersonId !== 'ALL'
                ? { where: { id: salesPersonId }, required: true }
                : {})
        };

        // isTaxInvoice filter
        if (isTaxInvoice === 'TAX') {
            whereClause.isTaxInvoice = true;
        } else if (isTaxInvoice === 'REGULAR') {
            whereClause.isTaxInvoice = false;
        }

        // Search filter (order number or customer name)
        if (search) {
            // Pre-fetch customer IDs matching the search name
            // This avoids complex joins and allows subQuery: true to work reliably with pagination
            const matchingCustomers = await Customer.findAll({
                where: { name: { [Op.like]: `%${search}%` } },
                attributes: ['id'],
                raw: true
            });
            const customerIdsByName = matchingCustomers.map(c => c.id);

            whereClause[Op.or] = [
                { orderNumber: { [Op.like]: `%${search}%` } },
                { customerId: { [Op.in]: customerIdsByName } }
            ];
        }

        // ── Query ─────────────────────────────────────────────────────────────
        // Delivery Order Status filter (JOIN on DeliveryOrder)
        const deliveryOrderInclude = deliveryOrderStatus && deliveryOrderStatus !== 'ALL'
            ? {
                model: DeliveryOrder,
                as: 'DeliveryOrders',
                attributes: ['id', 'status'],
                where: { status: deliveryOrderStatus },
                required: true,
            }
            : {
                model: DeliveryOrder,
                as: 'DeliveryOrders',
                attributes: ['id', 'status'],
                required: false,
            };

        const queryOptions = {
            where: whereClause,
            include: [
                { model: Customer },
                salesPersonInclude,
                { model: SalesOrderItem, include: [Item] },
                deliveryOrderInclude,
            ],
            order: [['createdAt', 'DESC']],
            distinct: true,
        };

        if (usePagination) {
            queryOptions.limit = limitNum;
            queryOptions.offset = (pageNum - 1) * limitNum;
        }

        const { count, rows: orders } = await SalesOrder.findAndCountAll(queryOptions);

        // ── Collect creator user info ─────────────────────────────────────────
        const userIds = [...new Set(orders.map(so => so.createdBy).filter(Boolean))];
        const users = userIds.length > 0 ? await User.findAll({
            where: { id: userIds },
            attributes: ['id', 'username', 'fullName']
        }) : [];
        const userMap = {};
        users.forEach(u => { userMap[u.id] = { username: u.username, fullName: u.fullName }; });

        // ── Enrich each order with DO status + CustomerItemCode ───────────────
        const transformedSalesOrders = [];

        for (const order of orders) {
            // Delivery order status — use already-loaded association when available
            const preloadedDOs = order.DeliveryOrders || [];
            const deliveryOrders = preloadedDOs.length > 0
                ? preloadedDOs
                : await DeliveryOrder.findAll({ where: { salesOrderId: order.id } });
            order.dataValues.deliveryOrderStatus = (deliveryOrders && deliveryOrders.length > 0)
                ? (deliveryOrders[0].status || deliveryOrders[0].dataValues?.status)
                : null;

            const soData = order.toJSON();
            const user = userMap[soData.createdBy];
            soData.createdUserName = user ? user.username : null;
            soData.createdUserFullName = user ? user.fullName : null;

            // Enhance items with CustomerItemCode
            if (soData.SalesOrderItems && soData.SalesOrderItems.length > 0) {
                const enhancedItems = [];
                for (const orderItem of soData.SalesOrderItems) {
                    const customerItemCode = await CustomerItemCode.findOne({
                        where: { customerId: soData.customerId, itemId: orderItem.itemId, isActive: true },
                        attributes: ['id', 'code', 'customerId', 'itemId', 'locationId']
                    });
                    let parentCustomerItemCode = null;
                    if (!customerItemCode && soData.Customer && soData.Customer.parentId) {
                        parentCustomerItemCode = await CustomerItemCode.findOne({
                            where: { customerId: soData.Customer.parentId, itemId: orderItem.itemId, isActive: true },
                            attributes: ['id', 'code', 'customerId', 'itemId', 'locationId']
                        });
                    }
                    enhancedItems.push({
                        ...orderItem,
                        customerItemCode: customerItemCode
                            ? { id: customerItemCode.id, code: customerItemCode.code, customerId: customerItemCode.customerId, itemId: customerItemCode.itemId, locationId: customerItemCode.locationId, isFromParent: false }
                            : parentCustomerItemCode
                                ? { id: parentCustomerItemCode.id, code: parentCustomerItemCode.code, customerId: parentCustomerItemCode.customerId, itemId: parentCustomerItemCode.itemId, locationId: parentCustomerItemCode.locationId, isFromParent: true }
                                : null
                    });
                }
                soData.SalesOrderItems = enhancedItems;
            }
            transformedSalesOrders.push(soData);
        }

        const totalPages = usePagination ? Math.ceil(count / limitNum) : 1;

        // ── Calculate Summary Stats ───────────────────────────────────────────
        const allQueryOptions = {
            where: whereClause,
            include: [
                { model: Customer, attributes: [] },
                {
                    model: User,
                    as: 'SalesPerson',
                    attributes: [],
                    ...(salesPersonId && salesPersonId !== 'ALL'
                        ? { where: { id: salesPersonId }, required: true }
                        : {})
                },
                deliveryOrderInclude,
            ],
            attributes: ['id', 'status', 'totalAmount'],
            distinct: true,
        };
        const allFilteredOrders = await SalesOrder.findAll(allQueryOptions);

        let totalAmountSummary = 0;
        let totalApprovedCount = 0;
        let totalApprovedAmount = 0;
        let totalPendingCount = 0;
        let totalPendingAmount = 0;

        for (const o of allFilteredOrders) {
            const amt = Number(o.totalAmount) || 0;
            totalAmountSummary += amt;
            if (o.status === 'Approved') {
                totalApprovedCount++;
                totalApprovedAmount += amt;
            } else if (o.status === 'Pending') {
                totalPendingCount++;
                totalPendingAmount += amt;
            }
        }

        res.json({
            data: transformedSalesOrders,
            pagination: {
                page: usePagination ? pageNum : 1,
                limit: usePagination ? limitNum : count,
                total: count,
                totalPages,
                hasNextPage: usePagination ? pageNum < totalPages : false,
                hasPrevPage: usePagination ? pageNum > 1 : false,
            },
            summary: {
                totalAmount: totalAmountSummary,
                totalApprovedCount,
                totalApprovedAmount,
                totalPendingCount,
                totalPendingAmount
            }
        });
    } catch (error) {
        console.error('getAllSalesOrders error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get a single Sales Order by ID with CustomerItemCode information
exports.getSalesOrderById = async (req, res) => {
    try {
        const order = await SalesOrder.findByPk(req.params.id, {
            include: [
                { model: Customer },
                { model: SalesOrderItem, include: [Item] }
            ]
        });
        if (!order) return res.status(404).json({ error: 'Sales Order not found' });

        // Enhance order with CustomerItemCode information
        if (order.SalesOrderItems && order.SalesOrderItems.length > 0) {
            const enhancedItems = [];

            for (const orderItem of order.SalesOrderItems) {
                // Find customer item code for this item and customer
                const customerItemCode = await CustomerItemCode.findOne({
                    where: {
                        customerId: order.customerId,
                        itemId: orderItem.itemId,
                        isActive: true
                    },
                    attributes: ['id', 'code', 'customerId', 'itemId', 'locationId']
                });

                // If no direct customer item code found, check parent customer
                let parentCustomerItemCode = null;
                if (!customerItemCode && order.Customer && order.Customer.parentId) {
                    parentCustomerItemCode = await CustomerItemCode.findOne({
                        where: {
                            customerId: order.Customer.parentId,
                            itemId: orderItem.itemId,
                            isActive: true
                        },
                        attributes: ['id', 'code', 'customerId', 'itemId', 'locationId']
                    });
                }

                // Create enhanced item object
                const enhancedItem = {
                    ...orderItem.toJSON(),
                    customerItemCode: customerItemCode ? {
                        id: customerItemCode.id,
                        code: customerItemCode.code,
                        customerId: customerItemCode.customerId,
                        itemId: customerItemCode.itemId,
                        locationId: customerItemCode.locationId,
                        isFromParent: false
                    } : parentCustomerItemCode ? {
                        id: parentCustomerItemCode.id,
                        code: parentCustomerItemCode.code,
                        customerId: parentCustomerItemCode.customerId,
                        itemId: parentCustomerItemCode.itemId,
                        locationId: parentCustomerItemCode.locationId,
                        isFromParent: true
                    } : null
                };

                enhancedItems.push(enhancedItem);
            }

            // Replace the original items with enhanced items
            const orderResponse = order.toJSON();
            orderResponse.SalesOrderItems = enhancedItems;

            res.json(orderResponse);
        } else {
            res.json(order);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


exports.getSalesOrdersByCustomerId = async (req, res) => {
    try {
        const orders = await SalesOrder.findAll({
            where: { customerId: req.params.customerId },
            include: [
                { model: Customer },
                { model: SalesOrderItem, include: [Item] }
            ], order: [['createdAt', 'DESC']]
        });
        if (!orders) return res.status(404).json({ error: 'Sales Order not found' });

        // Enhanced orders with CustomerItemCode and delivery status
        const enhancedOrders = [];

        for (const order of orders) {
            // Get delivery order status
            const deliveryOrders = await DeliveryOrder.findAll({ where: { salesOrderId: order.id } });
            const deliveryOrderStatus = deliveryOrders && deliveryOrders.length > 0
                ? deliveryOrders[0].status
                : null;

            // Enhance items with CustomerItemCode information
            let enhancedItems = [];
            if (order.SalesOrderItems && order.SalesOrderItems.length > 0) {
                for (const orderItem of order.SalesOrderItems) {
                    // Find customer item code for this item and customer
                    const customerItemCode = await CustomerItemCode.findOne({
                        where: {
                            customerId: order.customerId,
                            itemId: orderItem.itemId,
                            isActive: true
                        },
                        attributes: ['id', 'code', 'customerId', 'itemId', 'locationId']
                    });

                    // If no direct customer item code found, check parent customer
                    let parentCustomerItemCode = null;
                    if (!customerItemCode && order.Customer && order.Customer.parentId) {
                        parentCustomerItemCode = await CustomerItemCode.findOne({
                            where: {
                                customerId: order.Customer.parentId,
                                itemId: orderItem.itemId,
                                isActive: true
                            },
                            attributes: ['id', 'code', 'customerId', 'itemId', 'locationId']
                        });
                    }

                    // Create enhanced item object
                    const enhancedItem = {
                        ...orderItem.toJSON(),
                        customerItemCode: customerItemCode ? {
                            id: customerItemCode.id,
                            code: customerItemCode.code,
                            customerId: customerItemCode.customerId,
                            itemId: customerItemCode.itemId,
                            locationId: customerItemCode.locationId,
                            isFromParent: false
                        } : parentCustomerItemCode ? {
                            id: parentCustomerItemCode.id,
                            code: parentCustomerItemCode.code,
                            customerId: parentCustomerItemCode.customerId,
                            itemId: parentCustomerItemCode.itemId,
                            locationId: parentCustomerItemCode.locationId,
                            isFromParent: true
                        } : null
                    };

                    enhancedItems.push(enhancedItem);
                }
            }

            // Create enhanced order object
            const enhancedOrder = {
                ...order.toJSON(),
                deliveryOrderStatus,
                SalesOrderItems: enhancedItems
            };

            enhancedOrders.push(enhancedOrder);
        }

        res.json(enhancedOrders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// Update a Sales Order (only if Pending)
exports.updateSalesOrder = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const data = req.body;
        const salesOrder = await SalesOrder.findByPk(req.params.id, { transaction: t });
        if (!salesOrder) {
            await t.rollback();
            return res.status(404).json({ error: 'Sales order not found' });
        }
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        // Update main sales order fields (excluding items)
        const {
            items,
            customerId,
            orderDate,
            isDelivery,
            idSalesPerson,
            routeId,
            deliveryDate,
            dispatchDate,
            timeSlot,
            deliveryAddress,
            poNumber,
            subTotal,
            isTaxInvoice,
            taxRate,
            taxAmount,
            totalAmount,
            locationId,
            totalWeight
        } = data;

        // Calculate total amount with discounts if items are provided
        let calculatedTotalAmount = totalAmount;
        if (Array.isArray(items) && items.length > 0) {
            const itemTotals = calculateItemTotals(items);
            calculatedTotalAmount = itemTotals.finalAmount;
        }

        const updatedOrderFields = {
            customerId,
            orderDate,
            isDelivery,
            idSalesPerson: (idSalesPerson && idSalesPerson != 0 && idSalesPerson != '0') ? idSalesPerson : null,
            routeId,
            deliveryDate,
            dispatchDate,
            timeslot: timeSlot,
            deliveryAddress,
            poNumber,
            subTotal,
            isTaxInvoice,
            taxRate,
            taxAmount,
            totalAmount: calculatedTotalAmount,
            locationId,
            totalWeight
        };

        await salesOrder.update({ ...updatedOrderFields, updatedBy: currentUserId }, { transaction: t });

        // If items are provided, update them
        if (Array.isArray(items)) {
            // Delete existing items
            await SalesOrderItem.destroy({ where: { salesOrderId: salesOrder.id }, transaction: t });
            // Insert new items
            for (const item of items) {
                // Validate discount if provided
                const discount = item.discount || 0;
                try {
                    // This will throw an error if discount is invalid
                    calculateDiscountedAmount(item.qty, item.price, discount);
                } catch (error) {
                    await t.rollback();
                    return res.status(400).json({
                        success: false,
                        message: `Invalid discount for item ${item.itemId}: ${error.message}`
                    });
                }

                await SalesOrderItem.create({
                    salesOrderId: salesOrder.id,
                    itemId: item.itemId,
                    code: item.code,
                    qty: item.qty,
                    price: item.price,
                    discount: discount,
                    isTaxItem: item.isTaxItem || false,
                    discountedAmount: item.discountedAmount,
                    excludingTaxAmount: item.excludingTaxAmount,
                    total: item.total,
                    createdBy: currentUserId,
                    updatedBy: currentUserId
                }, { transaction: t });
            }
        }

        await t.commit();
        // Return updated order with items
        const result = await SalesOrder.findByPk(salesOrder.id, {
            include: [
                { model: Customer },
                { model: SalesOrderItem, include: [Item] }
            ]
        });
        res.json(result);
    } catch (error) {
        await t.rollback();
        res.status(400).json({ error: error.message });
    }
};

// Delete a Sales Order (only if Pending)
exports.deleteSalesOrder = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const order = await SalesOrder.findByPk(req.params.id, { transaction: t });
        if (!order) {
            await t.rollback();
            return res.status(404).json({ error: 'Sales Order not found' });
        }
        if (order.status !== 'Pending') {
            await t.rollback();
            return res.status(400).json({ error: 'Only Pending Sales Order can be deleted' });
        }
        await SalesOrderItem.destroy({ where: { salesOrderId: order.id }, transaction: t });
        await order.destroy({ transaction: t });
        await t.commit();
        res.json({ message: 'Sales Order deleted' });
    } catch (error) {
        await t.rollback();
        res.status(400).json({ error: error.message });
    }
};

// Approve or reject a Sales Order
exports.approveOrRejectSalesOrder = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { status, locationId } = req.body; // status: 'Approved' or 'Rejected'
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!['Approved', 'Rejected'].includes(status)) {
            await t.rollback();
            return res.status(400).json({ error: 'Invalid status. Must be Approved or Rejected.' });
        }
        const order = await SalesOrder.findByPk(req.params.id, { include: [SalesOrderItem, Customer], transaction: t });
        if (!order) {
            await t.rollback();
            return res.status(404).json({ error: 'Sales Order not found' });
        }
        await order.update({ status }, { transaction: t });
        if (status === 'Approved') {
            // Auto-create Delivery Order (DO) with same items
            let doNumber = await generateDocumentNumber('DO', locationId);
            const DeliveryOrder = require('../models/deliveryOrder');
            const DeliveryOrderItem = require('../models/deliveryOrderItem');

            const route = await Route.findByPk(order.routeId, { attributes: ['id', 'driverId', 'vehicleId'] });
            const deliveryOrder = await DeliveryOrder.create({
                doNumber,
                salesOrderId: order.id,
                customerId: order.customerId,
                isDelivery: order.isDelivery,
                orderDate: new Date(), // order.orderDate,
                routeId: route?.id || null,
                driverId: route?.driverId || null,
                vehicleId: route?.vehicleId || null,
                dispatchDate: order.deliveryDate,
                deliveryAddress: order.deliveryAddress,
                totalWeight: order.totalWeight,
                totalAmount: order.totalAmount,
                status: 'Pending',
                locationId,
                createdBy: currentUserId,
                updatedBy: currentUserId
            }, { transaction: t });
            for (const soItem of order.SalesOrderItems) {
                await DeliveryOrderItem.create({
                    deliveryOrderId: deliveryOrder.id,
                    itemId: soItem.itemId,
                    qty: soItem.qty
                }, { transaction: t });
            }

            // Send SMS notification if customer has contact number
            if (order.Customer && order.Customer.contactNumber) {
                try {
                    const smsResult = await sendSalesOrderApprovedNotification(
                        order.Customer.contactNumber,
                        order.orderNumber
                    );

                    if (smsResult.success) {
                        console.log(`SMS notification sent successfully to customer ${order.customerId} for order ${order.orderNumber}`);
                    } else {
                        console.error(`Failed to send SMS notification to customer ${order.customerId}:`, smsResult.error);
                    }
                } catch (smsError) {
                    // Log SMS error but don't fail the entire transaction
                    console.error(`SMS service error for customer ${order.customerId}:`, smsError.message);
                }
            }
        }
        await t.commit();
        res.json({ message: `Sales Order ${status.toLowerCase()}`, order });
    } catch (error) {
        await t.rollback();
        res.status(400).json({ error: error.message });
    }
};

// Cancel an Approved Sales Order
exports.cancelSalesOrder = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const order = await SalesOrder.findByPk(req.params.id, { transaction: t });
        if (!order) {
            await t.rollback();
            return res.status(404).json({ error: 'Sales Order not found' });
        }

        if (order.status === 'Cancelled') {
            await t.rollback();
            return res.status(400).json({ error: 'Sales Order is already cancelled' });
        }

        const DeliveryOrder = require('../models/deliveryOrder');
        const DeliveryOrderItem = require('../models/deliveryOrderItem');

        const deliveryOrders = await DeliveryOrder.findAll({ where: { salesOrderId: order.id }, transaction: t });

        // Loop through all DOs for this SO. If any DO has progress beyond "Pending" or "Rejected", we can't cancel.
        const uncancelableStatuses = ['Approved', 'Scheduled', 'In Transit', 'Dispatched', 'Finalized', 'Delivered'];

        for (const doRecord of deliveryOrders) {
            if (uncancelableStatuses.includes(doRecord.status)) {
                await t.rollback();
                return res.status(400).json({ error: "Cannot cancel Sales Order because the associated Delivery Order is already Approved or processed." });
            }
        }

        const currentUserId = (req.user && req.user.id) || (req.body && req.body.user && req.body.user.id) || null;
        await order.update({ status: 'Cancelled', updatedBy: currentUserId }, { transaction: t });

        // If there are any Pending Delivery Orders, destroy them
        for (const doRecord of deliveryOrders) {
            if (doRecord.status === 'Pending') {
                await DeliveryOrderItem.destroy({ where: { deliveryOrderId: doRecord.id }, transaction: t });
                await doRecord.destroy({ transaction: t });
            }
        }

        await t.commit();
        res.json({ message: 'Sales Order cancelled successfully', order });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ error: error.message });
    }
};

// Get sales items by customer with customer codes and stock availability
exports.getSalesItemsByCustomer = async (req, res) => {
    try {
        const { customerId, locationId = 1 } = req.body;
        console.log(customerId, locationId);

        // Validate required parameters
        if (!customerId) {
            return res.status(400).json({
                success: false,
                error: 'Customer ID is required'
            });
        }

        // Get customer information and check if customer exists
        const customer = await Customer.findByPk(customerId, {
            attributes: ['id', 'name', 'type', 'parentId']
        });

        if (!customer) {
            return res.status(404).json({
                success: false,
                error: 'Customer not found'
            });
        }

        // Build where clause for customer item codes with parent fallback
        const customerIds = [customerId];
        if (customer.parentId) {
            customerIds.unshift(customer.parentId); // Parent has priority
        }

        const whereClause = {
            customerId: { [Op.in]: customerIds },
            isActive: true
        };

        if (locationId) {
            whereClause.locationId = locationId;
        }

        // Get customer item codes with item details
        const customerItemCodes = await CustomerItemCode.findAll({
            where: whereClause,
            include: [
                {
                    model: Item,
                    as: 'Item',
                    where: {
                        status: 'active',
                        doNotAllowDirectSale: false
                    },
                    include: [
                        {
                            model: Category,
                            attributes: ['id', 'name']
                        }
                    ],
                    attributes: [
                        'id', 'name', 'sku', 'barcode', 'unit', 'sellingPrice',
                        'doNotAllowDirectSale', 'allowsMinus', 'isProductionRawMaterial',
                        'temperature', 'weight', 'itemsPerBox', 'isTaxInclusive'
                    ]
                },
                {
                    model: Location,
                    as: 'Location',
                    attributes: ['id', 'name']
                }
            ],
            order: [
                ['customerId', 'ASC'], // Parent customer codes first
                ['code', 'ASC']
            ]
        });


        console.log(customerItemCodes);


        if (customerItemCodes.length === 0) {
            return res.json({
                success: true,
                data: [],
                message: 'No items found for this customer'
            });
        }

        // Fetch category discounts for this customer and parent
        const categoryDiscounts = await CustomerCategoryDiscount.findAll({
            where: { customerId: { [Op.in]: [customerId, customer.parentId].filter(Boolean) } }
        });

        const discountMap = {}; // categoryId -> discountPercentage
        // Sort so specific customer discount overrides parent discount if both exist
        categoryDiscounts.sort((a, b) => {
            if (a.customerId === customerId) return 1;
            if (b.customerId === customerId) return -1;
            return 0;
        });
        categoryDiscounts.forEach(d => {
            discountMap[d.categoryId] = d.discountPercentage;
        });

        // Process each item to get stock information
        const itemsWithStock = [];
        const processedItemIds = new Set();

        for (const customerItemCode of customerItemCodes) {
            const item = customerItemCode.Item;

            // Skip if we already processed this item (parent customer code takes priority)
            if (processedItemIds.has(item.id)) {
                continue;
            }
            processedItemIds.add(item.id);

            // Get Active stock for this item
            const stockWhereClause = {
                itemId: item.id,
                status: 'Active'
            };

            if (locationId) {
                stockWhereClause.locationId = locationId;
            }

            const availableStock = await Stock.findAll({
                where: stockWhereClause,
                include: [
                    {
                        model: Item,
                        attributes: ['id', 'name', 'unit', 'sellingPrice']
                    }
                ],
                order: [
                    ['createdAt', 'ASC'] // FIFO: First in, first out
                ],
                attributes: [
                    'id', 'itemId', 'availableQty', 'weight', 'status',
                    'locationId', 'storeId', 'createdAt', 'updatedAt'
                ]
            });

            // Calculate total available quantity from all stock records
            const totalAvailableQuantity = availableStock.reduce(
                (sum, stock) => Number(sum) + Number(stock.availableQty || 0), 0
            );

            // Calculate total weight
            const totalWeight = availableStock.reduce(
                (sum, stock) => Number(sum) + Number(stock.weight || 0), 0
            );

            // Get the primary stock record (first available stock for FIFO)
            const primaryStock = availableStock.length > 0 ? availableStock[0] : null;

            // Get location information for stock records
            const locationIds = [...new Set(availableStock.map(stock => stock.locationId).filter(Boolean))];
            const locations = {};
            if (locationIds.length > 0) {
                const locationRecords = await Location.findAll({
                    where: { id: { [Op.in]: locationIds } },
                    attributes: ['id', 'name']
                });
                locationRecords.forEach(loc => {
                    locations[loc.id] = { id: loc.id, name: loc.name };
                });
            }

            // Prepare item data
            const itemData = {
                customerItemCode: {
                    id: customerItemCode.id,
                    code: customerItemCode.code,
                    customerId: customerItemCode.customerId,
                    isFromParent: customerItemCode.customerId !== customerId,
                    locationId: customerItemCode.locationId
                },
                item: {
                    id: item.id,
                    name: item.name,
                    sku: item.sku,
                    barcode: item.barcode,
                    unit: item.unit,
                    sellingPrice: item.sellingPrice,
                    temperature: item.temperature,
                    weight: item.weight,
                    itemsPerBox: item.itemsPerBox,
                    category: item.Category,
                    discountPercentage: (item.Category && discountMap[item.Category.id]) || 0,
                    isTaxInclusive: item.isTaxInclusive,
                    flags: {
                        doNotAllowDirectSale: item.doNotAllowDirectSale,
                        allowsMinus: item.allowsMinus,
                        isProductionRawMaterial: item.isProductionRawMaterial
                    }
                },
                availability: {
                    totalAvailableQuantity,
                    totalWeight,
                    totalStockRecords: availableStock.length,
                    hasStock: totalAvailableQuantity > 0,
                    allowsNegativeStock: item.allowsMinus
                },
                primaryStock: primaryStock ? {
                    id: primaryStock.id,
                    availableQty: primaryStock.availableQty,
                    weight: primaryStock.weight,
                    status: primaryStock.status,
                    locationId: primaryStock.locationId,
                    storeId: primaryStock.storeId,
                    location: locations[primaryStock.locationId] || null,
                    createdAt: primaryStock.createdAt
                } : null,
                allStock: availableStock.map(stock => ({
                    id: stock.id,
                    availableQty: stock.availableQty,
                    weight: stock.weight,
                    status: stock.status,
                    locationId: stock.locationId,
                    storeId: stock.storeId,
                    location: locations[stock.locationId] || null,
                    createdAt: stock.createdAt,
                    updatedAt: stock.updatedAt
                })),
                warnings: {
                    noStock: totalAvailableQuantity === 0,
                    restrictedSale: item.doNotAllowDirectSale,
                    isRawMaterial: item.isProductionRawMaterial,
                    lowStock: totalAvailableQuantity > 0 && totalAvailableQuantity < 10 // Warning for low stock
                }
            };

            console.log(itemData);


            itemsWithStock.push(itemData);
        }

        // Sort final results by customer item code
        itemsWithStock.sort((a, b) => {
            if (a.customerItemCode.isFromParent !== b.customerItemCode.isFromParent) {
                return a.customerItemCode.isFromParent ? 1 : -1; // Own items first
            }
            return a.customerItemCode.code.localeCompare(b.customerItemCode.code);
        });

        // Prepare response summary
        const summary = {
            totalItems: itemsWithStock.length,
            itemsWithStock: itemsWithStock.filter(item => item.availability.hasStock).length,
            itemsWithoutStock: itemsWithStock.filter(item => !item.availability.hasStock).length,
            lowStockItems: itemsWithStock.filter(item => item.warnings.lowStock).length,
            restrictedItems: itemsWithStock.filter(item => item.warnings.restrictedSale).length,
            parentItemCodes: itemsWithStock.filter(item => item.customerItemCode.isFromParent).length,
            totalAvailableQuantity: itemsWithStock.reduce((sum, item) => sum + item.availability.totalAvailableQuantity, 0),
            totalWeight: itemsWithStock.reduce((sum, item) => sum + item.availability.totalWeight, 0)
        };

        res.json({
            success: true,
            data: itemsWithStock,
            summary,
            customer: {
                id: customer.id,
                name: customer.name,
                type: customer.type,
                hasParent: !!customer.parentId
            },
            filters: {
                customerId,
                locationId
            }
        });

    } catch (error) {
        console.error('Error fetching sales items by customer:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while fetching sales items',
            message: error.message
        });
    }
};

// Get sales items for mobile with active items, custom customer pricing and stock details
exports.getSalesItemsByCustomerMobile = async (req, res) => {
    try {
        const { customerId, salespersonId, locationId = 1 } = req.body;
        console.log("Mobile items request:", customerId, salespersonId, locationId);

        // Validate required parameters
        if (!customerId) {
            return res.status(400).json({
                success: false,
                error: 'Customer ID is required'
            });
        }

        // Get customer information
        const customer = await Customer.findByPk(customerId, {
            attributes: ['id', 'name', 'type', 'parentId']
        });

        if (!customer) {
            return res.status(404).json({
                success: false,
                error: 'Customer not found'
            });
        }

        // Fetch all active items
        const items = await Item.findAll({
            where: { status: 'active' },
            include: [
                {
                    model: Category,
                    as: 'Category',
                    attributes: ['id', 'name', 'itemType']
                }
            ],
            attributes: [
                'id', 'name', 'sku', 'barcode', 'unit', 'sellingPrice', 'minSellingPrice', 'weight', 'itemsPerBox', 'image'
            ]
        });

        // Fetch customer item codes (for codes fallback)
        const customerIds = [customerId];
        if (customer.parentId) {
            customerIds.push(customer.parentId);
        }
        const customerItemCodes = await CustomerItemCode.findAll({
            where: {
                customerId: { [Op.in]: customerIds },
                isActive: true,
                ...(locationId ? { locationId } : {})
            }
        });

        // Index customer item codes by itemId for quick lookup
        const codeMap = {}; // itemId -> customerItemCode instance
        customerItemCodes.forEach(cic => {
            // Priority: direct customer code overrides parent customer code
            if (!codeMap[cic.itemId] || cic.customerId === customerId) {
                codeMap[cic.itemId] = cic;
            }
        });

        // Fetch category discounts for this customer and parent
        const categoryDiscounts = await CustomerCategoryDiscount.findAll({
            where: { customerId: { [Op.in]: [customerId, customer.parentId].filter(Boolean) } }
        });

        const discountMap = {}; // categoryId -> discountPercentage
        categoryDiscounts.sort((a, b) => {
            if (a.customerId === customerId) return 1;
            if (b.customerId === customerId) return -1;
            return 0;
        });
        categoryDiscounts.forEach(d => {
            discountMap[d.categoryId] = d.discountPercentage;
        });

        // Fetch custom customer prices (ItemPrice) for this customer and location
        const itemPrices = await ItemPrice.findAll({
            where: {
                customerId: customerId,
                status: 'Active',
                ...(locationId ? { locationId } : {})
            }
        });
        const customPriceMap = {}; // itemId -> custom price
        itemPrices.forEach(ip => {
            customPriceMap[ip.itemId] = ip.price;
        });

        // Fetch all active stocks for all items in one query to be efficient
        const activeStocks = await Stock.findAll({
            where: {
                itemId: { [Op.in]: items.map(it => it.id) },
                status: 'Active',
                ...(locationId ? { locationId } : {})
            },
            attributes: [
                'id', 'itemId', 'availableQty', 'weight', 'status',
                'locationId', 'storeId', 'createdAt', 'updatedAt'
            ]
        });

        // Group stocks by itemId
        const stockMap = {}; // itemId -> array of stocks
        activeStocks.forEach(st => {
            if (!stockMap[st.itemId]) {
                stockMap[st.itemId] = [];
            }
            stockMap[st.itemId].push(st);
        });

        // Fetch locations for stock mapping
        const locationIds = [...new Set(activeStocks.map(stock => stock.locationId).filter(Boolean))];
        const locations = {};
        if (locationIds.length > 0) {
            const locationRecords = await Location.findAll({
                where: { id: { [Op.in]: locationIds } },
                attributes: ['id', 'name']
            });
            locationRecords.forEach(loc => {
                locations[loc.id] = { id: loc.id, name: loc.name };
            });
        }

        // Process all active items
        const itemsWithStock = [];

        for (const item of items) {
            // Find customer item code or fallback to SKU/Barcode
            const cic = codeMap[item.id];
            const customerItemCodeObj = {
                id: cic ? cic.id : 0,
                code: cic ? cic.code : (item.sku || item.barcode || 'N/A'),
                customerId: cic ? cic.customerId : customerId,
                isFromParent: cic ? cic.customerId !== customerId : false,
                locationId: cic ? cic.locationId : (locationId || 1)
            };

            // Custom Customer Pricing logic
            const hasCustomPrice = customPriceMap[item.id] !== undefined;
            const customPrice = customPriceMap[item.id];

            const finalSellingPrice = hasCustomPrice ? customPrice : item.sellingPrice;
            // If custom price, set minSellingPrice to the same value so BDM cannot discount it
            const finalMinSellingPrice = hasCustomPrice ? customPrice : (item.minSellingPrice || 0);
            // If custom price, set discount percentage to 0
            const finalDiscountPercentage = hasCustomPrice ? 0 : ((item.Category && discountMap[item.Category.id]) || 0);

            // Stocks
            const availableStock = stockMap[item.id] || [];
            const totalAvailableQuantity = availableStock.reduce(
                (sum, stock) => Number(sum) + Number(stock.availableQty || 0), 0
            );
            const totalWeight = availableStock.reduce(
                (sum, stock) => Number(sum) + Number(stock.weight || 0), 0
            );
            const primaryStock = availableStock.length > 0 ? availableStock[0] : null;

            itemsWithStock.push({
                customerItemCode: customerItemCodeObj,
                item: {
                    id: item.id,
                    name: item.name,
                    sku: item.sku,
                    barcode: item.barcode,
                    unit: item.unit,
                    sellingPrice: finalSellingPrice,
                    minSellingPrice: finalMinSellingPrice,
                    temperature: 0,
                    weight: item.weight,
                    itemsPerBox: item.itemsPerBox,
                    category: item.Category,
                    discountPercentage: finalDiscountPercentage,
                    isTaxInclusive: false,
                    flags: {
                        allowsMinus: false,
                        isProductionRawMaterial: false
                    }
                },
                availability: {
                    totalAvailableQuantity,
                    totalWeight,
                    totalStockRecords: availableStock.length,
                    hasStock: totalAvailableQuantity > 0,
                    allowsNegativeStock: false
                },
                primaryStock: primaryStock ? {
                    id: primaryStock.id,
                    availableQty: primaryStock.availableQty,
                    weight: primaryStock.weight,
                    status: primaryStock.status,
                    locationId: primaryStock.locationId,
                    storeId: primaryStock.storeId,
                    location: locations[primaryStock.locationId] || null,
                    createdAt: primaryStock.createdAt
                } : null,
                allStock: availableStock.map(stock => ({
                    id: stock.id,
                    availableQty: stock.availableQty,
                    weight: stock.weight,
                    status: stock.status,
                    locationId: stock.locationId,
                    storeId: stock.storeId,
                    location: locations[stock.locationId] || null,
                    createdAt: stock.createdAt,
                    updatedAt: stock.updatedAt
                })),
                warnings: {
                    noStock: totalAvailableQuantity === 0,
                    restrictedSale: false,
                    isRawMaterial: false,
                    lowStock: totalAvailableQuantity > 0 && totalAvailableQuantity < 10
                }
            });
        }

        // Sort items: Items with customer-specific item codes first, then own items first, then alphabetical by code
        itemsWithStock.sort((a, b) => {
            const aHasCode = a.customerItemCode.id > 0;
            const bHasCode = b.customerItemCode.id > 0;
            if (aHasCode !== bHasCode) {
                return aHasCode ? -1 : 1; // Real codes first
            }
            if (a.customerItemCode.isFromParent !== b.customerItemCode.isFromParent) {
                return a.customerItemCode.isFromParent ? 1 : -1; // Own items first
            }
            return a.customerItemCode.code.localeCompare(b.customerItemCode.code);
        });

        // Summary details
        const summary = {
            totalItems: itemsWithStock.length,
            itemsWithStock: itemsWithStock.filter(item => item.availability.hasStock).length,
            itemsWithoutStock: itemsWithStock.filter(item => !item.availability.hasStock).length,
            lowStockItems: itemsWithStock.filter(item => item.warnings.lowStock).length,
            parentItemCodes: itemsWithStock.filter(item => item.customerItemCode.isFromParent).length,
            totalAvailableQuantity: itemsWithStock.reduce((sum, item) => sum + item.availability.totalAvailableQuantity, 0),
            totalWeight: itemsWithStock.reduce((sum, item) => sum + item.availability.totalWeight, 0)
        };

        res.json({
            success: true,
            data: itemsWithStock,
            summary,
            customer: {
                id: customer.id,
                name: customer.name,
                type: customer.type,
                hasParent: !!customer.parentId
            },
            filters: {
                customerId,
                salespersonId,
                locationId
            }
        });

    } catch (error) {
        console.error('Error fetching mobile sales items:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while fetching mobile sales items',
            message: error.message
        });
    }
};