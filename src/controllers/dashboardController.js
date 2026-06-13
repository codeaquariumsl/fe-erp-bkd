const db = require('../models');
const { Op } = require('sequelize');

// GET /api/dashboard/summary
// GET /api/dashboard/main-details
exports.getMainDashboardDetails = async (req, res, next) => {
    try {
        const { locationId } = req.query;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

        // 1. Total Inventory Value (Current Stock)
        // Calculating total value from GRNItems that still have available quantity
        const inventoryValueResult = await db.GRNItem.findAll({
            where: { availableQty: { [Op.gt]: 0 } },
            attributes: [[db.sequelize.literal('SUM(GRNItem.availableQty * costPrice)'), 'totalValue']],
            include: [{
                model: db.GRN,
                attributes: [],
                where: locationId ? { locationId } : {}
            }],
            raw: true
        });
        const totalValue = parseFloat(inventoryValueResult[0]?.totalValue || 0);

        // 2. Monthly Sales (Current month vs Last month)
        const currentMonthSales = await db.Invoice.sum('total', {
            where: {
                invoiceDate: { [Op.gte]: startOfMonth },
                status: { [Op.ne]: 'Cancelled' },
                ...(locationId && { locationId })
            }
        }) || 0;

        const lastMonthSales = await db.Invoice.sum('total', {
            where: {
                invoiceDate: { [Op.between]: [startOfLastMonth, endOfLastMonth] },
                status: { [Op.ne]: 'Cancelled' },
                ...(locationId && { locationId })
            }
        }) || 0;

        const salesGrowth = lastMonthSales === 0 ? 0 : ((currentMonthSales - lastMonthSales) / lastMonthSales) * 100;

        // 3. Active Customers (Customers who had invoices in the last 30 days)
        // const thirtyDaysAgo = new Date();
        // thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const activeCustomersCount = await db.Customer.count({
            col: 'id',
            where: {
                status: 'active',
                ...(locationId && { locationId })
            }
        });

        // 4. Total Orders (Sales Orders for the current month)
        const totalOrdersCount = await db.SalesOrder.count({
            where: {
                orderDate: { [Op.gte]: startOfMonth },
                status: { [Op.ne]: 'Cancelled' },
                ...(locationId && { locationId })
            }
        });
        const pendingOrdersCount = await db.SalesOrder.count({
            where: {
                orderDate: { [Op.gte]: startOfMonth },
                status: 'Pending',
                ...(locationId && { locationId })
            }
        });

        // 5. Low Stock Items (Count and List, excluding lorry stock)
        const lowStockItems = await db.Item.findAll({
            attributes: [
                'id', 'name', 'sku', 'reorderLevelQty',
                [db.sequelize.fn('SUM', db.sequelize.col('Stocks.availableQty')), 'totalStoreQty']
            ],
            include: [{
                model: db.Stock,
                required: true,
                attributes: [],
                where: {
                    storeId: { [Op.not]: null },
                    lorryId: null, // Explicitly ignore lorry stock
                    ...(locationId && { locationId })
                }
            }],
            where: {
                reorderLevelQty: { [Op.not]: null }
            },
            group: ['Item.id', 'Item.name', 'Item.sku', 'Item.reorderLevelQty'],
            having: db.sequelize.literal('SUM(`Stocks`.`availableQty`) <= `Item`.`reorderLevelQty`'),
            limit: 5,
            subQuery: false
        });

        // 6. Sales Trend (Last 6 months)
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        const salesTrend = await db.Invoice.findAll({
            attributes: [
                [db.sequelize.fn('DATE_FORMAT', db.sequelize.col('invoiceDate'), '%Y-%m'), 'monthKey'],
                [db.sequelize.fn('DATE_FORMAT', db.sequelize.col('invoiceDate'), '%b'), 'month'],
                [db.sequelize.fn('SUM', db.sequelize.col('total')), 'sales']
            ],
            where: {
                invoiceDate: { [Op.gte]: sixMonthsAgo },
                status: { [Op.ne]: 'Cancelled' },
                ...(locationId && { locationId })
            },
            group: [
                db.sequelize.fn('DATE_FORMAT', db.sequelize.col('invoiceDate'), '%Y-%m'),
                db.sequelize.fn('DATE_FORMAT', db.sequelize.col('invoiceDate'), '%b')
            ],
            order: [[db.sequelize.fn('DATE_FORMAT', db.sequelize.col('invoiceDate'), '%Y-%m'), 'ASC']]
        });

        // 7. Delivery Order Status
        const deliveryStatusBreakdown = await db.DeliveryOrder.findAll({
            attributes: [
                'status',
                [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
            ],
            where: locationId ? { locationId } : {},
            group: ['status']
        });

        // 8. Top Inventory Items by Value
        const topItems = await db.GRNItem.findAll({
            where: { availableQty: { [Op.gt]: 0 } },
            attributes: [
                'itemId',
                [db.sequelize.literal('SUM(GRNItem.availableQty * costPrice)'), 'totalValue'],
                [db.sequelize.literal('SUM(GRNItem.availableQty)'), 'totalQty']
            ],
            include: [
                {
                    model: db.Item,
                    attributes: ['name', 'sku']
                },
                {
                    model: db.GRN,
                    attributes: [],
                    where: locationId ? { locationId } : {}
                }
            ],
            group: ['itemId', 'Item.id', 'Item.name', 'Item.sku'],
            order: [[db.sequelize.literal('totalValue'), 'DESC']],
        });

        // 9. Recent Orders (Last 5 Invoices)
        const recentOrders = await db.Invoice.findAll({
            where: locationId ? { locationId } : {},
            limit: 5,
            order: [['invoiceDate', 'DESC']],
            include: [{
                model: db.Customer,
                attributes: ['name']
            }]
        });

        res.json({
            summary: {
                totalInventoryValue: {
                    value: totalValue,
                    trend: 12.5 // Placeholder
                },
                monthlySales: {
                    value: currentMonthSales,
                    trend: parseFloat(salesGrowth.toFixed(1))
                },
                activeCustomers: {
                    value: activeCustomersCount,
                    trend: 8.2 // Placeholder
                },
                totalOrders: {
                    value: totalOrdersCount,
                    pending: pendingOrdersCount
                },
                lowStockItems: {
                    value: lowStockItems.length,
                    status: lowStockItems.length > 0 ? 'Needs attention' : 'Healthy'
                }
            },
            lowStockItems: lowStockItems.map(item => ({
                id: item.id,
                name: item.name,
                sku: item.sku,
                availableQty: item.dataValues.totalStoreQty || 0,
                reorderLevelQty: item.reorderLevelQty
            })),
            salesTrend,
            deliveryOrderStatus: deliveryStatusBreakdown,
            topInventoryItems: topItems,
            recentOrders
        });

    } catch (err) {
        console.error('Error in getMainDashboardDetails:', err);
        next(err);
    }
};

exports.getSummary = async (req, res, next) => {

    try {
        // Example: Count totals for dashboard cards
        const [deliveryOrders, items, customers, salesOrders] = await Promise.all([
            db.DeliveryOrder.count(),
            db.Item.count(),
            db.Customer.count(),
            db.SalesOrder.count()
        ]);
        res.json({
            totalItems: items,
            totalCustomers: customers,
            totalSalesOrders: salesOrders,
            totalDeliveryOrders: deliveryOrders,
        });
    } catch (err) {
        next(err);
    }
};

// GET /api/dashboard/low-stock
exports.getLowStockItems = async (req, res, next) => {
    try {
        const items = await db.Item.findAll({
            include: [{
                model: db.Stock,
                attributes: ['availableQty', 'storeId'],
                required: true,
                include: [{ model: db.Store, attributes: ['id', 'name'] }],
                where: { storeId: { [Op.not]: null } }
            }],
            where: {
                reorderLevelQty: { [Op.not]: null }
            }
        });
        const lowStockItems = [];
        items.forEach(item => {
            item.Stocks.forEach(stock => {
                if ((stock.availableQty || 0) <= (item.reorderLevelQty || 0)) {
                    lowStockItems.push({
                        itemId: item.id,
                        itemName: item.name,
                        storeId: stock.storeId,
                        storeName: stock.Store ? stock.Store.name : null,
                        availableQty: stock.availableQty,
                        reorderLevelQty: item.reorderLevelQty
                    });
                }
            });
        });
        res.json({ lowStockItems });
    } catch (err) {
        next(err);
    }
};

// GET /api/dashboard/expired-items
exports.getExpiredItems = async (req, res, next) => {
    try {
        // Find GRNItems with expireDate in the past and availableQty > 0
        const today = new Date();
        const expiredGrnItems = await db.GRNItem.findAll({
            where: {
                expireDate: { [Op.lt]: today },
                availableQty: { [Op.gt]: 0 }
            },
            include: [{ model: db.Item }]
        });
        res.json({ expiredGrnItems });
    } catch (err) {
        next(err);
    }
};

// GET /api/dashboard/overstock
exports.getOverstockItems = async (req, res, next) => {
    try {
        const items = await db.Item.findAll({
            include: [{
                model: db.Stock,
                attributes: ['availableQty', 'storeId'],
                required: true,
                include: [{ model: db.Store, attributes: ['id', 'name'] }],
                where: { storeId: { [Op.not]: null } }
            }],
            where: {
                overstockLevelQty: { [Op.not]: null }
            }
        });
        const overstockItems = [];
        items.forEach(item => {
            item.Stocks.forEach(stock => {
                if ((stock.availableQty || 0) >= (item.overstockLevelQty || 0)) {
                    overstockItems.push({
                        itemId: item.id,
                        itemName: item.name,
                        storeId: stock.storeId,
                        storeName: stock.Store ? stock.Store.name : null,
                        availableQty: stock.availableQty,
                        overstockLevelQty: item.overstockLevelQty
                    });
                }
            });
        });
        res.json({ overstockItems });
    } catch (err) {
        next(err);
    }
};
