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
    CreditNote
} = require('../models');
const { Op } = require('sequelize');

/**
 * Mobile Dashboard Data for Salesperson
 */
exports.getDashboardBySalespersonId = async (req, res) => {
    try {
        const { salespersonId } = req.params;
        const { startDate, endDate } = req.query;

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

        // 1. Get assigned customers count
        const customerCount = await SalesPersonCustomer.count({
            where: { userId: salespersonId }
        });

        // 2. Get Sales Orders count
        const salesOrderWhere = { idSalesPerson: salespersonId, status: 'Approved' };
        if (startDate && endDate) {
            salesOrderWhere.orderDate = dateFilter;
        }

        const salesOrderCount = await SalesOrder.count({
            where: salesOrderWhere
        });

        // 3. Get Invoice Data (consistent with Rep-Wise Sales Report logic)
        const invoiceWhere = {
            idSalesPerson: salespersonId,
            status: { [Op.ne]: 'Cancelled' }
        };
        if (startDate && endDate) {
            invoiceWhere.invoiceDate = dateFilter;
        }

        const invoices = await Invoice.findAll({
            where: invoiceWhere,
            include: [
                { model: Customer }
            ]
        });

        let totalSalesValue = 0;
        let totalOutstandingValue = 0;
        let totalOverdueValue = 0;

        invoices.forEach(inv => {
            const total = parseFloat(inv.total) || 0;
            const outstanding = total - (parseFloat(inv.paidAmount || 0) + parseFloat(inv.setoffAmount || 0));

            // Calculate Due Date & Overdue (Logic from getRepWiseSalesReport)
            const creditPeriod = inv.Customer?.creditPeriod || 0;
            const dueDate = new Date(inv.invoiceDate);
            dueDate.setDate(dueDate.getDate() + creditPeriod);

            const isOverDue = new Date() > dueDate && outstanding > 0;
            const overDueValue = isOverDue ? outstanding : 0;

            totalSalesValue += total;
            totalOutstandingValue += outstanding;
            totalOverdueValue += overDueValue;
        });

        // 4. Get Customer Returns count for customers assigned to this salesperson
        const returnWhere = {};
        if (startDate && endDate) {
            returnWhere.returnDate = dateFilter;
        }

        const returnCount = await CustomerReturn.count({
            where: returnWhere,
            include: [{
                model: Customer,
                as: 'Customer',
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
                salesOrderCount: parseInt(salesOrderCount) || 0,
                salesOrderTotal: totalSalesValue.toFixed(2),
                outstandingAmount: totalOutstandingValue.toFixed(2),
                overdueAmount: totalOverdueValue.toFixed(2),
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
            include: [{ model: Customer, attributes: ['id', 'name', 'type', 'address', 'contactNumber'] }],
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
 * Get Customers assigned to Salesperson
 */
exports.getCustomersBySalespersonId = async (req, res) => {
    try {
        const { salespersonId } = req.params;

        const customers = await Customer.findAll({
            include: [{
                model: SalesPersonCustomer,
                as: 'SalesPeople',
                where: { userId: salespersonId },
                attributes: []
            }],
            order: [['name', 'ASC']]
        });

        res.json({
            success: true,
            data: customers
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
