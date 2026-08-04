const {
    SalesOrder,
    Customer,
    CustomerReturn,
    Invoice,
    SalesPersonCustomer,
    User,
    sequelize,
    ReturnType,
    CustomerReturnItem,
    Item,
    CreditNote,
    SalesOrderItem,
    Route,
    Vehicle,
    InvoiceItem
} = require('../models');
const DeliveryOrder = require('../models/deliveryOrder');
const DeliveryOrderItem = require('../models/deliveryOrderItem');
const Driver = require('../models/driver');
const { Op } = require('sequelize');

/**
 * Mobile Dashboard Data for Salesperson
 */
exports.getDashboardBySalespersonId = async (req, res) => {
    try {
        const { salespersonId } = req.params;
        const { startDate, endDate, routeId } = req.query;

        console.log("salespersonId", salespersonId);
        console.log("routeId", routeId);

        // Date filter setup
        let dateFilter = {};
        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            dateFilter = { [Op.between]: [start, end] };
        }

        // ------------------------------------------------------------------
        // 1. Customer count — active customers within route
        // ------------------------------------------------------------------
        const customerCount = await Customer.count({
            where: { status: 'active', routeId: routeId }
        });

        // ------------------------------------------------------------------
        // 2a & 2b. Sales Orders count — Approved / Pending
        // ------------------------------------------------------------------
        const soApprovedWhere = { status: 'Approved' };
        if (startDate && endDate) soApprovedWhere.orderDate = dateFilter;
        const salesOrderApprovedCount = await SalesOrder.count({
            where: soApprovedWhere,
            include: [{ model: Customer, where: { routeId: routeId }, required: true }]
        });

        const soPendingWhere = { status: 'Pending' };
        if (startDate && endDate) soPendingWhere.orderDate = dateFilter;
        const salesOrderPendingCount = await SalesOrder.count({
            where: soPendingWhere,
            include: [{ model: Customer, where: { routeId: routeId }, required: true }]
        });

        // ------------------------------------------------------------------
        // 3. All non-cancelled invoices for sales value / outstanding / overdue
        // ------------------------------------------------------------------
        const invoiceWhere = {
            status: { [Op.ne]: 'Cancelled' }
        };
        if (startDate && endDate) invoiceWhere.invoiceDate = dateFilter;

        const invoices = await Invoice.findAll({
            where: invoiceWhere,
            include: [{
                model: Customer,
                where: { routeId: routeId },
                required: true
            }]
        });

        let totalSalesValue = 0;
        let totalOutstandingValue = 0;
        let totalOverdueValue = 0;

        invoices.forEach(inv => {
            const total = parseFloat(inv.total) || 0;
            const outstanding = total - (parseFloat(inv.paidAmount || 0) + parseFloat(inv.setoffAmount || 0));
            const creditPeriod = inv.Customer?.creditPeriod || 0;
            const dueDate = new Date(inv.invoiceDate);
            dueDate.setDate(dueDate.getDate() + creditPeriod);
            const isOverDue = new Date() > dueDate && outstanding > 0;

            totalSalesValue += total;
            totalOutstandingValue += outstanding;
            totalOverdueValue += isOverDue ? outstanding : 0;
        });

        // ------------------------------------------------------------------
        // 4. Approved invoices — collection (paid) & outstanding (unpaid)
        // ------------------------------------------------------------------
        const approvedInvoiceWhere = { status: 'Approved' };
        if (startDate && endDate) approvedInvoiceWhere.invoiceDate = dateFilter;

        const approvedInvoices = await Invoice.findAll({
            where: approvedInvoiceWhere,
            include: [{
                model: Customer,
                where: { routeId: routeId },
                required: true
            }]
        });

        let collectionTotal = 0;
        let outstandingTotal = 0;
        approvedInvoices.forEach(inv => {
            const total = parseFloat(inv.total) || 0;
            const paid = parseFloat(inv.paidAmount || 0);
            const setoff = parseFloat(inv.setoffAmount || 0);
            collectionTotal += paid;
            outstandingTotal += Math.max(0, total - paid - setoff);
        });

        // ------------------------------------------------------------------
        // 5. Customer returns count — scoped to route customers
        // ------------------------------------------------------------------
        const returnWhere = {};
        if (startDate && endDate) returnWhere.returnDate = dateFilter;

        const returnCount = await CustomerReturn.count({
            where: returnWhere,
            include: [{
                model: Customer,
                as: 'Customer',
                where: { routeId: routeId },
                required: true
            }]
        });

        res.json({
            success: true,
            data: {
                routeId: routeId,
                routeName: 'Route ' + routeId,
                customerCount,
                salesOrderCount: salesOrderApprovedCount,      // backward compat
                salesOrderApprovedCount,
                salesOrderPendingCount,
                salesOrderTotal: totalSalesValue.toFixed(2),
                outstandingAmount: totalOutstandingValue.toFixed(2),
                overdueAmount: totalOverdueValue.toFixed(2),
                collectionTotal: collectionTotal.toFixed(2),
                outstandingTotal: outstandingTotal.toFixed(2),
                returnCount
            }
        });
    } catch (error) {
        console.error('Error fetching mobile dashboard:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get Sales Orders by Salesperson
 */
exports.getSalesOrdersBySalespersonId = async (req, res) => {
    try {
        const { salespersonId } = req.params;
        const { status, limit = 20, offset = 0, startDate, endDate, customerId } = req.query;

        const where = { idSalesPerson: salespersonId };
        if (status) where.status = status;
        // if (customerId) where.customerId = customerId;

        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);

            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            where.orderDate = {
                [Op.between]: [start, end]
            };
        }

        const orders = await SalesOrder.findAndCountAll({
            where,
            include: [
                { model: Customer, attributes: ['id', 'name', 'type', 'address', 'contactNumber'] },
                {
                    model: SalesOrderItem,
                    include: [
                        {
                            model: Item,
                            attributes: ['id', 'name', 'unit']
                        }
                    ]
                }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']]
        });

        res.json({
            success: true,
            data: orders.rows,
            total: orders.count
        });
    } catch (error) {
        console.error('Error fetching sales orders:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get Customers by RouteId for Mobile (Sales App)
 * Returns all customers whose routeId FK matches the given routeId,
 * merged with any customers in the route's customerIds JSON array.
 * GET /api/mobile/route-customers/:routeId
 */
exports.getCustomersByRouteId = async (req, res) => {
    try {
        const { routeId } = req.params;

        if (!routeId || routeId === 'undefined' || routeId === 'null') {
            return res.status(400).json({ success: false, error: 'routeId is required' });
        }

        const route = await Route.findByPk(routeId, {
            attributes: ['id', 'routeName', 'city', 'description', 'days', 'status', 'customerIds', 'salesPersonId']
        });

        if (!route) {
            return res.status(404).json({ success: false, error: 'Route not found' });
        }

        // 1. Customers assigned via FK routeId column
        const customersByFK = await Customer.findAll({
            where: { routeId, status: { [Op.ne]: 'Inactive' } },
            attributes: ['id', 'name', 'type', 'address', 'contactPerson', 'contactNumber', 'contactNumber2', 'email', 'routeId', 'parentId', 'latitude', 'longitude', 'status', 'creditLimit', 'creditPeriod', 'discountRate', 'paymentMethod'],
            include: [
                { model: Route, as: 'route', attributes: ['id', 'routeName', 'city', 'description'] },
                { model: Customer, as: 'Parent', attributes: ['id', 'name'] }
            ],
            order: [['name', 'ASC']]
        });

        // 2. Customers in the JSON customerIds array (legacy)
        let customersByJSON = [];
        if (Array.isArray(route.customerIds) && route.customerIds.length > 0) {
            const validIds = route.customerIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
            if (validIds.length > 0) {
                customersByJSON = await Customer.findAll({
                    where: { id: { [Op.in]: validIds }, status: { [Op.ne]: 'Inactive' } },
                    attributes: ['id', 'name', 'type', 'address', 'contactPerson', 'contactNumber', 'contactNumber2', 'email', 'routeId', 'parentId', 'latitude', 'longitude', 'status', 'creditLimit', 'creditPeriod', 'discountRate', 'paymentMethod'],
                    include: [
                        { model: Route, as: 'route', attributes: ['id', 'routeName', 'city', 'description'] },
                        { model: Customer, as: 'Parent', attributes: ['id', 'name'] }
                    ],
                    order: [['name', 'ASC']]
                });
            }
        }

        // 3. Merge & deduplicate
        const merged = {};
        [...customersByFK, ...customersByJSON].forEach(c => {
            if (!merged[c.id]) merged[c.id] = c.toJSON();
        });
        const customers = Object.values(merged).sort((a, b) => a.name.localeCompare(b.name));

        // Attach route info to each customer
        const routeInfo = { id: route.id, routeName: route.routeName, city: route.city, description: route.description };
        const result = customers.map(c => ({
            ...c,
            route: c.route || routeInfo,
            routes: [routeInfo]
        }));

        res.json({
            success: true,
            routeId: parseInt(routeId),
            routeName: route.routeName,
            city: route.city,
            total: result.length,
            data: result
        });
    } catch (error) {
        console.error('Error fetching customers by routeId:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getCustomersBySalespersonId = async (req, res) => {
    try {
        const { salespersonId } = req.params;

        const customers = await Customer.findAll({
            include: [
                {
                    model: SalesPersonCustomer,
                    as: 'SalesPeople',
                    where: { userId: salespersonId },
                    attributes: []
                },
                {
                    model: Customer,
                    as: 'Parent',
                    attributes: ['id', 'name']
                },
                {
                    model: Route,
                    as: 'route',
                    attributes: ['id', 'routeName', 'description', 'city', 'days', 'status']
                }
            ],
            order: [['name', 'ASC']]
        });

        // Get all routes to find which routes each customer belongs to
        const routes = await Route.findAll({
            attributes: ['id', 'routeName', 'description', 'city', 'customerIds', 'days', 'status'],
            where: {
                customerIds: { [Op.ne]: null }
            }
        });

        const customersWithRoutes = customers.map(customer => {
            const customerObj = customer.toJSON();
            // Find routes that include this customer (via customerIds JSON or routeId)
            const matchedRoutes = routes.filter(route =>
                (route.id === customer.routeId) ||
                (route.customerIds && Array.isArray(route.customerIds) && route.customerIds.includes(customer.id))
            );

            if (customer.route && !matchedRoutes.some(r => r.id === customer.route.id)) {
                matchedRoutes.push(customer.route);
            }

            customerObj.routes = matchedRoutes.map(route => ({
                id: route.id,
                routeName: route.routeName,
                description: route.description,
                city: route.city,
                days: route.days,
                status: route.status
            }));
            return customerObj;
        });

        res.json({
            success: true,
            data: customersWithRoutes
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get Customer Returns for customers assigned to Salesperson
 */
exports.getCustomerReturnsBySalespersonId = async (req, res) => {
    try {
        const { salespersonId } = req.params;

        const returns = await CustomerReturn.findAll({
            where: {
                createdBy: salespersonId
            },
            include: [
                {
                    model: Customer,
                    as: 'Customer',
                    attributes: ['id', 'name', 'type', 'address', 'contactPerson', 'contactNumber']
                },
                {
                    model: ReturnType,
                    as: 'ReturnType',
                    attributes: ['id', 'name', 'code']
                },
                {
                    model: CustomerReturnItem,
                    as: 'CustomerReturnItems',
                    include: [
                        {
                            model: Item,
                            as: 'Item',
                            attributes: ['id', 'name', 'sku', 'barcode']
                        }
                    ]
                },
                {
                    model: User,
                    as: 'Creator',
                    attributes: ['id', 'username']
                },
                {
                    model: User,
                    as: 'Updater',
                    attributes: ['id', 'username']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json({
            success: true,
            data: returns
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get Customer Outstandings by Salesperson
 */
exports.getCustomerOutstandingsBySalespersonId = async (req, res) => {
    try {
        const { salespersonId } = req.params;

        // Base where clause for outstanding invoices
        const invoiceWhere = {
            [Op.and]: [
                sequelize.where(sequelize.col('Invoice.total'), '>', sequelize.literal('Invoice.paidAmount + Invoice.setoffAmount'))
            ],
            status: { [Op.ne]: 'Cancelled' }
        };

        if (salespersonId) invoiceWhere.idSalesPerson = salespersonId;

        // 1. Get all customers assigned to this salesperson
        const customerAssignments = await SalesPersonCustomer.findAll({
            where: { userId: salespersonId },
            attributes: ['customerId']
        });
        const assignedCustomerIds = customerAssignments.map(a => a.customerId);

        if (assignedCustomerIds.length === 0) {
            return res.json({ success: true, data: [] });
        }

        // 2. Map through each customer to calculate outstanding
        const result = [];
        const customers = await Customer.findAll({
            where: { id: { [Op.in]: assignedCustomerIds } },
            attributes: ['id', 'name', 'contactNumber', 'address', 'type']
        });

        for (const customer of customers) {
            // Get outstanding invoices for this customer & salesperson
            const invoices = await Invoice.findAll({
                where: {
                    customerId: customer.id,
                    idSalesPerson: salespersonId,
                    status: { [Op.ne]: 'Cancelled' },
                    [Op.and]: [
                        sequelize.where(sequelize.col('Invoice.total'), '>', sequelize.literal('Invoice.paidAmount + Invoice.setoffAmount'))
                    ]
                }
            });

            // Get approved credits
            const returns = await CustomerReturn.findAll({
                where: { customerId: customer.id, status: 'Approved' }
            });
            const creditNotes = await CreditNote.findAll({
                where: { customerId: customer.id, status: 'Approved' }
            });

            if (invoices.length === 0 && returns.length === 0 && creditNotes.length === 0) continue;

            let customerTotal = 0;
            let invoiceCount = invoices.length;

            const tempReturns = returns.map(r => ({
                invoiceId: r.invoiceId,
                remaining: (parseFloat(r.totalAmount) || 0) - (parseFloat(r.utilizedAmount) || 0)
            }));
            const tempCNs = creditNotes.map(cn => ({
                invoiceId: cn.invoiceId,
                remaining: (parseFloat(cn.total) || 0) - (parseFloat(cn.appliedAmount) || 0)
            }));

            for (const invoice of invoices) {
                let outstanding = parseFloat(invoice.total) - (parseFloat(invoice.paidAmount || 0) + parseFloat(invoice.setoffAmount || 0));

                // Subtract linked credits
                tempReturns.filter(r => r.invoiceId === invoice.id).forEach(r => {
                    const deduction = Math.min(outstanding, r.remaining);
                    outstanding -= deduction;
                    r.remaining -= deduction;
                });
                tempCNs.filter(cn => cn.invoiceId === invoice.id).forEach(cn => {
                    const deduction = Math.min(outstanding, cn.remaining);
                    outstanding -= deduction;
                    cn.remaining -= deduction;
                });

                customerTotal += outstanding;
            }

            // Subtract unlinked credits from total
            let unlinkedCredit = 0;
            tempReturns.forEach(r => { if (r.remaining > 0) unlinkedCredit += r.remaining; });
            tempCNs.forEach(cn => { if (cn.remaining > 0) unlinkedCredit += cn.remaining; });

            customerTotal -= unlinkedCredit;

            if (customerTotal !== 0 || invoiceCount > 0) {
                result.push({
                    customerId: customer.id,
                    customerName: customer.name,
                    contactNumber: customer.contactNumber,
                    address: customer.address,
                    type: customer.type,
                    invoiceCount: invoiceCount,
                    totalOutstanding: parseFloat(customerTotal.toFixed(2)),
                    unappliedCredits: parseFloat(unlinkedCredit.toFixed(2))
                });
            }
        }

        // Sort by total outstanding descending
        result.sort((a, b) => b.totalOutstanding - a.totalOutstanding);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error fetching outstanding customers:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message
        });
    }
};

exports.getInvoicesBySalespersonId = async (req, res) => {
    try {
        const { salespersonId } = req.params;
        const { status, limit = 20, offset = 0 } = req.query;

        const where = { idSalesPerson: salespersonId };
        if (status && status !== 'ALL') {
            where.status = status;
        }

        const invoices = await Invoice.findAndCountAll({
            where,
            include: [
                { model: Customer, attributes: ['id', 'name', 'type', 'address', 'contactNumber'] },
                { model: InvoiceItem, include: [Item] }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']]
        });

        res.json({
            success: true,
            data: invoices.rows,
            total: invoices.count
        });
    } catch (error) {
        console.error('Error fetching salesperson invoices:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get Delivery Orders by RouteId for Mobile (Sales App)
 * GET /api/mobile/delivery-orders/:routeId?status=Dispatched&search=
 */
exports.getDeliveryOrdersByRouteId = async (req, res) => {
    try {
        const { routeId } = req.params;
        const { status = 'Dispatched', search, limit = 100, page = 1 } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        const where = {};
        if (routeId && routeId !== 'all' && routeId !== '0' && routeId !== 'undefined' && routeId !== 'null') {
            where.routeId = routeId;
        }

        // Filter by status (allow 'All' to skip)
        if (status && status !== 'All') {
            where.status = status;
        }

        // Search by doNumber or customer name
        if (search && search.trim()) {
            const matchingCustomers = await Customer.findAll({
                where: { name: { [Op.like]: `%${search.trim()}%` } },
                attributes: ['id'],
                raw: true
            });
            const customerIds = matchingCustomers.map(c => c.id);

            where[Op.or] = [
                { doNumber: { [Op.like]: `%${search.trim()}%` } },
                { customerId: { [Op.in]: customerIds.length ? customerIds : [-1] } }
            ];
        }

        const { count, rows } = await DeliveryOrder.findAndCountAll({
            where,
            include: [
                {
                    model: SalesOrder,
                    include: [
                        { model: Customer, attributes: ['id', 'name', 'address', 'contactNumber', 'type'] }
                    ]
                },
                { model: Driver, attributes: ['id', 'name', 'mobile'] },
                { model: Route, attributes: ['id', 'routeName', 'city', 'startPoint', 'endPoint'] },
                { model: Vehicle, attributes: ['id', 'vehicleNumber', 'vehicleType'] },
                {
                    model: DeliveryOrderItem,
                    include: [{ model: Item, attributes: ['id', 'name', 'sku', 'unit'] }]
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset,
            distinct: true
        });

        res.json({
            success: true,
            data: rows,
            total: count
        });
    } catch (error) {
        console.error('Error fetching delivery orders by routeId:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};