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
const { Op } = require('sequelize');

/**
 * Mobile Dashboard Data for Salesperson
 */
exports.getDashboardBySalespersonId = async (req, res) => {
    try {
        const { salespersonId } = req.params;
        const { startDate, endDate, routeId } = req.query;

        // Date filter setup
        let dateFilter = {};
        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);

            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            dateFilter = {
                [Op.between]: [start, end]
            };
        }

        // Determine resolvedRouteId (fallback to active day route if query routeId is not provided)
        const resolvedRouteId = routeId;

        // Retrieve route customer IDs if resolvedRouteId is resolved
        let routeCustomerIds = null;
        if (resolvedRouteId) {
            const route = await Route.findByPk(resolvedRouteId);
            routeCustomerIds = route && Array.isArray(route.customerIds) ? route.customerIds : [];
        }

        // 1. Get assigned customers count (only active customers)
        const customerWhere = {
            status: 'active'
        };
        if (routeCustomerIds !== null) {
            customerWhere.id = { [Op.in]: routeCustomerIds };
        }
        const customerCount = await Customer.count({
            where: customerWhere,
            include: [{
                model: SalesPersonCustomer,
                as: 'SalesPeople',
                where: { userId: salespersonId },
                required: true
            }]
        });

        // 2a. Sales Orders — Approved count (with optional date filter)
        const soApprovedWhere = { idSalesPerson: salespersonId, status: 'Approved' };
        if (startDate && endDate) soApprovedWhere.orderDate = dateFilter;
        const salesOrderApprovedCount = await SalesOrder.count({
            where: soApprovedWhere,
            include: routeCustomerIds !== null ? [{ model: Customer, where: { id: { [Op.in]: routeCustomerIds } }, required: true }] : []
        });

        // 2b. Sales Orders — Pending count (with optional date filter)
        const soPendingWhere = { idSalesPerson: salespersonId, status: 'Pending' };
        if (startDate && endDate) soPendingWhere.orderDate = dateFilter;
        const salesOrderPendingCount = await SalesOrder.count({
            where: soPendingWhere,
            include: routeCustomerIds !== null ? [{ model: Customer, where: { id: { [Op.in]: routeCustomerIds } }, required: true }] : []
        });

        // 3. Get Invoice Data for this salesperson (non-cancelled)
        const invoiceWhere = {
            idSalesPerson: salespersonId,
            status: { [Op.ne]: 'Cancelled' }
        };
        if (startDate && endDate) {
            invoiceWhere.invoiceDate = dateFilter;
        }

        const invoices = await Invoice.findAll({
            where: invoiceWhere,
            include: [{
                model: Customer,
                where: routeCustomerIds !== null ? { id: { [Op.in]: routeCustomerIds } } : {},
                required: routeCustomerIds !== null
            }]
        });

        let totalSalesValue = 0;
        let totalOutstandingValue = 0;
        let totalOverdueValue = 0;

        // 4. Approved-invoice specific: collection (paid) & outstanding (unpaid)
        const approvedInvoiceWhere = {
            idSalesPerson: salespersonId,
            status: 'Approved'
        };
        if (startDate && endDate) {
            approvedInvoiceWhere.invoiceDate = dateFilter;
        }

        const approvedInvoices = await Invoice.findAll({
            where: approvedInvoiceWhere,
            include: [{
                model: Customer,
                where: routeCustomerIds !== null ? { id: { [Op.in]: routeCustomerIds } } : {},
                required: routeCustomerIds !== null
            }]
        });

        let collectionTotal = 0;   // sum of paidAmount on Approved invoices
        let outstandingTotal = 0;  // sum of (total - paidAmount - setoffAmount) on Approved invoices

        approvedInvoices.forEach(inv => {
            const total = parseFloat(inv.total) || 0;
            const paid = parseFloat(inv.paidAmount || 0);
            const setoff = parseFloat(inv.setoffAmount || 0);
            const unpaid = Math.max(0, total - paid - setoff);

            collectionTotal += paid;
            outstandingTotal += unpaid;
        });

        invoices.forEach(inv => {
            const total = parseFloat(inv.total) || 0;
            const outstanding = total - (parseFloat(inv.paidAmount || 0) + parseFloat(inv.setoffAmount || 0));

            // Calculate Due Date & Overdue
            const creditPeriod = inv.Customer?.creditPeriod || 0;
            const dueDate = new Date(inv.invoiceDate);
            dueDate.setDate(dueDate.getDate() + creditPeriod);

            const isOverDue = new Date() > dueDate && outstanding > 0;
            const overDueValue = isOverDue ? outstanding : 0;

            totalSalesValue += total;
            totalOutstandingValue += outstanding;
            totalOverdueValue += overDueValue;
        });

        // 5. Get Customer Returns count for customers assigned to this salesperson
        const returnWhere = {};
        if (startDate && endDate) {
            returnWhere.returnDate = dateFilter;
        }

        const returnCount = await CustomerReturn.count({
            where: returnWhere,
            include: [{
                model: Customer,
                as: 'Customer',
                where: routeCustomerIds !== null ? { id: { [Op.in]: routeCustomerIds } } : {},
                required: true,
                include: [{
                    model: SalesPersonCustomer,
                    as: 'SalesPeople',
                    where: { userId: salespersonId },
                    required: true
                }]
            }]
        });

        res.json({
            success: true,
            data: {
                customerCount,
                // Sales Orders split
                salesOrderCount: salesOrderApprovedCount,         // kept for backward compat
                salesOrderApprovedCount,
                salesOrderPendingCount,
                // Invoice financials
                salesOrderTotal: totalSalesValue.toFixed(2),
                outstandingAmount: totalOutstandingValue.toFixed(2),
                overdueAmount: totalOverdueValue.toFixed(2),
                // Collection & Outstanding from Approved invoices
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
            // Find routes that include this customer
            const customerRoutes = routes.filter(route =>
                route.customerIds &&
                Array.isArray(route.customerIds) &&
                route.customerIds.includes(customer.id)
            );
            customerObj.routes = customerRoutes.map(route => ({
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