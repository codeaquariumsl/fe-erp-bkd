const {
    sequelize,
    CustomerReturn,
    CustomerReturnItem,
    Customer,
    Item,
    User,
    ReturnType,
    SalesOrder,
    Invoice,
    DeliveryOrder,
    Batch,
    Unit,
    Location,
    Store,
    ColdRoom,
    PalletRack,
    LedgerAccount,
    Stock,
    BatchItem,
    StockDetail,
    ControlAccount,
    InvoiceItem
} = require('../models');
const { generateDocumentNumber } = require('./documentControllerClient');
const TransactionService = require('../utils/transactionService');
const { Op } = require('sequelize');

// Create a new customer return with items
exports.createCustomerReturn = async (req, res) => {
    const t = await CustomerReturn.sequelize.transaction();
    try {
        const {
            customerId,
            salesOrderId,
            invoiceId,
            deliveryOrderId,
            returnTypeId,
            reason,
            notes,
            locationId,
            storeId,
            subTotal,
            taxAmount,
            taxRate,
            discountAmount,
            isTaxReturn,
            returnDate,
            items
        } = req.body;

        // Generate return number
        const returnNumber = await generateDocumentNumber('CR', locationId);

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        // Validate customer exists
        const customer = await Customer.findByPk(customerId, { transaction: t });
        if (!customer) {
            await t.rollback();
            return res.status(400).json({ error: 'Customer not found' });
        }

        // Validate return type exists
        const returnType = await ReturnType.findByPk(returnTypeId, { transaction: t });
        if (!returnType) {
            await t.rollback();
            return res.status(400).json({ error: 'Return type not found' });
        }

        // Calculate total amount
        let totalAmount = 0;
        if (Array.isArray(items)) {
            totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.totalPrice) || 0), 0);
        }

        // Create customer return
        const customerReturn = await CustomerReturn.create({
            returnNumber,
            customerId,
            salesOrderId,
            invoiceId,
            deliveryOrderId,
            returnTypeId,
            reason,
            totalAmount,
            notes,
            locationId,
            storeId,
            subTotal: subTotal || 0,
            taxAmount: taxAmount || 0,
            taxRate: taxRate || 0,
            discountAmount: discountAmount || 0,
            isTaxReturn: isTaxReturn || false,
            returnDate: returnDate || new Date(),
            createdBy: currentUserId,
            updatedBy: currentUserId
        }, { transaction: t });

        // Add items
        if (Array.isArray(items)) {
            for (const item of items) {
                // Validate item exists
                const itemExists = await Item.findByPk(item.itemId, { transaction: t });
                if (!itemExists) {
                    await t.rollback();
                    return res.status(400).json({ error: `Item not found: ${item.itemId}` });
                }

                await CustomerReturnItem.create({
                    customerReturnId: customerReturn.id,
                    itemId: item.itemId,
                    batchId: item.batchId || null,
                    quantity: item.quantity,
                    discount: item.discount || 0,
                    unitPrice: item.unitPrice,
                    totalPrice: item.totalPrice,
                    unitId: item.unitId || null,
                    condition: item.condition || 'Good',
                    expiryDate: item.expiryDate || null,
                    serialNumbers: item.serialNumbers || null,
                    reason: item.reason || null,
                    disposition: item.disposition || 'Refund',
                    isRefundable: item.isRefundable !== undefined ? item.isRefundable : true,
                    refundAmount: item.refundAmount || 0,
                    taxAmount: item.taxAmount || 0,
                    excludingTaxAmount: item.excludingTaxAmount || 0,
                    coldRoomId: item.coldRoomId || null,
                    palletRackId: item.palletRackId || null,
                    notes: item.notes || null,
                    createdBy: currentUserId,
                    updatedBy: currentUserId
                }, { transaction: t });
            }
        }

        await t.commit();

        // Fetch the created return with all associations (outside transaction)
        const createdReturn = await CustomerReturn.findByPk(customerReturn.id, {
            include: [
                {
                    model: Customer,
                    as: 'Customer',
                    attributes: ['id', 'name', 'type', 'contactPerson', 'contactNumber']
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
                }
            ]
        });

        res.status(201).json(createdReturn);
    } catch (error) {
        // Only rollback if transaction hasn't been committed yet
        if (!t.finished) {
            await t.rollback();
        }
        console.error('Error creating customer return:', error);
        res.status(400).json({ error: error.message });
    }
};

// Get remaining returnable qty per item for a specific invoice
exports.getInvoiceRemainingQty = async (req, res) => {
    try {
        const { invoiceId } = req.params;

        // 1. Get the original invoice items
        const invoiceItems = await InvoiceItem.findAll({
            where: { invoiceId },
            include: [
                {
                    model: Item,
                    as: 'Item',
                    attributes: ['id', 'name', 'sku']
                }
            ]
        });

        if (!invoiceItems || invoiceItems.length === 0) {
            return res.json({ invoiceId: parseInt(invoiceId), items: [] });
        }

        // 2. Get all customer return items linked to this invoice (via CustomerReturn.invoiceId),
        //    excluding Cancelled and Rejected returns
        const existingReturnItems = await CustomerReturnItem.findAll({
            include: [
                {
                    model: CustomerReturn,
                    as: 'CustomerReturn',
                    where: {
                        invoiceId: invoiceId,
                        status: { [Op.notIn]: ['Cancelled', 'Rejected'] }
                    },
                    required: true,
                    attributes: ['id', 'returnNumber', 'status']
                }
            ]
        });

        // 3. Sum returned quantities per itemId
        const returnedQtyMap = {};
        existingReturnItems.forEach(ri => {
            const itemId = ri.itemId;
            returnedQtyMap[itemId] = (returnedQtyMap[itemId] || 0) + parseFloat(ri.quantity || 0);
        });

        // 4. Build the remaining qty response
        const items = invoiceItems.map(invItem => {
            const originalQty = parseFloat(invItem.qty || 0);
            const returnedQty = returnedQtyMap[invItem.itemId] || 0;
            const remainingQty = Math.max(0, originalQty - returnedQty);
            return {
                itemId: invItem.itemId,
                itemName: invItem.Item?.name || '-',
                itemSku: invItem.Item?.sku || '-',
                originalQty,
                returnedQty,
                remainingQty,
                price: parseFloat(invItem.price || 0),
                discount: parseFloat(invItem.discount || 0)
            };
        });

        res.json({ invoiceId: parseInt(invoiceId), items });
    } catch (error) {
        console.error('Error fetching invoice remaining qty:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get all customer returns (with server-side pagination + search)
exports.getCustomerReturns = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 25));
        const offset = (page - 1) * limit;
        const search = req.query.search ? req.query.search.trim() : null;

        const whereClause = { locationId: req.query.locationId || { [Op.ne]: null } };

        if (req.query.status && req.query.status !== 'all') {
            whereClause.status = req.query.status;
        }

        if (req.query.customerId && req.query.customerId !== 'all') {
            whereClause.customerId = req.query.customerId;
        }

        if (req.query.hasBalance === 'true') {
            whereClause[Op.and] = [
                ...(whereClause[Op.and] || []),
                sequelize.where(sequelize.col('totalAmount'), '>', sequelize.col('utilizedAmount'))
            ];
        }

        if (req.query.startDate && req.query.endDate) {
            whereClause.createdAt = { [Op.between]: [req.query.startDate, req.query.endDate] };
        } else if (req.query.startDate) {
            whereClause.createdAt = { [Op.gte]: req.query.startDate };
        } else if (req.query.endDate) {
            whereClause.createdAt = { [Op.lte]: req.query.endDate };
        }

        if (search) {
            whereClause[Op.or] = [
                { returnNumber: { [Op.like]: `%${search}%` } },
                { reason: { [Op.like]: `%${search}%` } },
                { '$Customer.name$': { [Op.like]: `%${search}%` } }
            ];
        }

        // 1. Get filtered and paginated IDs
        const { count, rows: returns } = await CustomerReturn.findAndCountAll({
            where: whereClause,
            include: [
                { model: Customer, as: 'Customer', attributes: ['id', 'name'] }
            ],
            order: [['createdAt', 'DESC']],
            limit,
            offset,
            distinct: true,
            subQuery: false
        });

        if (returns.length === 0) {
            return res.json({ data: [], total: count, page, totalPages: 0, limit });
        }

        // 2. Fetch full details for the paginated subset
        const returnIds = returns.map(r => r.id);
        const detailedReturns = await CustomerReturn.findAll({
            where: { id: { [Op.in]: returnIds } },
            include: [
                {
                    model: Customer,
                    as: 'Customer',
                    attributes: ['id', 'name', 'type', 'contactPerson', 'contactNumber', 'address']
                },
                {
                    model: ReturnType,
                    as: 'ReturnType',
                    attributes: ['id', 'name', 'code']
                },
                {
                    model: Invoice,
                    as: 'Invoice',
                    attributes: ['id', 'invoiceNumber', 'invoiceDate']
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
                },
                {
                    model: User,
                    as: 'ApprovedByUser',
                    attributes: ['id', 'username']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json({
            data: detailedReturns,
            total: count,
            page,
            totalPages: Math.ceil(count / limit),
            limit
        });
    } catch (error) {
        console.error('Error fetching customer returns:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get a single customer return by ID
exports.getCustomerReturnById = async (req, res) => {
    try {
        const customerReturn = await CustomerReturn.findByPk(req.params.id, {
            include: [
                {
                    model: Customer,
                    as: 'Customer',
                    attributes: ['id', 'name', 'type', 'contactPerson', 'contactNumber', 'email', 'address']
                },
                {
                    model: ReturnType,
                    as: 'ReturnType',
                    attributes: ['id', 'name', 'code', 'description']
                },
                {
                    model: SalesOrder,
                    as: 'SalesOrder',
                    attributes: ['id', 'orderNumber', 'orderDate']
                },
                {
                    model: Invoice,
                    as: 'Invoice',
                    attributes: ['id', 'invoiceNumber', 'invoiceDate']
                },
                {
                    model: DeliveryOrder,
                    as: 'DeliveryOrder',
                    attributes: ['id', 'deliveryOrderNumber', 'deliveryDate']
                },
                {
                    model: Location,
                    as: 'Location',
                    attributes: ['id', 'name']
                },
                {
                    model: Store,
                    as: 'Store',
                    attributes: ['id', 'name']
                },
                {
                    model: CustomerReturnItem,
                    as: 'CustomerReturnItems',
                    include: [
                        {
                            model: Item,
                            as: 'Item',
                            attributes: ['id', 'name', 'sku', 'barcode']
                        },
                        {
                            model: Batch,
                            as: 'Batch',
                            attributes: ['id', 'batchNumber', 'expireDate']
                        },
                        {
                            model: Unit,
                            as: 'Unit',
                            attributes: ['id', 'name', 'symbol']
                        },
                        {
                            model: ColdRoom,
                            as: 'ColdRoom',
                            attributes: ['id', 'name']
                        },
                        {
                            model: PalletRack,
                            as: 'PalletRack',
                            attributes: ['id', 'rackNumber']
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
                },
                {
                    model: User,
                    as: 'ApprovedByUser',
                    attributes: ['id', 'username']
                }
            ]
        });

        if (!customerReturn) {
            return res.status(404).json({ error: 'Customer return not found' });
        }

        res.json(customerReturn);
    } catch (error) {
        console.error('Error fetching customer return:', error);
        res.status(500).json({ error: error.message });
    }
};

// Update a customer return
exports.updateCustomerReturn = async (req, res) => {
    const t = await CustomerReturn.sequelize.transaction();
    try {
        const customerReturn = await CustomerReturn.findByPk(req.params.id, { transaction: t });
        if (!customerReturn) {
            await t.rollback();
            return res.status(404).json({ error: 'Customer return not found' });
        }

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const { items, ...updateData } = req.body;

        // Update the customer return
        await customerReturn.update({
            ...updateData,
            updatedBy: currentUserId
        }, { transaction: t });

        // If items are provided, update them
        if (Array.isArray(items)) {
            // Delete existing items
            await CustomerReturnItem.destroy({
                where: { customerReturnId: customerReturn.id },
                transaction: t
            });

            // Add new items
            for (const item of items) {
                await CustomerReturnItem.create({
                    customerReturnId: customerReturn.id,
                    ...item,
                    taxAmount: item.taxAmount || 0,
                    excludingTaxAmount: item.excludingTaxAmount || 0,
                    createdBy: currentUserId,
                    updatedBy: currentUserId
                }, { transaction: t });
            }

            // Recalculate total amount
            const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.totalPrice) || 0), 0);
            await customerReturn.update({ totalAmount }, { transaction: t });
        }

        await t.commit();

        // Fetch updated return (outside transaction)
        const updatedReturn = await CustomerReturn.findByPk(customerReturn.id, {
            include: [
                {
                    model: Customer,
                    as: 'Customer',
                    attributes: ['id', 'name', 'type']
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
                }
            ]
        });

        res.json(updatedReturn);
    } catch (error) {
        // Only rollback if transaction hasn't been committed yet
        if (!t.finished) {
            await t.rollback();
        }
        console.error('Error updating customer return:', error);
        res.status(400).json({ error: error.message });
    }
};

// Approve/Reject a customer return
exports.approveCustomerReturn = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { status, notes } = req.body; // 'Approved' or 'Rejected'
        const customerReturn = await CustomerReturn.findByPk(req.params.id, {
            include: [{
                model: Customer,
                as: 'Customer',
                include: [{ model: LedgerAccount, as: 'LedgerAccount' }]
            }],
            transaction: t
        });

        if (!customerReturn) {
            await t.rollback();
            return res.status(404).json({ error: 'Customer return not found' });
        }

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        await customerReturn.update({
            status,
            approvedBy: currentUserId,
            approvedDate: new Date(),
            notes: notes || customerReturn.notes,
            updatedBy: currentUserId
        }, { transaction: t });

        if (status === 'Approved') {
            // return stock to the store
            const items = await CustomerReturnItem.findAll({
                where: { customerReturnId: customerReturn.id },
                transaction: t
            });

            for (const item of items) {
                // Update Stock
                let stock = await Stock.findOne({
                    where: {
                        itemId: item.itemId,
                        storeId: customerReturn.storeId,
                        locationId: customerReturn.locationId
                    },
                    transaction: t
                });

                if (stock) {
                    await stock.increment('availableQty', { by: item.quantity, transaction: t });
                } else {
                    // Create new stock if not exists
                    stock = await Stock.create({
                        itemId: item.itemId,
                        storeId: customerReturn.storeId,
                        locationId: customerReturn.locationId,
                        availableQty: item.quantity,
                        createdBy: currentUserId,
                        updatedBy: currentUserId,
                        status: 'Active'
                    }, { transaction: t });
                }

                // Create StockDetail
                await StockDetail.create({
                    stockId: stock.id,
                    documentType: 'Customer Return',
                    documentId: customerReturn.id,
                    inOut: 'IN',
                    qty: item.quantity,
                    date: new Date(),
                    remark: `Return: ${customerReturn.returnNumber}`,
                    createdBy: currentUserId,
                    updatedBy: currentUserId
                }, { transaction: t });

                // Update BatchItem if batchId is present
                if (item.batchId) {
                    let batchItem = await BatchItem.findOne({
                        where: {
                            batchId: item.batchId,
                            itemId: item.itemId,
                            storeId: customerReturn.storeId,
                            locationId: customerReturn.locationId
                        },
                        transaction: t
                    });

                    if (batchItem) {
                        await batchItem.increment('availableQuantity', { by: item.quantity, transaction: t });
                    } else {
                        // Create batch item entry if it doesn't exist in this store/location
                        await BatchItem.create({
                            batchId: item.batchId,
                            itemId: item.itemId,
                            storeId: customerReturn.storeId,
                            locationId: customerReturn.locationId,
                            availableQuantity: item.quantity,
                            batchQuantity: item.quantity, // Initial quantity for this location
                            createdBy: currentUserId,
                            updatedBy: currentUserId
                        }, { transaction: t });
                    }
                }
            }
        }

        // Commit the status update first, similar to invoice approval pattern
        await t.commit();

        let transactionLogged = false;
        if (status === 'Approved') {
            // return stock to the store



            try {
                const amount = parseFloat(customerReturn.totalAmount) || 0;
                if (amount > 0) {
                    // Find appropriate ledger accounts
                    // 1. Customer Receivable Account
                    // 1. Customer Receivable Account
                    let customerAccount = customerReturn.Customer?.LedgerAccount;

                    // If customer doesn't have a ledger account, create one
                    if (!customerAccount && customerReturn.Customer) {
                        const controlAccount = await ControlAccount.findOne({
                            where: { controlType: 'CUSTOMER', status: 'Active' }
                        });

                        if (controlAccount) {
                            const prefixCode = controlAccount.code;
                            const lastAccount = await LedgerAccount.findOne({
                                where: {
                                    controlAccountId: controlAccount.id,
                                    ledgerCode: { [Op.like]: `${prefixCode}%` }
                                },
                                order: [['ledgerCode', 'DESC']],
                                attributes: ['ledgerCode']
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
                                name: `Customer - ${customerReturn.Customer.name}`,
                                description: `Auto-generated ledger for customer ${customerReturn.Customer.name}`,
                                accountTypeId: controlAccount.accountTypeId,
                                accountCategoryId: controlAccount.accountCategoryId,
                                isUseControlAccount: true,
                                controlAccountId: controlAccount.id,
                                ledgerType: 'GENERAL',
                                createdBy: currentUserId
                            });

                            // Update customer with new ledger account
                            await customerReturn.Customer.update({ ledgerAccountId: customerAccount.id });
                        }
                    }

                    // 2. Sales Return Account
                    let salesReturnAccount = await LedgerAccount.findOne({
                        where: {
                            [Op.or]: [
                                { name: { [Op.like]: '%Sales Return%' } },
                                { name: { [Op.like]: '%Return%' } },
                                { ledgerCode: { [Op.like]: '%SR%' } }
                            ]
                        }
                    });

                    // Fallback for sales return if not found
                    if (!salesReturnAccount) {
                        salesReturnAccount = await LedgerAccount.findOne({
                            where: {
                                [Op.or]: [
                                    { name: { [Op.like]: '%Sales%' } },
                                    { ledgerCode: { [Op.like]: '%SALES%' } }
                                ]
                            }
                        });
                    }

                    if (customerAccount && salesReturnAccount) {
                        const transactionDetails = [
                            {
                                ledgerAccountId: salesReturnAccount.id,
                                debitAmount: amount,
                                creditAmount: 0,
                                description: `Customer Return - ${customerReturn.returnNumber}`,
                                lineNumber: 1
                            },
                            {
                                ledgerAccountId: customerAccount.id,
                                debitAmount: 0,
                                creditAmount: amount,
                                description: `Customer Return - ${customerReturn.returnNumber}`,
                                lineNumber: 2
                            }
                        ];

                        await TransactionService.logCustomerReturnTransaction(
                            customerReturn,
                            transactionDetails,
                            currentUserId
                        );
                        transactionLogged = true;
                        console.log(`Transaction logged for customer return approval: ${customerReturn.returnNumber}`);
                    } else {
                        console.warn('Could not find appropriate ledger accounts for customer return transaction');
                    }
                }
            } catch (logError) {
                console.error('Warning: Failed to log customer return transaction:', logError.message);
                // We don't fail the request if transaction logging fails (as per invoice pattern)
            }
        }

        res.json({
            message: `Customer return ${status.toLowerCase()} successfully`,
            customerReturn,
            transactionLogged
        });
    } catch (error) {
        if (t && !t.finished) {
            await t.rollback();
        }
        console.error('Error approving customer return:', error);
        res.status(400).json({ error: error.message });
    }
};

// Delete a customer return
exports.deleteCustomerReturn = async (req, res) => {
    const t = await CustomerReturn.sequelize.transaction();
    try {
        const customerReturn = await CustomerReturn.findByPk(req.params.id, { transaction: t });
        if (!customerReturn) {
            await t.rollback();
            return res.status(404).json({ error: 'Customer return not found' });
        }

        // Delete associated items first (cascade delete should handle this, but being explicit)
        await CustomerReturnItem.destroy({
            where: { customerReturnId: customerReturn.id },
            transaction: t
        });

        // Delete the customer return
        await customerReturn.destroy({ transaction: t });

        await t.commit();
        res.json({ message: 'Customer return deleted successfully' });
    } catch (error) {
        // Only rollback if transaction hasn't been committed yet
        if (!t.finished) {
            await t.rollback();
        }
        console.error('Error deleting customer return:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get customer return statistics
exports.getCustomerReturnStats = async (req, res) => {
    try {
        const { startDate, endDate, customerId, locationId, status } = req.query;

        const whereClause = {};
        if (customerId && customerId !== 'all') whereClause.customerId = customerId;
        if (locationId) whereClause.locationId = locationId;
        if (status && status !== 'all') whereClause.status = status;
        if (startDate && endDate) {
            whereClause.returnDate = {
                [Op.between]: [new Date(startDate), new Date(endDate)]
            };
        }

        const stats = await CustomerReturn.findAll({
            where: whereClause,
            attributes: [
                'status',
                [CustomerReturn.sequelize.fn('COUNT', CustomerReturn.sequelize.col('id')), 'count'],
                [CustomerReturn.sequelize.fn('SUM', CustomerReturn.sequelize.col('totalAmount')), 'totalAmount']
            ],
            group: ['status'],
            raw: true
        });

        res.json(stats);
    } catch (error) {
        console.error('Error fetching customer return stats:', error);
        res.status(500).json({ error: error.message });
    }
};
