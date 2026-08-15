const db = require('../models');
const { Op } = require('sequelize');

// GET /api/dashboard/summary
// GET /api/dashboard/main-details
exports.getMainDashboardDetails = async (req, res, next) => {
    try {
        const { locationId, period = 'monthly' } = req.query;
        const now = new Date();

        let startDate, previousStartDate, previousEndDate;

        if (period === 'daily') {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            previousStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
            previousEndDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
        } else if (period === 'weekly') {
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            previousStartDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
            previousEndDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else {
            // monthly (default)
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            previousEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        }

        // 1. Total Inventory Value (Current Stock)
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

        // 2. Sales & Collections for Period (Current period vs Previous period)
        const currentSales = await db.Invoice.sum('total', {
            where: {
                invoiceDate: { [Op.gte]: startDate },
                status: { [Op.ne]: 'Cancelled' },
                ...(locationId && { locationId })
            }
        }) || 0;

        const previousSales = await db.Invoice.sum('total', {
            where: {
                invoiceDate: { [Op.between]: [previousStartDate, previousEndDate] },
                status: { [Op.ne]: 'Cancelled' },
                ...(locationId && { locationId })
            }
        }) || 0;

        const salesGrowth = previousSales === 0 ? 0 : ((currentSales - previousSales) / previousSales) * 100;

        const currentCollections = await db.Receipt.sum('totalPaid', {
            where: {
                receiptDate: { [Op.gte]: startDate },
                isActive: { [Op.ne]: false },
                ...(locationId && { locationId })
            }
        }) || 0;

        const previousCollections = await db.Receipt.sum('totalPaid', {
            where: {
                receiptDate: { [Op.between]: [previousStartDate, previousEndDate] },
                isActive: { [Op.ne]: false },
                ...(locationId && { locationId })
            }
        }) || 0;

        const collectionsGrowth = previousCollections === 0 ? 0 : ((currentCollections - previousCollections) / previousCollections) * 100;

        // 3. Active Customers
        const activeCustomersCount = await db.Customer.count({
            col: 'id',
            where: {
                status: 'active',
                ...(locationId && { locationId })
            }
        });

        // 4. Total Orders (Sales Orders for the selected period)
        const totalOrdersCount = await db.SalesOrder.count({
            where: {
                orderDate: { [Op.gte]: startDate },
                status: { [Op.ne]: 'Cancelled' },
                ...(locationId && { locationId })
            }
        });
        const pendingOrdersCount = await db.SalesOrder.count({
            where: {
                orderDate: { [Op.gte]: startDate },
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
                    lorryId: null,
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

        // 6. Delivery Order & Sales Order Status breakdown for Period
        const deliveryStatusBreakdown = await db.DeliveryOrder.findAll({
            attributes: [
                'status',
                [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
            ],
            where: {
                createdAt: { [Op.gte]: startDate },
                ...(locationId && { locationId })
            },
            group: ['status']
        });

        const salesStatusBreakdown = await db.SalesOrder.findAll({
            attributes: [
                'status',
                [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
            ],
            where: {
                orderDate: { [Op.gte]: startDate },
                ...(locationId && { locationId })
            },
            group: ['status']
        });

        // 7. Top Inventory Items by Value
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

        // 8. Recent Orders (Last 5 Invoices for Period)
        const recentOrders = await db.Invoice.findAll({
            where: {
                invoiceDate: { [Op.gte]: startDate },
                ...(locationId && { locationId })
            },
            limit: 5,
            order: [['invoiceDate', 'DESC']],
            include: [{
                model: db.Customer,
                attributes: ['name']
            }]
        });

        // 9. Sales vs Collections Chart Data
        let chartLabels = [];
        let salesChartData = [];
        let collectionsChartData = [];

        if (period === 'daily') {
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
                const dateStr = d.toISOString().slice(0, 10);
                const label = d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
                chartLabels.push(label);

                const daySales = await db.Invoice.sum('total', {
                    where: {
                        invoiceDate: { [Op.between]: [`${dateStr} 00:00:00`, `${dateStr} 23:59:59`] },
                        status: { [Op.ne]: 'Cancelled' },
                        ...(locationId && { locationId })
                    }
                }) || 0;

                const dayCollections = await db.Receipt.sum('totalPaid', {
                    where: {
                        receiptDate: { [Op.between]: [`${dateStr} 00:00:00`, `${dateStr} 23:59:59`] },
                        isActive: { [Op.ne]: false },
                        ...(locationId && { locationId })
                    }
                }) || 0;

                salesChartData.push(daySales);
                collectionsChartData.push(dayCollections);
            }
        } else if (period === 'weekly') {
            for (let i = 3; i >= 0; i--) {
                const end = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
                const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
                const label = `${start.toLocaleDateString('en-US', { day: '2-digit', month: 'short' })} - ${end.toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}`;
                chartLabels.push(label);

                const weekSales = await db.Invoice.sum('total', {
                    where: {
                        invoiceDate: { [Op.between]: [start, end] },
                        status: { [Op.ne]: 'Cancelled' },
                        ...(locationId && { locationId })
                    }
                }) || 0;

                const weekCollections = await db.Receipt.sum('totalPaid', {
                    where: {
                        receiptDate: { [Op.between]: [start, end] },
                        isActive: { [Op.ne]: false },
                        ...(locationId && { locationId })
                    }
                }) || 0;

                salesChartData.push(weekSales);
                collectionsChartData.push(weekCollections);
            }
        } else {
            // monthly (default last 6 months)
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
                const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                chartLabels.push(label);

                const monthSales = await db.Invoice.sum('total', {
                    where: {
                        invoiceDate: { [Op.between]: [d, monthEnd] },
                        status: { [Op.ne]: 'Cancelled' },
                        ...(locationId && { locationId })
                    }
                }) || 0;

                const monthCollections = await db.Receipt.sum('totalPaid', {
                    where: {
                        receiptDate: { [Op.between]: [d, monthEnd] },
                        isActive: { [Op.ne]: false },
                        ...(locationId && { locationId })
                    }
                }) || 0;

                salesChartData.push(monthSales);
                collectionsChartData.push(monthCollections);
            }
        }

        res.json({
            period,
            summary: {
                totalInventoryValue: {
                    value: totalValue,
                    trend: 12.5
                },
                monthlySales: {
                    value: currentSales,
                    trend: parseFloat(salesGrowth.toFixed(1))
                },
                monthlyCollections: {
                    value: currentCollections,
                    trend: parseFloat(collectionsGrowth.toFixed(1))
                },
                activeCustomers: {
                    value: activeCustomersCount,
                    trend: 8.2
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
            salesVsCollections: {
                labels: chartLabels,
                sales: salesChartData,
                collections: collectionsChartData
            },
            deliveryOrderStatus: deliveryStatusBreakdown,
            salesOrderStatus: salesStatusBreakdown,
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
