const {
    sequelize,
    Invoice,
    InvoiceItem,
    Customer,
    SalesOrder,
    DeliveryOrder,
    Driver,
    Item,
    User,
    DeliveryOrderItem,
    JournalEntry,
    JournalEntryLine,
    LedgerAccount,
    ControlAccount,
    Receipt,
    ReceiptInvoice,
    ReceiptPayment,
    ReceiptCreditNote,
    PaymentType,
    CreditNote,
    CustomerReturn,
    AccountCategory
} = require('../models');
const { Op } = require('sequelize');
const TransactionService = require('../utils/transactionService');

// Helper function to confirm delivery order internally with existing transaction
const confirmDeliveryOrderInTransaction = async (deliveryOrderId, transaction, currentUserId) => {
    const { Stock, StockDetail, DeliveryOrderItem } = require('../models');

    try {
        // 1. Get DO and items
        const order = await DeliveryOrder.findByPk(deliveryOrderId, { transaction });
        if (!order) {
            throw new Error('Delivery Order not found');
        }
        if (order.status !== 'Finalized') {
            throw new Error('Only Finalized Delivery Orders can be confirmed as Delivered');
        }

        const doItems = await DeliveryOrderItem.findAll({ where: { deliveryOrderId }, transaction });

        // 2. For each item, manage lorry stocks based on accepted/rejected/damaged/weightDiff
        for (const doItem of doItems) {
            const { itemId, acceptedQty = 0, rejectedQty = 0, damagedQty = 0, weightDiffQty = 0 } = doItem;

            // a. Release acceptedQty from lorry stock
            let lorryStock = await Stock.findOne({
                where: { itemId, lorryId: order.vehicleId, storeId: null },
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (lorryStock && acceptedQty > 0) {
                if (lorryStock.availableQty < acceptedQty) {
                    throw new Error(`Insufficient lorry stock for item ${itemId}. Available: ${lorryStock.availableQty}, Required: ${acceptedQty}`);
                }

                await lorryStock.update({
                    availableQty: lorryStock.availableQty - acceptedQty,
                    updatedBy: currentUserId
                }, { transaction });

                await StockDetail.create({
                    stockId: lorryStock.id,
                    documentType: 'Delivery-Delivered',
                    documentId: deliveryOrderId,
                    inOut: 'OUT',
                    qty: acceptedQty,
                    date: new Date(),
                    createdBy: currentUserId || order.createdBy,
                    updatedBy: currentUserId || order.createdBy,
                    remark: 'Delivered to customer'
                }, { transaction });
            }

            // b. Create stock detail records for rejected/damaged/weightDiff items
            if (lorryStock && rejectedQty > 0) {
                await StockDetail.create({
                    stockId: lorryStock.id,
                    documentType: 'Delivery-Rejected',
                    documentId: deliveryOrderId,
                    inOut: 'IN',
                    qty: rejectedQty,
                    date: new Date(),
                    createdBy: currentUserId || order.createdBy,
                    updatedBy: currentUserId || order.createdBy,
                    remark: 'Rejected by customer (returned to lorry)'
                }, { transaction });
            }
            if (lorryStock && damagedQty > 0) {
                await StockDetail.create({
                    stockId: lorryStock.id,
                    documentType: 'Delivery-Damaged',
                    documentId: deliveryOrderId,
                    inOut: 'IN',
                    qty: damagedQty,
                    date: new Date(),
                    createdBy: currentUserId || order.createdBy,
                    updatedBy: currentUserId || order.createdBy,
                    remark: 'Damaged during delivery (returned to lorry)'
                }, { transaction });
            }
            if (lorryStock && weightDiffQty > 0) {
                await StockDetail.create({
                    stockId: lorryStock.id,
                    documentType: 'Delivery-WeightDiff',
                    documentId: deliveryOrderId,
                    inOut: 'IN',
                    qty: weightDiffQty,
                    date: new Date(),
                    createdBy: currentUserId || order.createdBy,
                    updatedBy: currentUserId || order.createdBy,
                    remark: 'Weight difference at delivery (returned to lorry)'
                }, { transaction });
            }
        }

        // 3. Set DO status to Delivered
        await order.update({
            status: 'Delivered',
            updatedBy: currentUserId
        }, { transaction });

        return { success: true, message: 'Delivery Order confirmed as Delivered', deliveryOrderId };
    } catch (error) {
        throw error;
    }
};

// Helper function to confirm delivery order internally (standalone version)
const confirmDeliveryOrderInternal = async (deliveryOrderId) => {
    const t = await sequelize.transaction();
    try {
        const result = await confirmDeliveryOrderInTransaction(deliveryOrderId, t, null);
        await t.commit();
        return result;
    } catch (error) {
        await t.rollback();
        throw error;
    }
};

// Create Invoice (with items, linked to SalesOrder/DeliveryOrder)
exports.createInvoice = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const {
            invoiceNumber,
            customerId,
            salesOrderId,
            deliveryOrderId,
            invoiceDate,
            isTaxInvoice,
            taxRate,
            taxAmount,
            subTotal,
            idSalesPerson,
            locationId,
            items } = req.body;
        const currentUserId = req.user && req.user.id ? req.user.id : null;
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }
        let total = 0;
        if (!Array.isArray(items) || items.length === 0) throw new Error('Invoice must have at least one item');
        for (const item of items) {
            total += (item.qty * item.price);
        }
        const invoice = await Invoice.create({
            invoiceNumber,
            customerId,
            salesOrderId,
            deliveryOrderId,
            invoiceDate,
            isTaxInvoice,
            taxRate,
            taxAmount,
            subTotal,
            total,
            idSalesPerson: (idSalesPerson && idSalesPerson != 0 && idSalesPerson != '0') ? idSalesPerson : null,
            locationId,
            status: 'Pending',
            createdBy: currentUserId, updatedBy: currentUserId
        }, { transaction: t });
        for (const item of items) {
            await InvoiceItem.create({
                invoiceId: invoice.id,
                itemId: item.itemId,
                qty: item.qty,
                price: item.price,
                isTaxItem: item.isTaxItem || false,
                taxAmount: item.taxAmount || 0.0,
                total: item.qty * item.price
            }, { transaction: t });
        }
        await t.commit();
        const result = await Invoice.findByPk(invoice.id, {
            include: [
                { model: Customer },
                { model: SalesOrder },
                { model: DeliveryOrder },
                { model: InvoiceItem, include: [Item] }
            ]
        });
        res.status(201).json(result);
    } catch (error) {
        await t.rollback();
        res.status(400).json({ error: error.message });
    }
};

// List all Invoices (supports pagination & filtering)
exports.getAllInvoices = async (req, res) => {
    try {
        const {
            page,
            limit,
            search,
            status,
            customerId,
            salesPersonId,
            dateFrom,
            dateTo,
            createdBy,
            outstanding
        } = req.query;

        // ── Pagination ────────────────────────────────────────────────────────
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(500, Math.max(1, parseInt(limit) || 0)); // 0 = no pagination
        const usePagination = limitNum > 0;

        // ── Where clause ──────────────────────────────────────────────────────
        const whereClause = {};

        // Location filter (forwarded by proxy)
        if (req.query.locationId) {
            whereClause.locationId = req.query.locationId;
        }

        // Legacy createdBy (salesperson id by creator)
        if (createdBy) {
            whereClause.createdBy = createdBy;
        }

        // Status filter
        if (status && status !== 'all') {
            if (status === 'pending') {
                whereClause.status = { [Op.or]: [null, 'Pending'] };
            } else {
                whereClause.status = status.charAt(0).toUpperCase() + status.slice(1);
            }
        }

        // Customer filter
        if (customerId && customerId !== 'all') {
            whereClause.customerId = customerId;
        }

        // Date range filter
        if (dateFrom || dateTo) {
            whereClause.invoiceDate = {};
            if (dateFrom) whereClause.invoiceDate[Op.gte] = dateFrom;
            if (dateTo) whereClause.invoiceDate[Op.lte] = dateTo;
        }

        // Outstanding filter
        if (outstanding === 'true') {
            whereClause[Op.and] = [
                sequelize.where(sequelize.col('Invoice.total'), '>', sequelize.col('Invoice.paidAmount'))
            ];
        }

        // ── Search (invoice number / customer name) ───────────────────────────
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
                { invoiceNumber: { [Op.like]: `%${search}%` } },
                { customerId: { [Op.in]: customerIdsByName } }
            ];
        }

        const mergedWhere = { ...whereClause };

        // ── SalesPerson include filter ─────────────────────────────────────────
        const salesPersonInclude = {
            model: User,
            as: 'SalesPerson',
            attributes: ['id', 'fullName', 'mobile'],
            ...(salesPersonId && salesPersonId !== 'all'
                ? { where: { id: salesPersonId }, required: true }
                : {})
        };

        // ── Query ─────────────────────────────────────────────────────────────
        const queryOptions = {
            where: mergedWhere,
            include: [
                { model: Customer },
                { model: SalesOrder },
                { model: DeliveryOrder },
                salesPersonInclude,
                { model: InvoiceItem, include: [Item] },
                {
                    model: ReceiptInvoice,
                    as: 'ReceiptInvoices',
                    include: [
                        {
                            model: Receipt,
                            as: 'receipt',
                            include: [
                                { model: ReceiptPayment, as: 'payments', include: [PaymentType] },
                                { model: ReceiptCreditNote, as: 'creditNoteSetOffs', include: [{ model: CreditNote, as: 'CreditNote' }] }
                            ]
                        }
                    ]
                }
            ],
            order: [['createdAt', 'DESC']],
            distinct: true, // required for correct count with hasMany includes
        };

        if (usePagination) {
            queryOptions.limit = limitNum;
            queryOptions.offset = (pageNum - 1) * limitNum;
        }

        const { count, rows } = await Invoice.findAndCountAll(queryOptions);

        const totalPages = usePagination ? Math.ceil(count / limitNum) : 1;

        res.json({
            data: rows,
            pagination: {
                page: usePagination ? pageNum : 1,
                limit: usePagination ? limitNum : count,
                total: count,
                totalPages,
                hasNextPage: usePagination ? pageNum < totalPages : false,
                hasPrevPage: usePagination ? pageNum > 1 : false,
            }
        });
    } catch (error) {
        console.error('getAllInvoices error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get Invoices by Driver ID
exports.getInvoicesByDriverId = async (req, res) => {
    try {
        const { driverId } = req.params;

        if (!driverId) {
            return res.status(400).json({ error: 'Driver ID is required' });
        }

        const invoices = await Invoice.findAll({
            include: [
                { model: Customer },
                { model: SalesOrder },
                {
                    model: DeliveryOrder,
                    where: {
                        driverId: driverId,
                        [Op.or]: [
                            { status: "In Transit" },
                            { status: "Finalized" },
                            { status: "Delivered" }
                        ]

                    },
                    include: [
                        {
                            model: Driver,
                            attributes: ['id', 'name', 'mobile', 'status']
                        },
                        { model: DeliveryOrderItem }
                    ]
                },
                { model: InvoiceItem, include: [Item] }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Transform the response to include driver info at top level for easier access
        const invoicesWithDriver = invoices.map(invoice => {
            const invoiceData = invoice.toJSON();
            invoiceData.driver = invoiceData.DeliveryOrder?.Driver || null;
            invoiceData.driverId = invoiceData.DeliveryOrder?.driverId || null;
            return invoiceData;
        });

        res.json({
            driverId: driverId,
            totalInvoices: invoicesWithDriver.length,
            invoices: invoicesWithDriver
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get Invoices by Customer ID
exports.getInvoicesByCustomerId = async (req, res) => {
    try {
        const { customerId } = req.params;

        if (!customerId) {
            return res.status(400).json({ error: 'Customer ID is required' });
        }

        const whereClause = { customerId: customerId };

        // Add outstanding filter if requested
        if (req.query.outstanding === 'true') {
            whereClause[Op.and] = [
                sequelize.where(sequelize.col('Invoice.total'), '>', sequelize.col('Invoice.paidAmount'))
            ];
        }

        const invoices = await Invoice.findAll({
            where: whereClause,
            include: [
                { model: Customer },
                { model: SalesOrder },
                { model: DeliveryOrder },
                { model: User, as: 'SalesPerson', attributes: ['id', 'fullName', 'mobile'] },
                { model: InvoiceItem, include: [Item] },
                {
                    model: ReceiptInvoice,
                    as: 'ReceiptInvoices',
                    include: [
                        {
                            model: Receipt,
                            as: 'receipt',
                            include: [
                                { model: ReceiptPayment, as: 'payments', include: [PaymentType] },
                                { model: ReceiptCreditNote, as: 'creditNoteSetOffs', include: [{ model: CreditNote, as: 'CreditNote' }] }
                            ]
                        }
                    ]
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json(invoices);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get Invoice by ID
exports.getInvoiceById = async (req, res) => {
    try {
        const invoice = await Invoice.findByPk(req.params.id, {
            include: [
                { model: Customer },
                { model: SalesOrder },
                { model: DeliveryOrder },
                { model: User, as: 'SalesPerson', attributes: ['id', 'fullName', 'mobile'] },
                { model: InvoiceItem, include: [Item] },
                {
                    model: ReceiptInvoice,
                    as: 'ReceiptInvoices',
                    include: [
                        {
                            model: Receipt,
                            as: 'receipt',
                            include: [
                                { model: ReceiptPayment, as: 'payments', include: [PaymentType] },
                                { model: ReceiptCreditNote, as: 'creditNoteSetOffs', include: [{ model: CreditNote, as: 'CreditNote' }] }
                            ]
                        }
                    ]
                }
            ]
        });
        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
        res.json(invoice);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update Invoice (only if Pending)
exports.updateInvoice = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const invoice = await Invoice.findByPk(req.params.id, { transaction: t });
        if (!invoice) {
            await t.rollback();
            return res.status(404).json({ error: 'Invoice not found' });
        }
        if (invoice.status !== 'Pending') {
            await t.rollback();
            return res.status(400).json({ error: 'Only Pending Invoice can be updated' });
        }
        const {
            invoiceNumber,
            customerId,
            salesOrderId,
            deliveryOrderId,
            invoiceDate,
            isTaxInvoice,
            taxRate,
            taxAmount,
            subTotal,
            idSalesPerson,
            locationId,
            items
        } = req.body;
        const currentUserId = req.user && req.user.id ? req.user.id : null;
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }
        let total = 0;
        if (!Array.isArray(items) || items.length === 0) throw new Error('Invoice must have at least one item');
        for (const item of items) {
            total += (item.qty * item.price);
        }
        await invoice.update({
            invoiceNumber,
            customerId,
            salesOrderId,
            deliveryOrderId,
            invoiceDate,
            isTaxInvoice,
            taxRate,
            taxAmount,
            subTotal,
            total,
            idSalesPerson: (idSalesPerson && idSalesPerson != 0 && idSalesPerson != '0') ? idSalesPerson : null,
            locationId,
            updatedBy: currentUserId
        }, { transaction: t });
        await InvoiceItem.destroy({ where: { invoiceId: invoice.id }, transaction: t });
        for (const item of items) {
            await InvoiceItem.create({
                invoiceId: invoice.id,
                itemId: item.itemId,
                qty: item.qty,
                price: item.price,
                total: item.qty * item.price
            }, { transaction: t });
        }
        await t.commit();
        const updated = await Invoice.findByPk(invoice.id, {
            include: [
                { model: Customer },
                { model: SalesOrder },
                { model: DeliveryOrder },
                { model: InvoiceItem, include: [Item] }
            ]
        });
        res.json(updated);
    } catch (error) {
        await t.rollback();
        res.status(400).json({ error: error.message });
    }
};

// Delete Invoice (only if Pending)
exports.deleteInvoice = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const invoice = await Invoice.findByPk(req.params.id, { transaction: t });
        if (!invoice) {
            await t.rollback();
            return res.status(404).json({ error: 'Invoice not found' });
        }
        if (invoice.status !== 'Pending') {
            await t.rollback();
            return res.status(400).json({ error: 'Only Pending Invoice can be deleted' });
        }
        await InvoiceItem.destroy({ where: { invoiceId: invoice.id }, transaction: t });
        await invoice.destroy({ transaction: t });
        await t.commit();
        res.json({ message: 'Invoice deleted' });
    } catch (error) {
        await t.rollback();
        res.status(400).json({ error: error.message });
    }
};

// Approve or reject Invoice
exports.approveOrRejectInvoice = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { status } = req.body; // status: 'Approved' or 'Rejected'
        const invoice = await Invoice.findByPk(req.params.id, {
            include: [
                {
                    model: Customer,
                    include: [{ model: LedgerAccount, as: 'LedgerAccount' }]
                },
                { model: InvoiceItem, include: [Item] }
            ],
            transaction: t
        });
        if (!invoice) {
            await t.rollback();
            return res.status(404).json({ error: 'Invoice not found' });
        }
        if (!['Approved', 'Rejected'].includes(status)) {
            await t.rollback();
            return res.status(400).json({ error: 'Invalid status. Must be Approved or Rejected.' });
        }

        const currentUserId = req.user && req.user.id ? req.user.id : null;
        await invoice.update({
            status,
            updatedBy: currentUserId
        }, { transaction: t });

        let deliveryOrderUpdated = false;
        let transactionLogged = false;

        // When invoice is approved, create transaction records only (no journal entry)
        if (status === 'Approved') {
            try {
                // 1. Get Customer Ledger Account
                let customerAccount = invoice.Customer?.LedgerAccount;

                // If customer doesn't have a ledger account, create one
                if (!customerAccount && invoice.Customer) {
                    const controlAccount = await ControlAccount.findOne({
                        where: { controlType: 'CUSTOMER', status: 'Active' },
                        transaction: t
                    });

                    if (controlAccount) {
                        const prefixCode = controlAccount.code;
                        const lastAccount = await LedgerAccount.findOne({
                            where: {
                                controlAccountId: controlAccount.id,
                                ledgerCode: { [Op.like]: `${prefixCode}%` }
                            },
                            order: [['ledgerCode', 'DESC']],
                            attributes: ['ledgerCode'],
                            transaction: t
                        });

                        let nextNumber = 1;
                        if (lastAccount && lastAccount.ledgerCode) {
                            const numericPart = lastAccount.ledgerCode.substring(prefixCode.length);
                            const lastNumber = parseInt(numericPart, 10);
                            if (!isNaN(lastNumber)) {
                                nextNumber = lastNumber + 1;
                            }
                        }
                        const ledgerCode = `${prefixCode}${String(nextNumber).padStart(3, '0')}`;

                        customerAccount = await LedgerAccount.create({
                            ledgerCode,
                            name: `Customer - ${invoice.Customer.name}`,
                            description: `Auto-generated ledger for customer ${invoice.Customer.name}`,
                            accountTypeId: controlAccount.accountTypeId,
                            accountCategoryId: controlAccount.accountCategoryId,
                            isUseControlAccount: true,
                            controlAccountId: controlAccount.id,
                            ledgerType: 'GENERAL',
                            createdBy: currentUserId
                        }, { transaction: t });

                        // Update customer with new ledger account
                        await invoice.Customer.update({ ledgerAccountId: customerAccount.id }, { transaction: t });
                    }
                }

                let salesAccount = await LedgerAccount.findOne({
                    where: {
                        [Op.or]: [
                            { name: { [Op.like]: '%Sales%' } },
                            { name: { [Op.like]: '%Income%' } },
                            { ledgerCode: { [Op.like]: '%SALES%' } }
                        ]
                    },
                    transaction: t
                });

                if (!salesAccount) {
                    const salesCategory = await AccountCategory.findOne({
                        where: { name: 'Operating Income' },
                        transaction: t
                    });

                    if (salesCategory && salesCategory.code) {
                        const prefixCode = salesCategory.code;
                        const lastAccount = await LedgerAccount.findOne({
                            where: {
                                accountCategoryId: salesCategory.id,
                                ledgerCode: { [Op.like]: `${prefixCode}00%` }
                            },
                            order: [['ledgerCode', 'DESC']],
                            attributes: ['ledgerCode'],
                            transaction: t
                        });

                        let nextNumber = 1;
                        if (lastAccount && lastAccount.ledgerCode) {
                            const numericPart = lastAccount.ledgerCode.substring(5);
                            const lastNumber = parseInt(numericPart, 10);
                            if (!isNaN(lastNumber)) {
                                nextNumber = lastNumber + 1;
                            }
                        }
                        const ledgerCode = `${prefixCode}${String(nextNumber).padStart(5, '0')}`;

                        salesAccount = await LedgerAccount.create({
                            ledgerCode,
                            name: 'Sales Income',
                            description: 'Auto-generated sales income account',
                            accountTypeId: salesCategory.accountTypeId,
                            accountCategoryId: salesCategory.id,
                            ledgerType: 'SYSTEM',
                            createdBy: currentUserId
                        }, { transaction: t });
                    }
                }

                let taxAccount = null;
                if (invoice.taxAmount > 0) {
                    taxAccount = await LedgerAccount.findOne({
                        where: {
                            [Op.or]: [
                                { name: { [Op.like]: '%Vat 18% Payable%' } },
                                { name: { [Op.like]: '%VAT%' } },
                                { ledgerCode: { [Op.like]: '%20300002%' } }
                            ]
                        },
                        transaction: t
                    });

                    if (!taxAccount) {
                        const taxCategory = await AccountCategory.findOne({
                            where: { name: 'Current Liabilities' },
                            transaction: t
                        });

                        if (taxCategory && taxCategory.code) {
                            const prefixCode = taxCategory.code;
                            const lastAccount = await LedgerAccount.findOne({
                                where: {
                                    accountCategoryId: taxCategory.id,
                                    ledgerCode: { [Op.like]: `${prefixCode}00%` }
                                },
                                order: [['ledgerCode', 'DESC']],
                                attributes: ['ledgerCode'],
                                transaction: t
                            });

                            let nextNumber = 1;
                            if (lastAccount && lastAccount.ledgerCode) {
                                const numericPart = lastAccount.ledgerCode.substring(5);
                                const lastNumber = parseInt(numericPart, 10);
                                if (!isNaN(lastNumber)) {
                                    nextNumber = lastNumber + 1;
                                }
                            }
                            const ledgerCode = `${prefixCode}${String(nextNumber).padStart(5, '0')}`;

                            taxAccount = await LedgerAccount.create({
                                ledgerCode,
                                name: 'VAT Payable',
                                description: 'Auto-generated tax payable account',
                                accountTypeId: taxCategory.accountTypeId,
                                accountCategoryId: taxCategory.id,
                                ledgerType: 'SYSTEM',
                                createdBy: currentUserId
                            }, { transaction: t });
                        }
                    }
                }

                // If accounts not found, get first available accounts (fallback)
                if (!customerAccount) {
                    customerAccount = await LedgerAccount.findOne({ transaction: t });
                }
                if (!salesAccount) {
                    salesAccount = await LedgerAccount.findOne({
                        where: { id: { [Op.ne]: customerAccount?.id } },
                        transaction: t
                    });
                }

                if (!customerAccount || !salesAccount) {
                    throw new Error('Required ledger accounts (Customer Receivable, Sales) not found in chart of accounts');
                }

                // Prepare transaction details for logging
                const transactionDetails = [];

                // DR: Customer Receivable Account (total of invoice)
                transactionDetails.push({
                    ledgerAccountId: customerAccount.id,
                    debitAmount: invoice.total,
                    creditAmount: 0,
                    description: `Customer receivable for Invoice ${invoice.invoiceNumber}`,
                    lineNumber: 1
                });

                // CR: Sales Income Account (sale amount without tax)
                transactionDetails.push({
                    ledgerAccountId: salesAccount.id,
                    debitAmount: 0,
                    creditAmount: invoice.total - (invoice.taxAmount || 0),
                    description: `Sales income from Invoice ${invoice.invoiceNumber}`,
                    lineNumber: 2
                });

                // CR: Tax Payable Account //invoice.isTaxInvoice &&(if tax invoice)
                if (invoice.taxAmount > 0 && taxAccount) {
                    transactionDetails.push({
                        ledgerAccountId: taxAccount.id,
                        debitAmount: 0,
                        creditAmount: invoice.taxAmount,
                        description: `Sales tax payable for Invoice ${invoice.invoiceNumber}`,
                        lineNumber: 3
                    });
                }

                // Commit transaction BEFORE attempting delivery order confirmation
                // This ensures invoice status update is saved
                await t.commit();

                // Confirm delivery order if linked (OUTSIDE transaction after commit)
                if (invoice.deliveryOrderId) {
                    try {
                        // Create a new transaction just for delivery order confirmation
                        const doTransaction = await sequelize.transaction();
                        try {
                            await confirmDeliveryOrderInTransaction(invoice.deliveryOrderId, doTransaction, currentUserId);
                            await doTransaction.commit();
                            deliveryOrderUpdated = true;
                            console.log('Delivery Order confirmed for deliveryOrderId:', invoice.deliveryOrderId);
                        } catch (doConfirmError) {
                            if (!doTransaction.finished) {
                                await doTransaction.rollback();
                            }
                            console.warn('Warning: Could not confirm delivery order:', doConfirmError.message);
                            // Don't fail - DO confirmation is optional
                        }
                    } catch (confirmError) {
                        console.warn('Warning: Delivery order confirmation error:', confirmError.message);
                        // Don't fail the entire invoice approval, just log the warning
                    }
                }

                // Log transaction to transaction_header and transaction_detail tables AFTER commit
                // This prevents lock timeout issues
                try {
                    console.log('Logging invoice transaction with:', {
                        invoiceId: invoice.id,
                        invoiceNumber: invoice.invoiceNumber,
                        transactionDetails: transactionDetails.length,
                        userId: currentUserId
                    });

                    await TransactionService.logInvoiceTransaction(
                        invoice,
                        transactionDetails,
                        currentUserId
                    );

                    console.log('Transaction logged for invoice approval:', invoice.invoiceNumber);
                    transactionLogged = true;
                } catch (logError) {
                    console.error('Warning: Failed to log transaction:', logError.message);
                    console.error('Stack trace:', logError.stack);
                    // Don't fail the entire process if transaction logging fails
                }
            } catch (error) {
                console.error('Error processing invoice approval:', error.message);
                await t.rollback();
                return res.status(400).json({
                    error: `Invoice approval failed: ${error.message}`
                });
            }
        }

        // If rejected status, just commit the invoice status update
        if (status === 'Rejected') {
            await t.commit();
        }

        res.json({
            message: `Invoice ${status.toLowerCase()}`,
            invoice: {
                ...invoice.toJSON(),
                status,
                updatedBy: currentUserId
            },
            ...(deliveryOrderUpdated ? { deliveryOrderUpdated: true } : {}),
            ...(transactionLogged ? { transactionLogged: true } : {})
        });
    } catch (error) {
        if (!t.finished) {
            await t.rollback();
        }
        res.status(400).json({ error: error.message });
    }
};

// Get all outstanding invoices report
exports.getOutstandingInvoicesReport = async (req, res) => {
    try {
        const { locationId, customerId, createdBy } = req.query;

        // Base where clause: Invoice.total > Invoice.paidAmount
        const whereClause = {
            [Op.and]: [
                sequelize.where(sequelize.col('Invoice.total'), '>', sequelize.col('Invoice.paidAmount'))
            ],
            status: { [Op.ne]: 'Cancelled' }
        };

        // Add optional filters if provided
        if (locationId) whereClause.locationId = locationId;
        if (customerId) whereClause.customerId = customerId;
        if (createdBy) whereClause.createdBy = createdBy;

        // Fetch invoices with customer details
        const outstandingInvoices = await Invoice.findAll({
            where: whereClause,
            include: [
                {
                    model: Customer,
                    attributes: ['id', 'name', 'contactNumber', 'address', 'type']
                }
            ],
            order: [
                ['createdAt', 'DESC']
            ]
        });

        // Get all approved but unutilized returns for these invoices
        const invoiceIds = outstandingInvoices.map(inv => inv.id);
        const linkedReturns = await CustomerReturn.findAll({
            where: {
                invoiceId: { [Op.in]: invoiceIds },
                status: 'Approved'
            }
        });

        // Get all approved but unapplied credit notes for these invoices
        const linkedCreditNotes = await CreditNote.findAll({
            where: {
                invoiceId: { [Op.in]: invoiceIds },
                status: 'Approved'
            }
        });

        // Map to flat report format as requested
        const result = outstandingInvoices.map(invoice => {
            const data = invoice.toJSON();
            const total = Number(data.total) || 0;
            const paidAmount = Number(data.paidAmount) || 0;
            const setoffAmount = Number(data.setoffAmount) || 0;
            let outstandingAmount = total - (paidAmount + setoffAmount);

            // Subtract linked returns
            linkedReturns.filter(r => r.invoiceId === data.id).forEach(r => {
                const available = (parseFloat(r.totalAmount) || 0) - (parseFloat(r.utilizedAmount) || 0);
                outstandingAmount -= Math.max(0, available);
            });

            // Subtract linked credit notes
            linkedCreditNotes.filter(cn => cn.invoiceId === data.id).forEach(cn => {
                const available = (parseFloat(cn.total) || 0) - (parseFloat(cn.appliedAmount) || 0);
                outstandingAmount -= Math.max(0, available);
            });

            return {
                id: data.id,
                invoiceNumber: data.invoiceNumber,
                invoiceDate: data.invoiceDate,
                customerName: data.Customer ? data.Customer.name : 'N/A',
                total: total,
                paidAmount: paidAmount,
                outstandingAmount: Number(Math.max(0, outstandingAmount).toFixed(2)),
                status: data.status,
                customerContact: data.Customer ? data.Customer.contactNumber : null,
                customerAddress: data.Customer ? data.Customer.address : null
            };
        });

        res.json(result);
    } catch (error) {
        console.error('Error fetching outstanding invoices report:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message
        });
    }
};

// Get list of customers who have outstanding invoices
exports.getOutstandingCustomers = async (req, res) => {
    try {
        const { locationId, createdBy } = req.query;

        // Base where clause for outstanding invoices
        const invoiceWhere = {
            [Op.and]: [
                sequelize.where(sequelize.col('Invoice.total'), '>', sequelize.literal('Invoice.paidAmount + Invoice.setoffAmount'))
            ],
            status: { [Op.ne]: 'Cancelled' }
        };

        if (locationId) invoiceWhere.locationId = locationId;
        if (createdBy) invoiceWhere.createdBy = createdBy;

        const customers = await Customer.findAll({
            attributes: ['id', 'name', 'contactNumber', 'address', 'type'],
            order: [['name', 'ASC']]
        });

        const result = [];

        for (const customer of customers) {
            // Get all outstanding invoices for this customer
            const invoices = await Invoice.findAll({
                where: {
                    customerId: customer.id,
                    status: { [Op.ne]: 'Cancelled' },
                    [Op.and]: [
                        sequelize.where(sequelize.col('Invoice.total'), '>', sequelize.literal('Invoice.paidAmount + Invoice.setoffAmount'))
                    ],
                }
            });

            // Get all approved credits
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

                // Linked credits
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

            // Unlinked credits
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

        res.json(result);
    } catch (error) {
        console.error('Error fetching outstanding customers:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message
        });
    }
};
