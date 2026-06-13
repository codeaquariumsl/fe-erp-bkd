const { Op } = require('sequelize');
const { sequelize, Supplier, Receipt, ReceiptInvoice, Invoice, InvoiceItem, User, CustomerReturn, CreditNote, PurchaseOrder, PurchaseOrderItem } = require('../models');
const Stock = require('../models/stock');
const StockDetail = require('../models/stockDetail');
const Item = require('../models/item');
const Store = require('../models/store');
const Category = require('../models/category');
const Vehicle = require('../models/vehicle');
const GRN = require('../models/grn');
const GRNItem = require('../models/grnItem');
const SalesOrder = require('../models/salesOrder');
const SalesOrderItem = require('../models/salesOrderItem');
const DeliveryOrder = require('../models/deliveryOrder');
const DeliveryOrderItem = require('../models/deliveryOrderItem');
const Customer = require('../models/customer');
const Route = require('../models/route');
const { PettyCashPayment, PettyCashPaymentLine, PettyCashCategory } = require('../models');

// Stock Movement Summary Report
exports.getStockMovementSummaryReport = async (req, res) => {
    try {
        const { startDate, endDate, categoryId, itemId } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Start date and end date are required' });
        }

        // First, get the opening balances by calculating the total stock before start date
        const openingBalanceQuery = await sequelize.query(`
            SELECT 
                i.id as itemId,
                i.sku as itemCode,
                i.name as itemName,
                COALESCE(
                    (
                        SELECT SUM(
                            CASE 
                                WHEN sd.inOut = 'IN' THEN sd.qty
                                ELSE -sd.qty
                            END
                        )
                        FROM stock_details sd
                        JOIN stocks s ON sd.stockId = s.id
                        WHERE s.itemId = i.id
                        AND sd.date < :startDate
                    ),
                    0
                ) as openingBalance
            FROM items i
            ${categoryId ? 'WHERE i.categoryId = :categoryId' : ''}
            GROUP BY i.id, i.sku, i.name, i.color, i.country, i.weight
        `, {
            replacements: { startDate, categoryId },
            type: sequelize.QueryTypes.SELECT
        });

        // Get all movements during the period
        const movementsQuery = await sequelize.query(`
            SELECT 
                i.id as itemId,
                i.sku as itemCode,
                i.name as itemName,
                COALESCE(SUM(CASE WHEN sd.inOut = 'IN' THEN sd.qty ELSE 0 END), 0) as inQty,
                COALESCE(SUM(CASE WHEN sd.inOut = 'OUT' THEN sd.qty ELSE 0 END), 0) as outQty
            FROM items i
            LEFT JOIN stocks s ON s.itemId = i.id
            LEFT JOIN stock_details sd ON sd.stockId = s.id
                AND sd.date BETWEEN :startDate AND :endDate
            ${categoryId ? 'WHERE i.categoryId = :categoryId' : ''}
            GROUP BY i.id, i.sku, i.name, i.color, i.country, i.weight
        `, {
            replacements: { startDate, endDate, categoryId },
            type: sequelize.QueryTypes.SELECT
        });

        // Combine the results
        const result = openingBalanceQuery.map(item => {
            const movements = movementsQuery.find(m => m.itemId === item.itemId) || {
                inQty: 0,
                outQty: 0
            };

            const opening = parseFloat(item.openingBalance || 0);
            const inQty = parseFloat(movements.inQty || 0);
            const outQty = parseFloat(movements.outQty || 0);

            return {
                itemCode: item.itemCode,
                itemName: item.itemName,
                opening,
                inQty,
                outQty,
                closing: opening + inQty - outQty
            };
        });

        // Sort by item code
        result.sort((a, b) => a.itemCode.localeCompare(b.itemCode));

        res.json({
            filter: { startDate, endDate, categoryId, itemId },
            data: result
        });

    } catch (error) {
        console.error('Error in getStockMovementSummaryReport:', error);
        res.status(500).json({ error: error.message });
    }
};

// Stock Summary Report
exports.getStockSummaryReport = async (req, res) => {
    try {
        const stockSummary = await Stock.findAll({
            attributes: [
                'itemId',
                [sequelize.fn('SUM', sequelize.col('Stock.availableQty')), 'totalQty'],
                [sequelize.fn('SUM', sequelize.col('Stock.weight')), 'totalWeight'],
                [sequelize.fn('COUNT', sequelize.col('Stock.storeId')), 'storeCount']
            ],
            include: [
                { model: Item, include: [Category] },
                { model: Store }
            ],
            group: ['itemId'],
            having: sequelize.literal('SUM(Stock.availableQty) > 0'),
            order: [[sequelize.fn('SUM', sequelize.col('Stock.availableQty')), 'DESC']]
        });
        res.json(stockSummary);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Stock by Store Report
exports.getStockByStoreReport = async (req, res) => {
    try {
        const { storeId } = req.params;
        const { minQty } = req.query;

        const whereClause = { storeId };
        if (minQty) whereClause.availableQty = { [Op.gte]: parseInt(minQty) };

        const stockByStore = await Stock.findAll({
            where: whereClause,
            include: [
                { model: Item, include: [Category] },
                { model: Store }
            ],
            order: [['availableQty', 'DESC']]
        });
        res.json(stockByStore);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Stock by Item Report
exports.getStockByItemReport = async (req, res) => {
    try {
        const { itemId } = req.params;
        const stockByItem = await Stock.findAll({
            where: { itemId },
            include: [
                { model: Item, include: [Category] },
                { model: Store }
            ],
            order: [['availableQty', 'DESC']]
        });
        res.json(stockByItem);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// GRN Summary Report
exports.getGRNSummaryReport = async (req, res) => {
    try {
        const { startDate, endDate, status } = req.query;
        const whereClause = {};

        if (startDate && endDate) {
            whereClause.grnDate = { [Op.between]: [startDate, endDate] };
        }
        if (status) whereClause.status = status;

        const grnSummary = await GRN.findAll({
            where: whereClause,
            include: [
                { model: Supplier },
                { model: Store },
                { model: GRNItem, include: [Item] }
            ],
            order: [['grnDate', 'DESC']]
        });
        res.json(grnSummary);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// GRN by Date Range Report
exports.getGRNByDateRangeReport = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Start date and end date are required' });
        }

        const grnReport = await GRN.findAll({
            where: {
                grnDate: { [Op.between]: [startDate, endDate] }
            },
            include: [
                { model: Store },
                { model: Supplier },
                { model: GRNItem, include: [Item] }
            ],
            order: [['grnDate', 'DESC']]
        });
        res.json(grnReport);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// GRN Item Availability Report
exports.getGRNItemAvailabilityReport = async (req, res) => {
    try {
        const grnItemAvailability = await GRNItem.findAll({
            where: { availableQty: { [Op.gt]: 0 } },
            include: [
                { model: GRN, include: [Store] },
                { model: Item, include: [Category] }
            ],
            order: [['availableQty', 'DESC']]
        });
        res.json(grnItemAvailability);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// GIN Summary Report
exports.getGINSummaryReport = async (req, res) => {
    try {
        const { startDate, endDate, status } = req.query;
        const whereClause = {};

        if (startDate && endDate) {
            whereClause.ginDate = { [Op.between]: [startDate, endDate] };
        }
        if (status) whereClause.status = status;

        const ginSummary = await GIN.findAll({
            where: whereClause,
            include: [
                { model: Store, as: 'IssueStore' },
                { model: Store, as: 'TransferStore' },
                { model: GINItem, include: [Item, GRN] }
            ],
            order: [['ginDate', 'DESC']]
        });
        res.json(ginSummary);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// GIN by Date Range Report
exports.getGINByDateRangeReport = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Start date and end date are required' });
        }

        const ginReport = await GIN.findAll({
            where: {
                ginDate: { [Op.between]: [startDate, endDate] }
            },
            include: [
                { model: Store, as: 'IssueStore' },
                { model: Store, as: 'TransferStore' },
                { model: GINItem, include: [Item, GRN] }
            ],
            order: [['ginDate', 'DESC']]
        });
        res.json(ginReport);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// GIN Transfers Report
exports.getGINTransfersReport = async (req, res) => {
    try {
        const { issueStoreId, transferStoreId } = req.query;
        const whereClause = { status: 'Approved' };

        if (issueStoreId) whereClause.issueStoreId = issueStoreId;
        if (transferStoreId) whereClause.transferStoreId = transferStoreId;

        const ginTransfers = await GIN.findAll({
            where: whereClause,
            include: [
                { model: Store, as: 'IssueStore' },
                { model: Store, as: 'TransferStore' },
                { model: GINItem, include: [Item] }
            ],
            order: [['ginDate', 'DESC']]
        });
        res.json(ginTransfers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Stock Movements Report
// Query params: startDate, endDate, documentType (GIN|GRN|GRN-QC), inOut (IN|OUT)
exports.getStockMovementsReport = async (req, res) => {
    try {

        const { startDate, endDate, documentType, inOut } = req.query;
        const whereClause = {};

        if (startDate && endDate) {
            whereClause.date = { [Op.between]: [startDate, endDate] };
        }

        if (documentType) whereClause.documentType = documentType;
        if (inOut) whereClause.inOut = inOut;

        const stockMovements = await StockDetail.findAll({
            where: whereClause,
            include: [
                { model: Stock, include: [Item, Store] }
            ],
            order: [['date', 'DESC']]
        });
        res.json(stockMovements);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Item Stock Movements Report
exports.getItemStockMovementsReport = async (req, res) => {
    try {
        const { itemId } = req.params;
        const { startDate, endDate } = req.query;

        const whereClause = {};
        if (startDate && endDate) {
            whereClause.date = { [Op.between]: [startDate, endDate] };
        }

        const itemMovements = await StockDetail.findAll({
            where: whereClause,
            include: [
                {
                    model: Stock,
                    where: { itemId },
                    include: [Item, Store]
                }
            ],
            order: [['date', 'DESC']]
        });
        res.json(itemMovements);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Low Stock Items Report
exports.getLowStockItemsReport = async (req, res) => {
    try {
        const { threshold = 10 } = req.query;

        // validate storeId is not null
        const lowStockItems = await Stock.findAll({
            where: { availableQty: { [Op.lte]: parseInt(threshold) } },
            include: [
                { model: Item, include: [Category] },
                {
                    model: Store,
                    required: true // Left join since storeId can be null for lorry stock
                }
            ],
            order: [['availableQty', 'ASC']]
        });

        // Transform the results to handle lorry stock display
        const transformedResults = lowStockItems.map(stock => {
            const stockData = stock.toJSON();

            // If storeId is null but lorryId exists, use vehicle number as store name
            if (!stockData.storeId && stockData.lorryId && stockData.Lorry) {
                stockData.Store = {
                    id: stockData.lorryId,
                    name: `Vehicle: ${stockData.Lorry.vehicleNumber}`,
                    isVehicle: true
                };
            }

            return stockData;
        });

        res.json(transformedResults);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Expired Items Report
exports.getExpiredItemsReport = async (req, res) => {
    try {
        const currentDate = new Date();

        const expiredItems = await GRNItem.findAll({
            where: {
                expireDate: { [Op.lt]: currentDate },
                availableQty: { [Op.gt]: 0 }
            },
            include: [
                { model: GRN, include: [Store] },
                { model: Item, include: [Category] }
            ],
            order: [['expireDate', 'ASC']]
        });
        res.json(expiredItems);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Dashboard: Total Inventory Value from Approved GRNs
exports.getTotalInventoryValueFromApprovedGRNs = async (req, res) => {
    try {
        // Find all GRNItems where GRN.status = 'Approved'
        const approvedGRNItems = await GRNItem.findAll({
            include: [{
                model: GRN,
                where: { status: ['Approved', 'QC Checked'] },
                attributes: []
            }],
            attributes: [
                'id',
                'grnQty',
                'costPrice',
                [sequelize.literal('grnQty * costPrice'), 'itemValue']
            ]
        });

        // Calculate total value
        const totalValue = approvedGRNItems.reduce((sum, item) => {
            return sum + (item.grnQty * item.costPrice);
        }, 0);

        res.json({ totalInventoryValue: totalValue });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Inventory Valuation Report
exports.getInventoryValuationReport = async (req, res) => {
    try {
        const inventoryValuation = await sequelize.query(`
            SELECT 
                i.id as itemId,
                i.name as itemName,
                c.name as categoryName,
                SUM(s.availableQty) as totalQty,
                i.sellingPrice,
                (SUM(s.availableQty) * i.sellingPrice) as totalValue
            FROM items i
            JOIN categories c ON i.categoryId = c.id
            JOIN stocks s ON i.id = s.itemId
            WHERE s.availableQty > 0
            GROUP BY i.id, i.name, c.name, i.sellingPrice
            ORDER BY totalValue DESC
        `, { type: sequelize.QueryTypes.SELECT });

        res.json(inventoryValuation);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ===============================
// SALES REPORTS
// ===============================

// Sales Summary Report
exports.getSalesSummaryReport = async (req, res) => {
    try {
        const { startDate, endDate, customerId, status } = req.query;
        const whereClause = { status: { [Op.ne]: 'Cancelled' } };

        // Date filtering
        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            whereClause.invoiceDate = { [Op.between]: [start, end] };
        }

        // Other filters
        if (customerId) whereClause.customerId = customerId;
        if (status) whereClause.status = status;

        const salesSummary = await Invoice.findAll({
            where: whereClause,
            include: [
                {
                    model: Customer,
                    attributes: ['id', 'name', 'email', 'address']
                },
                {
                    model: InvoiceItem,
                    include: [{
                        model: Item,
                        include: [Category]
                    }]
                }
            ],
            order: [['invoiceDate', 'DESC']]
        });

        // Calculate summary statistics
        const summary = {
            totalInvoices: salesSummary.length,
            totalValue: 0,
            totalItems: 0,
            totalQuantity: 0,
            statusBreakdown: {},
            customerBreakdown: {}
        };

        salesSummary.forEach(invoice => {
            // Use the total from the invoice record
            const invoiceValue = parseFloat(invoice.total || 0);
            let invoiceQuantity = 0;

            invoice.InvoiceItems.forEach(item => {
                invoiceQuantity += item.qty;
            });

            summary.totalValue += invoiceValue;
            summary.totalItems += invoice.InvoiceItems.length;
            summary.totalQuantity += invoiceQuantity;

            // Status breakdown
            summary.statusBreakdown[invoice.status] = (summary.statusBreakdown[invoice.status] || 0) + 1;

            // Customer breakdown
            const customerName = invoice.Customer ? invoice.Customer.name : 'Unknown';
            if (!summary.customerBreakdown[customerName]) {
                summary.customerBreakdown[customerName] = {
                    count: 0,
                    totalValue: 0
                };
            }
            summary.customerBreakdown[customerName].count++;
            summary.customerBreakdown[customerName].totalValue += invoiceValue;
        });

        res.json({
            summary,
            invoices: salesSummary
        });

    } catch (error) {
        console.error('Error in getSalesSummaryReport:', error);
        res.status(500).json({ error: error.message });
    }
};

// Sales by Customer Report
exports.getSalesByCustomerReport = async (req, res) => {
    try {
        const { customerId } = req.params;
        const { startDate, endDate, status } = req.query;

        const whereClause = { customerId };
        if (startDate && endDate) {
            whereClause.invoiceDate = { [Op.between]: [startDate, endDate] };
        }
        if (status) whereClause.status = status;

        const customerSales = await Invoice.findAll({
            where: whereClause,
            include: [
                {
                    model: Customer,
                    attributes: ['id', 'name', 'email', 'address']
                },
                {
                    model: InvoiceItem,
                    include: [{
                        model: Item,
                        include: [Category]
                    }]
                }
            ],
            order: [['invoiceDate', 'DESC']]
        });

        // Calculate customer statistics
        const customerStats = {
            customerId: parseInt(customerId),
            customerName: customerSales.length > 0 ? customerSales[0].Customer.name : 'Unknown',
            totalInvoices: customerSales.length,
            totalValue: 0,
            totalQuantity: 0,
            averageInvoiceValue: 0,
            itemFrequency: {},
            monthlyBreakdown: {}
        };

        customerSales.forEach(invoice => {
            const invoiceValue = parseFloat(invoice.total || 0);
            let invoiceQuantity = 0;

            invoice.InvoiceItems.forEach(item => {
                invoiceQuantity += item.qty;

                // Item frequency
                const itemKey = `${item.Item.name}`;
                if (!customerStats.itemFrequency[itemKey]) {
                    customerStats.itemFrequency[itemKey] = {
                        totalQuantity: 0,
                        totalInvoices: 0,
                        avgPrice: 0
                    };
                }
                customerStats.itemFrequency[itemKey].totalQuantity += item.qty;
                customerStats.itemFrequency[itemKey].totalInvoices++;
                customerStats.itemFrequency[itemKey].avgPrice =
                    (customerStats.itemFrequency[itemKey].avgPrice + item.price) / 2;
            });

            customerStats.totalValue += invoiceValue;
            customerStats.totalQuantity += invoiceQuantity;

            // Monthly breakdown
            const month = new Date(invoice.invoiceDate).toISOString().slice(0, 7); // YYYY-MM
            if (!customerStats.monthlyBreakdown[month]) {
                customerStats.monthlyBreakdown[month] = {
                    count: 0,
                    value: 0,
                    quantity: 0
                };
            }
            customerStats.monthlyBreakdown[month].count++;
            customerStats.monthlyBreakdown[month].value += invoiceValue;
            customerStats.monthlyBreakdown[month].quantity += invoiceQuantity;
        });

        customerStats.averageInvoiceValue = customerStats.totalInvoices > 0 ?
            customerStats.totalValue / customerStats.totalInvoices : 0;

        res.json({
            customerStats,
            invoices: customerSales
        });

    } catch (error) {
        console.error('Error in getSalesByCustomerReport:', error);
        res.status(500).json({ error: error.message });
    }
};

// Sales by Item Report
exports.getSalesByItemReport = async (req, res) => {
    try {
        const { itemId } = req.params;
        const { startDate, endDate } = req.query;

        const whereClause = { itemId };

        // Build date filter for parent Invoice
        const invoiceWhere = {};
        if (startDate && endDate) {
            invoiceWhere.invoiceDate = { [Op.between]: [startDate, endDate] };
        }

        const itemSales = await InvoiceItem.findAll({
            where: whereClause,
            include: [
                {
                    model: Invoice,
                    where: invoiceWhere,
                    include: [
                        {
                            model: Customer,
                            attributes: ['id', 'name', 'email', 'contactNumber']
                        }
                    ]
                },
                {
                    model: Item,
                    include: [Category]
                }
            ],
            order: [[Invoice, 'invoiceDate', 'DESC']]
        });

        // Calculate item statistics
        const itemStats = {
            itemId: parseInt(itemId),
            itemName: itemSales.length > 0 ? `${itemSales[0].Item.name} (${itemSales[0].Item.sku})` : 'Unknown',
            totalInvoices: itemSales.length,
            totalQuantitySold: 0,
            totalRevenue: 0,
            averagePrice: 0,
            maxPrice: 0,
            minPrice: Number.MAX_SAFE_INTEGER,
            customerFrequency: {},
            monthlyBreakdown: {}
        };

        itemSales.forEach(saleItem => {
            const revenue = parseFloat(saleItem.total || 0);

            itemStats.totalQuantitySold += saleItem.qty;
            itemStats.totalRevenue += revenue;

            // Price tracking
            itemStats.maxPrice = Math.max(itemStats.maxPrice, saleItem.price);
            itemStats.minPrice = Math.min(itemStats.minPrice, saleItem.price);

            // Customer frequency
            const customerName = saleItem.Invoice.Customer ?
                saleItem.Invoice.Customer.name : 'Unknown';
            if (!itemStats.customerFrequency[customerName]) {
                itemStats.customerFrequency[customerName] = {
                    count: 0,
                    totalQuantity: 0,
                    totalSpent: 0
                };
            }
            itemStats.customerFrequency[customerName].count++;
            itemStats.customerFrequency[customerName].totalQuantity += saleItem.qty;
            itemStats.customerFrequency[customerName].totalSpent += revenue;

            // Monthly breakdown
            const month = new Date(saleItem.Invoice.invoiceDate).toISOString().slice(0, 7);
            if (!itemStats.monthlyBreakdown[month]) {
                itemStats.monthlyBreakdown[month] = {
                    count: 0,
                    quantity: 0,
                    revenue: 0
                };
            }
            itemStats.monthlyBreakdown[month].count++;
            itemStats.monthlyBreakdown[month].quantity += saleItem.qty;
            itemStats.monthlyBreakdown[month].revenue += revenue;
        });

        itemStats.averagePrice = itemStats.totalInvoices > 0 ?
            itemStats.totalRevenue / itemStats.totalQuantitySold : 0;

        if (itemStats.minPrice === Number.MAX_SAFE_INTEGER) {
            itemStats.minPrice = 0;
        }

        res.json({
            itemStats,
            sales: itemSales
        });

    } catch (error) {
        console.error('Error in getSalesByItemReport:', error);
        res.status(500).json({ error: error.message });
    }
};

// Sales by Date Range Report
exports.getSalesByDateRangeReport = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Start date and end date are required' });
        }

        const salesByDate = await Invoice.findAll({
            where: {
                invoiceDate: { [Op.between]: [startDate, endDate] }
            },
            include: [
                {
                    model: Customer,
                    attributes: ['id', 'name', 'email']
                },
                {
                    model: InvoiceItem,
                    include: [{
                        model: Item,
                        include: [Category]
                    }]
                }
            ],
            order: [['invoiceDate', 'DESC']]
        });

        // Group by date
        const dailyBreakdown = {};
        let totalRevenue = 0;
        let totalInvoices = 0;
        let totalQuantity = 0;

        salesByDate.forEach(invoice => {
            const date = new Date(invoice.invoiceDate).toISOString().split('T')[0]; // YYYY-MM-DD

            if (!dailyBreakdown[date]) {
                dailyBreakdown[date] = {
                    count: 0,
                    revenue: 0,
                    quantity: 0,
                    uniqueCustomers: new Set(),
                    topItems: {}
                };
            }

            const invoiceRevenue = parseFloat(invoice.total || 0);
            let invoiceQuantity = 0;

            invoice.InvoiceItems.forEach(item => {
                const itemRevenue = parseFloat(item.total || 0);
                invoiceQuantity += item.qty;

                // Track top items per day
                const itemKey = `${item.Item.color + ' ' + item.Item.name + ' ' + item.Item.country + ' (' + item.Item.weight + 'kg)'}`;
                if (!dailyBreakdown[date].topItems[itemKey]) {
                    dailyBreakdown[date].topItems[itemKey] = {
                        quantity: 0,
                        revenue: 0
                    };
                }
                dailyBreakdown[date].topItems[itemKey].quantity += item.qty;
                dailyBreakdown[date].topItems[itemKey].revenue += itemRevenue;
            });

            dailyBreakdown[date].count++;
            dailyBreakdown[date].revenue += invoiceRevenue;
            dailyBreakdown[date].quantity += invoiceQuantity;

            if (invoice.Customer) {
                dailyBreakdown[date].uniqueCustomers.add(invoice.Customer.id);
            }

            totalRevenue += invoiceRevenue;
            totalInvoices++;
            totalQuantity += invoiceQuantity;
        });

        // Convert sets to counts
        Object.keys(dailyBreakdown).forEach(date => {
            dailyBreakdown[date].uniqueCustomers = dailyBreakdown[date].uniqueCustomers.size;
        });

        res.json({
            summary: {
                dateRange: { startDate, endDate },
                totalRevenue,
                totalInvoices,
                totalQuantity,
                averageInvoiceValue: totalInvoices > 0 ? totalRevenue / totalInvoices : 0,
                averageDailyRevenue: Object.keys(dailyBreakdown).length > 0 ?
                    totalRevenue / Object.keys(dailyBreakdown).length : 0
            },
            dailyBreakdown,
            invoices: salesByDate
        });

    } catch (error) {
        console.error('Error in getSalesByDateRangeReport:', error);
        res.status(500).json({ error: error.message });
    }
};

// Top Selling Items Report
exports.getTopSellingItemsReport = async (req, res) => {
    try {
        const { startDate, endDate, limit = 20 } = req.query;

        const invoiceWhere = {};
        if (startDate && endDate) {
            invoiceWhere.invoiceDate = { [Op.between]: [startDate, endDate] };
        }

        const topItems = await InvoiceItem.findAll({
            attributes: [
                'itemId',
                [sequelize.fn('SUM', sequelize.col('InvoiceItem.qty')), 'totalQuantitySold'],
                [sequelize.fn('SUM', sequelize.col('InvoiceItem.total')), 'totalRevenue'],
                [sequelize.fn('COUNT', sequelize.col('InvoiceItem.id')), 'totalInvoices'],
                [sequelize.fn('AVG', sequelize.col('InvoiceItem.price')), 'averagePrice']
            ],
            include: [
                {
                    model: Invoice,
                    where: invoiceWhere,
                    attributes: []
                },
                {
                    model: Item,
                    include: [Category]
                }
            ],
            group: ['itemId', 'Item.id', 'Item.weight', 'Item.categoryId', 'Item.Category.id'],
            order: [[sequelize.fn('SUM', sequelize.col('InvoiceItem.qty')), 'DESC']],
            limit: parseInt(limit)
        });

        // Transform the response
        const transformedItems = topItems.map(item => {
            const itemData = item.toJSON();
            return {
                ...itemData,
                totalRevenue: parseFloat(itemData.totalRevenue || 0),
                weightSold: itemData.totalQuantitySold * itemData.Item.weight
            };
        });

        res.json(transformedItems);

    } catch (error) {
        console.error('Error in getTopSellingItemsReport:', error);
        res.status(500).json({ error: error.message });
    }
};

// Bin Card Report
exports.getBinCardReport = async (req, res) => {
    try {
        const { itemId, startDate, endDate, locationId } = req.query;

        // Validate required parameters
        if (!itemId) {
            return res.status(400).json({ error: 'Item ID is required' });
        }

        // Build where clause
        const whereClause = {};
        if (startDate && endDate) {
            whereClause.date = { [Op.between]: [startDate, endDate] };
        }

        // Find all stock records for this item
        const stockIds = await Stock.findAll({
            where: {
                itemId,
                ...(locationId ? { storeId: locationId } : {})
            },
            attributes: ['id']
        }).then(stocks => stocks.map(stock => stock.id));

        if (stockIds.length === 0) {
            return res.status(404).json({ error: 'No stock records found for this item' });
        }

        // Get all transactions for these stock records
        const transactions = await StockDetail.findAll({
            where: {
                stockId: { [Op.in]: stockIds },
                ...whereClause
            },
            include: [{
                model: Stock,
                include: [
                    { model: Item },
                    { model: Store }
                ]
            }],
            order: [['date', 'ASC'], ['id', 'ASC']]  // Ensure chronological order
        });

        // Calculate running balance
        let balance = 0;
        const formattedData = transactions.map(transaction => {
            const inQty = transaction.inOut === 'IN' ? transaction.qty : 0;
            const outQty = transaction.inOut === 'OUT' ? transaction.qty : 0;

            balance = balance + inQty - outQty;

            return {
                date: transaction.date,
                refNo: `${transaction.documentType}-${transaction.documentId}`,
                description: transaction.remark || `${transaction.documentType} ${transaction.inOut}`,
                inQty,
                outQty,
                balance
            };
        });

        // Prepare response
        const response = {
            itemId: parseInt(itemId),
            itemName: transactions.length > 0 ?
                `${transactions[0].Stock.Item.name}` :
                'Unknown Item',
            startDate: startDate || transactions[0]?.date,
            endDate: endDate || transactions[transactions.length - 1]?.date,
            location: locationId ?
                (transactions.find(t => t.Stock.Store)?.Stock.Store?.name || 'Unknown Location') :
                'All Locations',
            data: formattedData
        };

        res.json(response);
    } catch (error) {
        console.error('Error in getBinCardReport:', error);
        res.status(500).json({ error: error.message });
    }
};

// ===============================
// ENHANCED STOCK MOVEMENT REPORTS
// ===============================

// Detailed Item Stock Movement Report
exports.getDetailedItemStockMovementReport = async (req, res) => {
    try {
        const { itemId } = req.params;
        const { startDate, endDate, storeId, documentType } = req.query;

        const whereClause = {};
        if (startDate && endDate) {
            whereClause.date = { [Op.between]: [startDate, endDate] };
        }
        if (documentType) whereClause.documentType = documentType;

        const stockWhere = { itemId };
        if (storeId) stockWhere.storeId = storeId;

        const movements = await StockDetail.findAll({
            where: whereClause,
            include: [
                {
                    model: Stock,
                    where: stockWhere,
                    include: [
                        {
                            model: Item,
                            include: [Category]
                        },
                        {
                            model: Store,
                            required: false
                        },
                        {
                            model: Vehicle,
                            as: 'Lorry',
                            required: false
                        }
                    ]
                }
            ],
            order: [['date', 'DESC'], ['createdAt', 'DESC']]
        });

        // Calculate movement statistics
        const stats = {
            itemId: parseInt(itemId),
            itemName: movements.length > 0 ?
                `${movements[0].Stock.Item.name}` : 'Unknown',
            totalMovements: movements.length,
            totalInbound: 0,
            totalOutbound: 0,
            netMovement: 0,
            movementsByType: {},
            movementsByStore: {},
            dailyMovements: {}
        };

        movements.forEach(movement => {
            const qty = movement.qty;

            if (movement.inOut === 'IN') {
                stats.totalInbound += qty;
            } else {
                stats.totalOutbound += qty;
            }

            // Movement by document type
            if (!stats.movementsByType[movement.documentType]) {
                stats.movementsByType[movement.documentType] = {
                    inbound: 0,
                    outbound: 0,
                    count: 0
                };
            }
            stats.movementsByType[movement.documentType].count++;
            if (movement.inOut === 'IN') {
                stats.movementsByType[movement.documentType].inbound += qty;
            } else {
                stats.movementsByType[movement.documentType].outbound += qty;
            }

            // Movement by store/location
            const locationKey = movement.Stock.Store ?
                movement.Stock.Store.name :
                (movement.Stock.Lorry ? `Vehicle: ${movement.Stock.Lorry.vehicleNumber}` : 'Unknown');

            if (!stats.movementsByStore[locationKey]) {
                stats.movementsByStore[locationKey] = {
                    inbound: 0,
                    outbound: 0,
                    count: 0
                };
            }
            stats.movementsByStore[locationKey].count++;
            if (movement.inOut === 'IN') {
                stats.movementsByStore[locationKey].inbound += qty;
            } else {
                stats.movementsByStore[locationKey].outbound += qty;
            }

            // Daily movements
            const date = new Date(movement.date).toISOString().split('T')[0];
            if (!stats.dailyMovements[date]) {
                stats.dailyMovements[date] = {
                    inbound: 0,
                    outbound: 0,
                    movements: 0
                };
            }
            stats.dailyMovements[date].movements++;
            if (movement.inOut === 'IN') {
                stats.dailyMovements[date].inbound += qty;
            } else {
                stats.dailyMovements[date].outbound += qty;
            }
        });

        stats.netMovement = stats.totalInbound - stats.totalOutbound;

        res.json({
            stats,
            movements
        });

    } catch (error) {
        console.error('Error in getDetailedItemStockMovementReport:', error);
        res.status(500).json({ error: error.message });
    }
};

// Stock Movement Summary by Store Report
exports.getStockMovementByStoreReport = async (req, res) => {
    try {
        const { storeId } = req.params;
        const { startDate, endDate, documentType, itemId } = req.query;

        const whereClause = {};
        if (startDate && endDate) {
            whereClause.date = { [Op.between]: [startDate, endDate] };
        }
        if (documentType) whereClause.documentType = documentType;

        const stockWhere = { storeId };
        if (itemId) stockWhere.itemId = itemId;

        const movements = await StockDetail.findAll({
            where: whereClause,
            include: [
                {
                    model: Stock,
                    where: stockWhere,
                    include: [
                        {
                            model: Item,
                            include: [Category]
                        },
                        {
                            model: Store
                        }
                    ]
                }
            ],
            order: [['date', 'DESC']]
        });

        // Group by item
        const itemMovements = {};
        let totalInbound = 0;
        let totalOutbound = 0;

        movements.forEach(movement => {
            const item = movement.Stock.Item;
            const itemKey = `${item.id}`;

            if (!itemMovements[itemKey]) {
                itemMovements[itemKey] = {
                    itemId: item.id,
                    itemName: `${item.name} (${item.barcode})`,
                    category: item.Category ? item.Category.name : 'Unknown',
                    inbound: 0,
                    outbound: 0,
                    netMovement: 0,
                    movementCount: 0,
                    lastMovement: null
                };
            }

            itemMovements[itemKey].movementCount++;
            itemMovements[itemKey].lastMovement = movement.date;

            if (movement.inOut === 'IN') {
                itemMovements[itemKey].inbound += movement.qty;
                totalInbound += movement.qty;
            } else {
                itemMovements[itemKey].outbound += movement.qty;
                totalOutbound += movement.qty;
            }

            itemMovements[itemKey].netMovement =
                itemMovements[itemKey].inbound - itemMovements[itemKey].outbound;
        });

        const storeName = movements.length > 0 && movements[0].Stock.Store ?
            movements[0].Stock.Store.name : 'Unknown Store';

        res.json({
            storeInfo: {
                storeId: parseInt(storeId),
                storeName,
                totalInbound,
                totalOutbound,
                netMovement: totalInbound - totalOutbound,
                totalMovements: movements.length,
                uniqueItems: Object.keys(itemMovements).length
            },
            itemMovements: Object.values(itemMovements),
            movements
        });

    } catch (error) {
        console.error('Error in getStockMovementByStoreReport:', error);
        res.status(500).json({ error: error.message });
    }
};

// Stock Movement Trends Report
exports.getStockMovementTrendsReport = async (req, res) => {
    try {
        const { startDate, endDate, groupBy = 'day' } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Start date and end date are required' });
        }

        const movements = await StockDetail.findAll({
            where: {
                date: { [Op.between]: [startDate, endDate] }
            },
            include: [
                {
                    model: Stock,
                    include: [
                        {
                            model: Item,
                            include: [Category]
                        },
                        {
                            model: Store,
                            required: false
                        }
                    ]
                }
            ],
            order: [['date', 'ASC']]
        });

        // Group movements by time period
        const trends = {};

        movements.forEach(movement => {
            let periodKey;
            const date = new Date(movement.date);

            switch (groupBy) {
                case 'month':
                    periodKey = date.toISOString().slice(0, 7); // YYYY-MM
                    break;
                case 'week':
                    const weekStart = new Date(date);
                    weekStart.setDate(date.getDate() - date.getDay());
                    periodKey = weekStart.toISOString().split('T')[0];
                    break;
                case 'day':
                default:
                    periodKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
                    break;
            }

            if (!trends[periodKey]) {
                trends[periodKey] = {
                    period: periodKey,
                    totalInbound: 0,
                    totalOutbound: 0,
                    netMovement: 0,
                    movementCount: 0,
                    documentTypes: {},
                    topCategories: {}
                };
            }

            trends[periodKey].movementCount++;

            if (movement.inOut === 'IN') {
                trends[periodKey].totalInbound += movement.qty;
            } else {
                trends[periodKey].totalOutbound += movement.qty;
            }

            trends[periodKey].netMovement =
                trends[periodKey].totalInbound - trends[periodKey].totalOutbound;

            // Document type breakdown
            if (!trends[periodKey].documentTypes[movement.documentType]) {
                trends[periodKey].documentTypes[movement.documentType] = 0;
            }
            trends[periodKey].documentTypes[movement.documentType]++;

            // Category breakdown
            const category = movement.Stock.Item.Category ?
                movement.Stock.Item.Category.name : 'Unknown';
            if (!trends[periodKey].topCategories[category]) {
                trends[periodKey].topCategories[category] = 0;
            }
            trends[periodKey].topCategories[category] += movement.qty;
        });

        res.json({
            filter: { startDate, endDate, groupBy },
            trends: Object.values(trends).sort((a, b) => a.period.localeCompare(b.period))
        });

    } catch (error) {
        console.error('Error in getStockMovementTrendsReport:', error);
        res.status(500).json({ error: error.message });
    }
};

// Salesperson Commission Report
exports.getSalespersonCommissionReport = async (req, res) => {
    try {
        const { date, salesPersonId, locationId } = req.query;

        if (!date) {
            return res.status(400).json({ error: 'Date is required' });
        }

        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);

        const startDate = new Date(date);
        startDate.setDate(startDate.getDate() - 60);
        startDate.setHours(0, 0, 0, 0);

        const invoiceWhere = {};
        if (salesPersonId) {
            invoiceWhere.idSalesPerson = salesPersonId;
        }

        const receiptWhere = {
            receiptDate: { [Op.between]: [startDate, endDate] },
            isActive: true
        };
        if (locationId) {
            receiptWhere.locationId = locationId;
        }

        const receipts = await Receipt.findAll({
            where: receiptWhere,
            include: [
                {
                    model: ReceiptInvoice,
                    as: 'invoices',
                    include: [
                        {
                            model: Invoice,
                            as: 'invoice',
                            where: invoiceWhere,
                            required: true,
                            include: [
                                {
                                    model: User,
                                    as: 'SalesPerson',
                                    attributes: ['id', 'fullName']
                                }
                            ]
                        }
                    ]
                }
            ]
        });

        const salespersonData = {};

        receipts.forEach(receipt => {
            if (!receipt.invoices) return;

            receipt.invoices.forEach(ri => {
                if (!ri.invoice || !ri.invoice.SalesPerson) return;

                const sp = ri.invoice.SalesPerson;
                const spId = sp.id;
                const spName = sp.fullName;

                const rDate = new Date(receipt.receiptDate);
                rDate.setHours(0, 0, 0, 0);
                const iDate = new Date(ri.invoice.invoiceDate);
                iDate.setHours(0, 0, 0, 0);

                // Calculate difference in days
                const diffTime = rDate.getTime() - iDate.getTime();
                const agingDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

                // If it's a negative aging (receipt before invoice), we still count it but treat it as 0 days aging (100% factor)
                const effectiveAgingDays = Math.max(0, agingDays);

                // We only care about invoices up to 60 days old
                if (effectiveAgingDays > 60) return;

                if (!salespersonData[spId]) {
                    salespersonData[spId] = {
                        salesPersonId: spId,
                        salesPersonName: spName,
                        totalActualCollection: 0,
                        totalEligibleCollection: 0,
                        totalCommission: 0,
                        commissionRate: 0,
                        details: []
                    };
                }

                let agingFactor = 0;
                if (effectiveAgingDays <= 45) {
                    agingFactor = 1.0;
                } else if (effectiveAgingDays <= 60) {
                    agingFactor = 0.5;
                }

                const paidAmount = parseFloat(ri.paidAmount || 0);
                const eligibleAmount = paidAmount * agingFactor;

                salespersonData[spId].totalActualCollection += paidAmount;
                salespersonData[spId].totalEligibleCollection += eligibleAmount;

                salespersonData[spId].details.push({
                    receiptNo: receipt.receiptNo,
                    receiptDate: receipt.receiptDate,
                    invoiceNo: ri.invoice.invoiceNumber,
                    invoiceDate: ri.invoice.invoiceDate,
                    agingDays: effectiveAgingDays,
                    agingFactor,
                    paidAmount,
                    eligibleAmount
                });
            });
        });

        // Apply Commission Slabs based on totalEligibleCollection for this specific date
        // NOTE: Since the report is for one day, slab thresholds (1M, 3M, etc.) 
        // will be applied to that day's eligible collection.
        const results = Object.values(salespersonData).map(data => {
            const total = data.totalEligibleCollection;
            let commission = 0;
            let rate = 0;

            if (total >= 15000000) {
                rate = 1.25;
                commission = total * 0.0125;
            } else if (total >= 7000000) {
                rate = 1.00;
                commission = total * 0.01;
            } else if (total >= 3000000) {
                rate = 0.75;
                commission = total * 0.0075;
            } else if (total >= 1000000) {
                rate = 0; // Flat amount
                commission = 10000;
            } else {
                rate = 0;
                commission = 0;
            }

            data.totalCommission = commission;
            data.commissionRate = rate;

            return data;
        });

        res.json({
            reportDate: date,
            period: { startDate, endDate },
            filter: { salesPersonId, locationId },
            data: results
        });

    } catch (error) {
        console.error('Error in getSalespersonCommissionReport:', error);
        res.status(500).json({ error: error.message });
    }
};

// Sales by SalesPerson Report
exports.getSalesBySalesPersonReport = async (req, res) => {
    try {
        const { salesPersonId } = req.params;
        const { startDate, endDate, status } = req.query;

        const whereClause = {
            idSalesPerson: salesPersonId,
            status: { [Op.ne]: 'Cancelled' }
        };

        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            whereClause.invoiceDate = { [Op.between]: [start, end] };
        }

        if (status) {
            whereClause.status = status;
        }

        const salesPersonSales = await Invoice.findAll({
            where: whereClause,
            include: [
                {
                    model: Customer,
                    attributes: ['id', 'name', 'email', 'address', 'contactNumber']
                },
                {
                    model: User,
                    as: 'SalesPerson',
                    attributes: ['id', 'fullName', 'email']
                },
                {
                    model: InvoiceItem,
                    include: [{
                        model: Item,
                        include: [Category]
                    }]
                }
            ],
            order: [['invoiceDate', 'DESC']]
        });

        // Calculate statistics
        const salesPersonStats = {
            salesPersonId: parseInt(salesPersonId),
            salesPersonName: 'Unknown',
            totalInvoices: salesPersonSales.length,
            totalValue: 0,
            totalQuantity: 0,
            averageInvoiceValue: 0,
            itemFrequency: {},
            customerFrequency: {},
            monthlyBreakdown: {}
        };

        if (salesPersonSales.length > 0 && salesPersonSales[0].SalesPerson) {
            salesPersonStats.salesPersonName = salesPersonSales[0].SalesPerson.fullName;
        }

        salesPersonSales.forEach(invoice => {
            const invoiceValue = parseFloat(invoice.total || 0);
            let invoiceQuantity = 0;

            if (invoice.InvoiceItems) {
                invoice.InvoiceItems.forEach(item => {
                    const qty = parseFloat(item.qty || 0);
                    invoiceQuantity += qty;

                    if (item.Item) {
                        // Item frequency
                        const itemKey = `${item.Item.name} (${item.Item.sku})`;
                        if (!salesPersonStats.itemFrequency[itemKey]) {
                            salesPersonStats.itemFrequency[itemKey] = {
                                totalQuantity: 0,
                                totalRevenue: 0,
                                count: 0
                            };
                        }
                        salesPersonStats.itemFrequency[itemKey].totalQuantity += qty;
                        salesPersonStats.itemFrequency[itemKey].totalRevenue += parseFloat(item.total || 0);
                        salesPersonStats.itemFrequency[itemKey].count++;
                    }
                });
            }

            salesPersonStats.totalValue += invoiceValue;
            salesPersonStats.totalQuantity += invoiceQuantity;

            // Customer frequency
            const customerName = invoice.Customer ? invoice.Customer.name : 'Unknown';
            if (!salesPersonStats.customerFrequency[customerName]) {
                salesPersonStats.customerFrequency[customerName] = {
                    count: 0,
                    totalValue: 0
                };
            }
            salesPersonStats.customerFrequency[customerName].count++;
            salesPersonStats.customerFrequency[customerName].totalValue += invoiceValue;

            // Monthly breakdown
            const month = invoice.invoiceDate ? new Date(invoice.invoiceDate).toISOString().slice(0, 7) : 'Unknown'; // YYYY-MM
            if (!salesPersonStats.monthlyBreakdown[month]) {
                salesPersonStats.monthlyBreakdown[month] = {
                    count: 0,
                    value: 0,
                    quantity: 0
                };
            }
            salesPersonStats.monthlyBreakdown[month].count++;
            salesPersonStats.monthlyBreakdown[month].value += invoiceValue;
            salesPersonStats.monthlyBreakdown[month].quantity += invoiceQuantity;
        });

        salesPersonStats.averageInvoiceValue = salesPersonStats.totalInvoices > 0 ?
            salesPersonStats.totalValue / salesPersonStats.totalInvoices : 0;

        res.json({
            salesPersonStats,
            invoices: salesPersonSales
        });

    } catch (error) {
        console.error('Error in getSalesBySalesPersonReport:', error);
        res.status(500).json({ error: error.message });
    }
};

// General Sales Report
exports.getGeneralSalesReport = async (req, res) => {
    try {
        const { startDate, endDate, customerId, salesRepId } = req.query;
        const whereClause = { status: { [Op.ne]: 'Cancelled' } };

        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            whereClause.invoiceDate = { [Op.between]: [start, end] };
        }
        if (customerId) {
            const customer = await Customer.findByPk(customerId);
            if (customer && customer.parentId === null) {
                const childCustomers = await Customer.findAll({
                    where: { parentId: customerId },
                    attributes: ['id']
                });
                const customerIds = [parseInt(customerId), ...childCustomers.map(c => c.id)];
                whereClause.customerId = { [Op.in]: customerIds };
            } else {
                whereClause.customerId = customerId;
            }
        }
        if (salesRepId) whereClause.idSalesPerson = salesRepId;

        const invoices = await Invoice.findAll({
            where: whereClause,
            include: [
                { model: Customer },
                { model: SalesOrder },
                { model: User, as: 'SalesPerson' }
            ],
            order: [['invoiceDate', 'DESC']]
        });

        // Process for report
        let totalSales = 0;
        let totalOutstanding = 0;
        let totalOverDue = 0;

        const reportData = invoices.map(inv => {
            const outstanding = parseFloat(inv.total) - (parseFloat(inv.paidAmount || 0) + parseFloat(inv.setoffAmount || 0));

            // Calculate Due Date
            const creditPeriod = inv.Customer?.creditPeriod || 0;
            const dueDate = new Date(inv.invoiceDate);
            dueDate.setDate(dueDate.getDate() + creditPeriod);

            // Calculate Overdue
            const isOverDue = new Date() > dueDate && outstanding > 0;
            const overDueValue = isOverDue ? outstanding : 0;

            totalSales += parseFloat(inv.total);
            totalOutstanding += parseFloat(outstanding);
            totalOverDue += parseFloat(overDueValue);

            return {
                id: inv.id,
                invoiceNumber: inv.invoiceNumber,
                customerName: inv.Customer?.name || 'Unknown',
                location: inv.Customer?.address || '',
                poNo: inv.SalesOrder?.poNumber || '',
                invoiceDate: inv.invoiceDate,
                dueDate: dueDate,
                invValue: parseFloat(inv.total),
                paidAmount: parseFloat(inv.paidAmount || 0),
                returnedAmount: parseFloat(inv.setoffAmount || 0),
                outstanding: parseFloat(outstanding),
                overDueValue: parseFloat(overDueValue),
                salesRep: inv.SalesPerson?.fullName || 'Unknown'
            };
        });

        res.json({
            summary: {
                totalSales: parseFloat(totalSales).toFixed(2),
                totalOutstanding: parseFloat(totalOutstanding).toFixed(2),
                totalOverDue: parseFloat(totalOverDue).toFixed(2)
            },
            details: reportData
        });

    } catch (error) {
        console.error('Error in getGeneralSalesReport:', error);
        res.status(500).json({ error: error.message });
    }
};

// Rep Wise Sales Report
exports.getRepWiseSalesReport = async (req, res) => {
    try {
        const { startDate, endDate, salesRepId } = req.query;
        const whereClause = { status: { [Op.ne]: 'Cancelled' } };

        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            whereClause.invoiceDate = { [Op.between]: [start, end] };
        }
        if (salesRepId) whereClause.idSalesPerson = salesRepId;

        const invoices = await Invoice.findAll({
            where: whereClause,
            include: [
                { model: Customer },
                { model: SalesOrder },
                { model: User, as: 'SalesPerson' }
            ],
            order: [['invoiceDate', 'DESC']]
        });

        // Fetch all approved credits for these invoices
        const invoiceIds = invoices.map(inv => inv.id);
        const returns = await CustomerReturn.findAll({
            where: { invoiceId: { [Op.in]: invoiceIds }, status: 'Approved' }
        });
        const creditNotes = await CreditNote.findAll({
            where: { invoiceId: { [Op.in]: invoiceIds }, status: 'Approved' }
        });

        const repData = {};

        invoices.forEach(inv => {
            const repName = inv.SalesPerson?.fullName || 'Unknown';
            const repId = inv.SalesPerson?.id || 0;

            if (!repData[repId]) {
                repData[repId] = {
                    salesRepId: repId,
                    salesRepName: repName,
                    totalSales: 0,
                    totalOutstanding: 0,
                    totalOverDue: 0,
                    invoices: []
                };
            }

            let outstanding = parseFloat(inv.total) - (parseFloat(inv.paidAmount || 0) + parseFloat(inv.setoffAmount || 0));

            // Subtract linked credits
            returns.filter(r => r.invoiceId === inv.id).forEach(r => {
                const available = (parseFloat(r.totalAmount) || 0) - (parseFloat(r.utilizedAmount) || 0);
                outstanding -= Math.max(0, available);
            });
            creditNotes.filter(cn => cn.invoiceId === inv.id).forEach(cn => {
                const available = (parseFloat(cn.total) || 0) - (parseFloat(cn.appliedAmount) || 0);
                outstanding -= Math.max(0, available);
            });

            outstanding = Math.max(0, outstanding);

            // Calculate Due Date
            const creditPeriod = inv.Customer?.creditPeriod || 0;
            const dueDate = new Date(inv.invoiceDate);
            dueDate.setDate(dueDate.getDate() + creditPeriod);

            // Calculate Overdue
            const isOverDue = new Date() > dueDate && outstanding > 0;
            const overDueValue = isOverDue ? outstanding : 0;

            repData[repId].totalSales += parseFloat(inv.total);
            repData[repId].totalOutstanding += parseFloat(outstanding);
            repData[repId].totalOverDue += parseFloat(overDueValue);

            repData[repId].invoices.push({
                id: inv.id,
                invoiceNumber: inv.invoiceNumber,
                customerName: inv.Customer?.name || 'Unknown',
                location: inv.Customer?.address || '',
                poNo: inv.SalesOrder?.poNumber || '',
                invoiceDate: inv.invoiceDate,
                dueDate: dueDate,
                invValue: parseFloat(inv.total),
                outstanding: parseFloat(outstanding.toFixed(2)),
                overDueValue: parseFloat(overDueValue.toFixed(2))
            });
        });

        res.json(Object.values(repData));

    } catch (error) {
        console.error('Error in getRepWiseSalesReport:', error);
        res.status(500).json({ error: error.message });
    }
};

// Expenses Report
exports.getExpensesReport = async (req, res) => {
    try {
        const { startDate, endDate, categoryId } = req.query;
        const whereClause = {};

        if (startDate && endDate) {
            whereClause.paymentDate = { [Op.between]: [startDate, endDate] };
        }

        const includeClause = [
            {
                model: PettyCashPaymentLine,
                as: 'Lines',
                include: [
                    {
                        model: PettyCashCategory,
                        as: 'Category'
                    }
                ]
            }
        ];

        const payments = await PettyCashPayment.findAll({
            where: whereClause,
            include: includeClause,
            order: [['paymentDate', 'DESC']]
        });

        // Flatten data
        let expenses = [];

        payments.forEach(payment => {
            if (payment.Lines && payment.Lines.length > 0) {
                payment.Lines.forEach(line => {
                    const categoryName = line.Category?.name || 'Uncategorized';

                    if (categoryId && line.Category?.id != categoryId) {
                        return;
                    }

                    expenses.push({
                        paymentId: payment.id,
                        date: payment.paymentDate,
                        billNumber: payment.paymentNumber,
                        category: categoryName,
                        description: line.description || payment.description,
                        amount: line.amount
                    });
                });
            } else {
                // Handle payments without lines if any (shouldn't happen ideally)
                if (!categoryId) {
                    expenses.push({
                        paymentId: payment.id,
                        date: payment.paymentDate,
                        billNumber: payment.paymentNumber,
                        category: 'General',
                        description: payment.description,
                        amount: payment.totalAmount
                    });
                }
            }
        });

        // Calculate totals by category
        const categorySummary = {};
        expenses.forEach(exp => {
            if (!categorySummary[exp.category]) {
                categorySummary[exp.category] = 0;
            }
            categorySummary[exp.category] += parseFloat(exp.amount);
        });

        res.json({
            summary: categorySummary,
            details: expenses
        });

    } catch (error) {
        console.error('Error in getExpensesReport:', error);
        res.status(500).json({ error: error.message });
    }
};

// Rep Wise Sales Orders Report
exports.getRepWiseSalesOrdersReport = async (req, res) => {
    try {
        const { startDate, endDate, salesRepId, status } = req.query;
        const whereClause = {};

        if (status && status !== 'all' && status !== 'ALL') {
            whereClause.status = status;
        } else {
            whereClause.status = { [Op.ne]: 'Cancelled' };
        }

        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            whereClause.orderDate = { [Op.between]: [start, end] };
        }
        if (salesRepId) whereClause.idSalesPerson = salesRepId;

        const salesOrders = await SalesOrder.findAll({
            where: whereClause,
            include: [
                { model: Customer },
                { model: User, as: 'SalesPerson' }
            ],
            order: [['orderDate', 'DESC']]
        });

        const repData = {};

        salesOrders.forEach(so => {
            const repName = so.SalesPerson?.fullName || 'Unknown';
            const repId = so.SalesPerson?.id || 0;

            if (!repData[repId]) {
                repData[repId] = {
                    salesRepId: repId,
                    salesRepName: repName,
                    totalSales: 0,
                    orderCount: 0,
                    orders: []
                };
            }

            repData[repId].totalSales += parseFloat(so.totalAmount || 0);
            repData[repId].orderCount += 1;

            repData[repId].orders.push({
                id: so.id,
                orderNumber: so.orderNumber,
                customerName: so.Customer?.name || 'Unknown',
                location: so.Customer?.address || '',
                orderDate: so.orderDate,
                deliveryDate: so.deliveryDate,
                totalAmount: parseFloat(so.totalAmount || 0),
                status: so.status
            });
        });

        res.json(Object.values(repData));

    } catch (error) {
        console.error('Error in getRepWiseSalesOrdersReport:', error);
        res.status(500).json({ error: error.message });
    }
};

// Item-wise Purchasing Report
exports.getItemWisePurchasingReport = async (req, res) => {
    try {
        const { startDate, endDate, categoryId, limit = 50 } = req.query;

        const grnWhere = { status: { [Op.ne]: 'Cancelled' }, isActive: true };
        if (startDate && endDate) {
            grnWhere.grnDate = { [Op.between]: [startDate, endDate] };
        }

        const itemWhere = {};
        if (categoryId && categoryId !== 'all') {
            itemWhere.categoryId = categoryId;
        }

        const purchases = await GRNItem.findAll({
            attributes: [
                'itemId',
                [sequelize.fn('SUM', sequelize.col('GRNItem.grnQty')), 'totalQuantityPurchased'],
                [sequelize.literal('SUM(grnQty * costPrice)'), 'totalCost'],
                [sequelize.fn('COUNT', sequelize.col('GRNItem.id')), 'totalGrns'],
                [sequelize.literal('SUM(grnQty * costPrice) / SUM(grnQty)'), 'averageCostPrice']
            ],
            include: [
                {
                    model: GRN,
                    where: grnWhere,
                    attributes: []
                },
                {
                    model: Item,
                    where: itemWhere,
                    include: [Category]
                }
            ],
            group: ['itemId', 'Item.id', 'Item.Category.id'],
            order: [[sequelize.literal('totalCost'), 'DESC']],
            limit: parseInt(limit)
        });

        // Transform the response
        const transformedItems = purchases.map(p => {
            const data = p.toJSON();
            return {
                ...data,
                totalCost: parseFloat(data.totalCost || 0),
                averageCostPrice: parseFloat(data.averageCostPrice || 0),
                totalQuantityPurchased: parseInt(data.totalQuantityPurchased || 0),
                totalGrns: parseInt(data.totalGrns || 0),
                weightPurchased: (data.totalQuantityPurchased || 0) * (data.Item?.weight || 0)
            };
        });

        res.json(transformedItems);
    } catch (error) {
        console.error('Error in getItemWisePurchasingReport:', error);
        res.status(500).json({ error: error.message });
    }
};

// Supplier-wise Purchase Order Report
exports.getSupplierWisePurchaseOrderReport = async (req, res) => {
    try {
        const { startDate, endDate, supplierId, status } = req.query;

        const poWhere = { status: { [Op.ne]: 'Cancelled' } };
        if (startDate && endDate) {
            poWhere.orderDate = { [Op.between]: [startDate, endDate] };
        }
        if (status && status !== 'all') {
            poWhere.status = status;
        }

        if (supplierId && supplierId !== 'all') {
            const supplier = await Supplier.findByPk(supplierId);
            if (!supplier) {
                return res.status(404).json({ error: 'Supplier not found' });
            }

            const purchaseOrders = await PurchaseOrder.findAll({
                where: poWhere,
                include: [
                    {
                        model: Supplier,
                        where: { id: supplierId },
                        attributes: ['id', 'name', 'email', 'phone']
                    },
                    {
                        model: PurchaseOrderItem,
                        include: [{ model: Item }]
                    }
                ],
                order: [['orderDate', 'DESC']]
            });

            // Calculate supplier statistics
            const supplierStats = {
                supplierId: supplier.id,
                supplierName: supplier.name,
                totalOrders: purchaseOrders.length,
                totalAmount: 0,
                statusBreakdown: {},
                itemFrequency: {},
                monthlyBreakdown: {}
            };

            purchaseOrders.forEach(po => {
                const poAmount = parseFloat(po.totalAmount || po.total || 0);
                supplierStats.totalAmount += poAmount;

                // Status breakdown
                supplierStats.statusBreakdown[po.status] = (supplierStats.statusBreakdown[po.status] || 0) + 1;

                // Item frequency
                po.PurchaseOrderItems?.forEach(poi => {
                    const itemName = poi.Item ? poi.Item.name : 'Unknown';
                    if (!supplierStats.itemFrequency[itemName]) {
                        supplierStats.itemFrequency[itemName] = {
                            qty: 0,
                            amount: 0,
                            orders: 0
                        };
                    }
                    supplierStats.itemFrequency[itemName].qty += poi.quantity;
                    supplierStats.itemFrequency[itemName].amount += poi.totalPrice || 0;
                    supplierStats.itemFrequency[itemName].orders++;
                });

                // Monthly breakdown
                const month = new Date(po.orderDate).toISOString().slice(0, 7); // YYYY-MM
                if (!supplierStats.monthlyBreakdown[month]) {
                    supplierStats.monthlyBreakdown[month] = {
                        count: 0,
                        amount: 0
                    };
                }
                supplierStats.monthlyBreakdown[month].count++;
                supplierStats.monthlyBreakdown[month].amount += poAmount;
            });

            return res.json({
                supplierStats,
                purchaseOrders
            });
        } else {
            // Return summary table of all suppliers
            const suppliersSummary = await Supplier.findAll({
                attributes: ['id', 'name', 'email', 'phone'],
                include: [
                    {
                        model: PurchaseOrder,
                        where: poWhere,
                        attributes: ['id', 'totalAmount', 'status', 'orderDate']
                    }
                ]
            });

            const summary = suppliersSummary.map(supplier => {
                const s = supplier.toJSON();
                const pos = s.PurchaseOrders || [];
                let totalAmount = 0;
                let pendingCount = 0;
                let approvedCount = 0;
                let completedCount = 0;

                pos.forEach(po => {
                    totalAmount += parseFloat(po.totalAmount || 0);
                    if (po.status === 'Pending') pendingCount++;
                    else if (po.status === 'Approved') approvedCount++;
                    else if (po.status === 'Completed' || po.status === 'Received') completedCount++;
                });

                return {
                    supplierId: s.id,
                    supplierName: s.name,
                    email: s.email,
                    phone: s.phone,
                    poCount: pos.length,
                    totalAmount,
                    pendingCount,
                    approvedCount,
                    completedCount
                };
            }).filter(s => s.poCount > 0);

            // Sort by total amount DESC
            summary.sort((a, b) => b.totalAmount - a.totalAmount);

            return res.json(summary);
        }
    } catch (error) {
        console.error('Error in getSupplierWisePurchaseOrderReport:', error);
        res.status(500).json({ error: error.message });
    }
};

