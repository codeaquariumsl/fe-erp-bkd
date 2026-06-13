const { BillEntry, BillEntryDetail, BillPayment, PaymentAllocation, Supplier, JournalEntry, JournalEntryLine, LedgerAccount, User, sequelize } = require('../models');
const { Op } = require('sequelize');
const AutoPostingService = require('../utils/autoPostingService');
const models = require('../models');

/**
 * Generate unique Bill Number
 */
const generateBillNumber = async () => {
    try {
        const lastBill = await BillEntry.findOne({
            order: [['id', 'DESC']]
        });

        const nextNumber = (lastBill ? parseInt(lastBill.billNumber.substring(2)) : 0) + 1;
        return `BE${String(nextNumber).padStart(6, '0')}`;
    } catch (error) {
        throw error;
    }
};

/**
 * Create Bill Entry with Details
 */
exports.createBillEntry = async (req, res) => {
    try {
        const { supplierId, supplierInvoiceNumber, billDate, dueDate, description, amount, taxRate, taxAmount, grnId, purchaseOrderId, currencyCode, paymentTerms, details } = req.body;

        // Validation
        if (!supplierId || !supplierInvoiceNumber || !billDate || !dueDate || !amount) {
            return res.status(400).json({
                error: 'Supplier ID, supplier invoice number, bill date, due date, and amount are required'
            });
        }

        // Verify supplier exists
        const supplier = await Supplier.findByPk(supplierId);
        if (!supplier) {
            return res.status(400).json({ error: `Supplier with ID ${supplierId} not found` });
        }

        // Validate details array if provided
        if (details && !Array.isArray(details)) {
            return res.status(400).json({ error: 'Details must be an array' });
        }

        const billNumber = await generateBillNumber();
        const taxAmt = parseFloat(taxAmount) || 0;
        const billAmount = parseFloat(amount);
        const totalAmount = billAmount + taxAmt;

        // Create bill entry within transaction
        const transaction = await sequelize.transaction();
        try {
            const billEntry = await BillEntry.create({
                billNumber,
                supplierId,
                supplierInvoiceNumber,
                billDate,
                dueDate,
                description,
                amount: billAmount,
                taxRate: taxRate,
                taxAmount: taxAmt,
                totalAmount,
                grnId: grnId || null,
                purchaseOrderId: purchaseOrderId || null,
                currencyCode: currencyCode || 'LKR',
                paymentTerms: paymentTerms || 'Net 30',
                status: 'Submitted',
                createdBy: req.user.id
            }, { transaction });

            // Create bill entry details if provided
            if (details && details.length > 0) {
                const detailsToCreate = details.map((detail, index) => ({
                    billEntryId: billEntry.id,
                    ledgerId: detail.ledgerId,
                    description: detail.description,
                    quantity: detail.quantity || 0,
                    unitPrice: detail.unitPrice || 0,
                    amount: detail.amount,
                    taxAmount: detail.taxAmount || 0,
                    totalAmount: (parseFloat(detail.amount) || 0) + (parseFloat(detail.taxAmount) || 0),
                    taxPercentage: detail.taxPercentage || 0,
                    lineNumber: index + 1,
                    remarks: detail.remarks,
                    createdBy: req.user.id
                }));

                await BillEntryDetail.bulkCreate(detailsToCreate, { transaction });
            }

            await transaction.commit();

            // Fetch complete bill with relationships
            const completeBill = await BillEntry.findByPk(billEntry.id, {
                include: [
                    { model: Supplier, as: 'Supplier', attributes: ['id', 'name', 'email'] },
                    { model: User, as: 'Creator', attributes: ['id', 'fullName', 'email'] },
                    {
                        model: BillEntryDetail,
                        as: 'Details',
                        attributes: ['id', 'billEntryId', 'ledgerId', 'description', 'quantity', 'unitPrice', 'amount', 'taxAmount', 'totalAmount', 'taxPercentage', 'lineNumber', 'remarks'],
                        include: [
                            { model: LedgerAccount, as: 'LedgerAccount', attributes: ['id', 'ledgerCode', 'name'] }
                        ]
                    }
                ]
            });

            res.status(201).json({
                message: 'Bill Entry with details created successfully',
                data: completeBill
            });
        } catch (error) {
            if (!transaction.finished) {
                await transaction.rollback();
            }
            throw error;
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get all Bill Entries
 */
exports.getAllBillEntries = async (req, res) => {
    try {
        const { supplierId, status, dateFrom, dateTo, page = 1, limit = 10, search } = req.query;
        const where = {};

        if (supplierId) where.supplierId = supplierId;
        if (status) where.status = status;
        if (dateFrom || dateTo) {
            where.billDate = {};
            if (dateFrom) where.billDate[Op.gte] = new Date(dateFrom);
            if (dateTo) where.billDate[Op.lte] = new Date(dateTo);
        }

        if (search) {
            where[Op.or] = [
                { billNumber: { [Op.like]: `%${search}%` } },
                { supplierInvoiceNumber: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } },
                { '$Supplier.name$': { [Op.like]: `%${search}%` } }
            ];
        }

        const offset = (page - 1) * limit;

        const { count, rows } = await BillEntry.findAndCountAll({
            where,
            include: [
                { model: Supplier, as: 'Supplier', attributes: ['id', 'name', 'email'] },
                { model: User, as: 'Creator', attributes: ['id', 'fullName', 'email'] },
                { model: User, as: 'ApprovedByUser', attributes: ['id', 'fullName', 'email'] },
                { model: User, as: 'PostedByUser', attributes: ['id', 'fullName', 'email'] },
                {
                    model: BillEntryDetail,
                    as: 'Details',
                    attributes: ['id', 'billEntryId', 'ledgerId', 'description', 'quantity', 'unitPrice', 'amount', 'taxAmount', 'totalAmount', 'taxPercentage', 'lineNumber', 'remarks'],
                    include: [
                        { model: LedgerAccount, as: 'LedgerAccount', attributes: ['id', 'ledgerCode', 'name'] }
                    ]
                }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['billDate', 'DESC'], ['billNumber', 'DESC']],
            distinct: true
        });

        res.json({
            message: 'Bill Entries retrieved successfully',
            data: rows,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get Bill Entry by ID
 */
exports.getBillEntryById = async (req, res) => {
    try {
        const { id } = req.params;

        const billEntry = await BillEntry.findByPk(id, {
            include: [
                { model: Supplier, as: 'Supplier' },
                { model: JournalEntry, as: 'JournalEntry' },
                { model: User, as: 'Creator', attributes: ['id', 'fullName', 'email'] },
                { model: User, as: 'ApprovedByUser', attributes: ['id', 'fullName', 'email'] },
                { model: User, as: 'PostedByUser', attributes: ['id', 'fullName', 'email'] },
                {
                    model: BillEntryDetail,
                    as: 'Details',
                    attributes: ['id', 'billEntryId', 'ledgerId', 'description', 'quantity', 'unitPrice', 'amount', 'taxAmount', 'totalAmount', 'taxPercentage', 'lineNumber', 'remarks'],
                    include: [
                        { model: LedgerAccount, as: 'LedgerAccount', attributes: ['id', 'ledgerCode', 'name', 'description'] }
                    ]
                }
            ]
        });

        if (!billEntry) {
            return res.status(404).json({ error: 'Bill Entry not found' });
        }

        res.json({
            message: 'Bill Entry retrieved successfully',
            data: billEntry
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Update Bill Entry (Draft only) with Details
 */
exports.updateBillEntry = async (req, res) => {
    try {
        const { id } = req.params;
        const { billDate, dueDate, description, amount, taxAmount, paymentTerms, details } = req.body;

        const billEntry = await BillEntry.findByPk(id, {
            include: [{ model: Supplier, as: 'Supplier' }]
        });
        if (!billEntry) {
            return res.status(404).json({ error: 'Bill Entry not found' });
        }

        if (billEntry.status !== 'Draft' && billEntry.status !== 'Posted') {
            return res.status(400).json({ error: 'Only Draft or Posted bills can be updated' });
        }

        const transaction = await sequelize.transaction();
        try {
            const updates = {};
            if (billDate) updates.billDate = billDate;
            if (dueDate) updates.dueDate = dueDate;
            if (description) updates.description = description;
            if (paymentTerms) updates.paymentTerms = paymentTerms;

            if (amount || taxAmount) {
                const newAmount = amount ? parseFloat(amount) : billEntry.amount;
                const newTaxAmount = taxAmount ? parseFloat(taxAmount) : billEntry.taxAmount;
                updates.amount = newAmount;
                updates.taxAmount = newTaxAmount;
                updates.totalAmount = newAmount + newTaxAmount;
            }

            updates.updatedBy = req.user.id;

            await billEntry.update(updates, { transaction });

            // Update details if provided
            if (details && Array.isArray(details)) {
                // Delete existing details
                await BillEntryDetail.destroy({
                    where: { billEntryId: id },
                    transaction
                });

                // Create new details
                const detailsToCreate = details.map((detail, index) => ({
                    billEntryId: id,
                    ledgerId: detail.ledgerId,
                    description: detail.description,
                    quantity: detail.quantity || 0,
                    unitPrice: detail.unitPrice || 0,
                    amount: detail.amount,
                    taxAmount: detail.taxAmount || 0,
                    totalAmount: (parseFloat(detail.amount) || 0) + (parseFloat(detail.taxAmount) || 0),
                    taxPercentage: detail.taxPercentage || 0,
                    lineNumber: index + 1,
                    remarks: detail.remarks,
                    createdBy: req.user.id
                }));

                await BillEntryDetail.bulkCreate(detailsToCreate, { transaction });
            }

            // If Posted, update the accounting transactions
            if (billEntry.status === 'Posted') {
                const updatedBill = await BillEntry.findByPk(id, {
                    include: [
                        { model: Supplier, as: 'Supplier' },
                        { model: BillEntryDetail, as: 'Details' }
                    ],
                    transaction
                });

                // Prepare transaction details (same logic as in postBillEntry)
                const transactionDetails = [];
                let lineNumber = 1;

                // Find tax account if bill has tax
                let taxAccount = null;
                const totalTaxAmount = parseFloat(updatedBill.taxAmount) || 0;

                if (totalTaxAmount > 0) {
                    taxAccount = await LedgerAccount.findOne({
                        where: {
                            [Op.or]: [
                                { name: { [Op.like]: '%Tax Receivable%' } },
                                { name: { [Op.like]: '%Input Tax%' } },
                                { name: { [Op.like]: '%Input VAT%' } },
                                { name: { [Op.like]: '%VAT%' } },
                                { ledgerCode: { [Op.like]: '%TAX%' } }
                            ]
                        },
                        transaction
                    });
                }

                for (const detail of updatedBill.Details) {
                    const debitAmount = (taxAccount && totalTaxAmount > 0)
                        ? parseFloat(detail.amount)
                        : parseFloat(detail.totalAmount || detail.amount);

                    transactionDetails.push({
                        ledgerAccountId: detail.ledgerId,
                        debitAmount: debitAmount,
                        creditAmount: 0,
                        description: detail.description || `Bill line item - ${updatedBill.billNumber}`,
                        lineNumber: lineNumber++
                    });
                }

                if (totalTaxAmount > 0 && taxAccount) {
                    transactionDetails.push({
                        ledgerAccountId: taxAccount.id,
                        debitAmount: totalTaxAmount,
                        creditAmount: 0,
                        description: `Purchase Tax Input - ${updatedBill.billNumber}`,
                        lineNumber: lineNumber++
                    });
                }

                // Supplier Payable
                let supplierLedgerId = updatedBill.Supplier.ledgerAccountId || null;
                if (!supplierLedgerId) {
                    const supplierControlAccount = await LedgerAccount.findOne({
                        where: {
                            [Op.or]: [
                                { ledgerCode: { [Op.like]: '%SUPPLIER%' } },
                                { ledgerCode: { [Op.like]: '%PAYABLE%' } }
                            ]
                        },
                        transaction
                    });
                    supplierLedgerId = supplierControlAccount ? supplierControlAccount.id : null;
                }

                transactionDetails.push({
                    ledgerAccountId: supplierLedgerId,
                    debitAmount: 0,
                    creditAmount: parseFloat(updatedBill.totalAmount),
                    description: `Supplier Payable - ${updatedBill.billNumber}`,
                    lineNumber: lineNumber++
                });

                // Use a custom method in TransactionService to update the transaction
                const TransactionService = require('../utils/transactionService');
                
                // Helper to update TransactionHeader and Details
                const { TransactionHeader, TransactionDetail } = require('../models');
                
                const header = await TransactionHeader.findOne({
                    where: { referenceId: id, transactionModule: 'BILL_ENTRY' },
                    transaction
                });

                if (header) {
                    await header.update({
                        transactionDate: updatedBill.billDate,
                        totalDebit: parseFloat(updatedBill.totalAmount),
                        totalCredit: parseFloat(updatedBill.totalAmount),
                        updatedBy: req.user.id
                    }, { transaction });

                    await TransactionDetail.destroy({
                        where: { transactionHeaderId: header.id },
                        transaction
                    });

                    await TransactionDetail.bulkCreate(transactionDetails.map(d => ({
                        ...d,
                        transactionHeaderId: header.id,
                        createdBy: req.user.id
                    })), { transaction });
                }
            }

            await transaction.commit();

            const updatedBill = await BillEntry.findByPk(id, {
                include: [
                    { model: Supplier, as: 'Supplier', attributes: ['id', 'name', 'email'] },
                    { model: User, as: 'Creator', attributes: ['id', 'fullName', 'email'] },
                    {
                        model: BillEntryDetail,
                        as: 'Details',
                        attributes: ['id', 'billEntryId', 'ledgerId', 'description', 'quantity', 'unitPrice', 'amount', 'taxAmount', 'totalAmount', 'taxPercentage', 'lineNumber', 'remarks'],
                        include: [
                            { model: LedgerAccount, as: 'LedgerAccount', attributes: ['id', 'ledgerCode', 'name'] }
                        ]
                    }
                ]
            });

            res.json({
                message: 'Bill Entry updated successfully',
                data: updatedBill
            });
        } catch (error) {
            if (!transaction.finished) {
                await transaction.rollback();
            }
            throw error;
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Submit Bill Entry for Approval
 */
exports.submitBillEntry = async (req, res) => {
    try {
        const { id } = req.params;

        const billEntry = await BillEntry.findByPk(id);
        if (!billEntry) {
            return res.status(404).json({ error: 'Bill Entry not found' });
        }

        if (billEntry.status !== 'Draft') {
            return res.status(400).json({ error: 'Only Draft bills can be submitted' });
        }

        await billEntry.update({
            status: 'Submitted',
            updatedBy: req.user.id
        });

        res.json({
            message: 'Bill Entry submitted for approval',
            data: billEntry
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Approve Bill Entry
 */
exports.approveBillEntry = async (req, res) => {
    try {
        const { id } = req.params;

        const billEntry = await BillEntry.findByPk(id);
        if (!billEntry) {
            return res.status(404).json({ error: 'Bill Entry not found' });
        }

        if (billEntry.status !== 'Submitted') {
            return res.status(400).json({ error: 'Only Submitted bills can be approved' });
        }

        await billEntry.update({
            status: 'Approved',
            approvalStatus: 'Approved',
            approvedAt: new Date(),
            approvedBy: req.user.id,
            updatedBy: req.user.id
        });

        res.json({
            message: 'Bill Entry approved successfully',
            data: billEntry
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Post Bill Entry (Create Transactions)
 */
exports.postBillEntry = async (req, res) => {
    try {
        const { id } = req.params;

        const billEntry = await BillEntry.findByPk(id, {
            include: [
                { model: Supplier, as: 'Supplier' },
                {
                    model: BillEntryDetail,
                    as: 'Details',
                    attributes: ['id', 'billEntryId', 'ledgerId', 'description', 'quantity', 'unitPrice', 'amount', 'taxAmount', 'totalAmount', 'taxPercentage', 'lineNumber', 'remarks'],
                    include: [
                        { model: LedgerAccount, as: 'LedgerAccount', attributes: ['id', 'ledgerCode', 'name'] }
                    ]
                }
            ]
        });

        if (!billEntry) {
            return res.status(404).json({ error: 'Bill Entry not found' });
        }

        if (billEntry.status !== 'Approved') {
            return res.status(400).json({ error: 'Only Approved bills can be posted' });
        }

        // Check if bill has details
        if (!billEntry.Details || billEntry.Details.length === 0) {
            return res.status(400).json({ error: 'Bill Entry must have at least one detail line to post' });
        }

        // Get supplier's ledger account ID or find a default supplier control account
        let supplierLedgerId = billEntry.Supplier.ledgerAccountId || null;
        if (!supplierLedgerId) {
            const supplierControlAccount = await LedgerAccount.findOne({
                where: {
                    [Op.or]: [
                        { ledgerCode: { [Op.like]: '%SUPPLIER%' } },
                        { ledgerCode: { [Op.like]: '%PAYABLE%' } },
                        { name: { [Op.like]: '%Supplier%' } }
                    ]
                }
            });
            supplierLedgerId = supplierControlAccount ? supplierControlAccount.id : null;
        }

        if (!supplierLedgerId) {
            return res.status(400).json({ error: 'No supplier ledger account or control account found. Please configure accounts first.' });
        }

        // Prepare transaction details
        const transactionDetails = [];
        let lineNumber = 1;

        // Find tax account if bill has tax
        let taxAccount = null;
        const totalTaxAmount = parseFloat(billEntry.taxAmount) || 0;

        if (totalTaxAmount > 0) {
            taxAccount = await LedgerAccount.findOne({
                where: {
                    [Op.or]: [
                        { name: { [Op.like]: '%Tax Receivable%' } },
                        { name: { [Op.like]: '%Input Tax%' } },
                        { name: { [Op.like]: '%Input VAT%' } },
                        { name: { [Op.like]: '%Tax Recoverable%' } },
                        { name: { [Op.like]: '%VAT%' } },
                        { ledgerCode: { [Op.like]: '%TAX%' } },
                        { ledgerCode: { [Op.like]: '%VAT%' } }
                    ]
                }
            });

            if (!taxAccount) {
                console.warn('Tax amount exists but no tax account found. Posting total amounts to original ledgers.');
            }
        }

        // 1. Debit lines from bill details (usually Expense or Asset accounts)
        for (const detail of billEntry.Details) {
            // If tax account is found, we subtract tax from detail line to post it separately
            // Otherwise, we post the total amount (amount + tax) to the detail's ledger
            const debitAmount = (taxAccount && totalTaxAmount > 0)
                ? parseFloat(detail.amount)
                : parseFloat(detail.totalAmount || detail.amount);

            transactionDetails.push({
                ledgerAccountId: detail.ledgerId,
                debitAmount: debitAmount,
                creditAmount: 0,
                description: detail.description || `Bill line item - ${billEntry.billNumber}`,
                lineNumber: lineNumber++
            });
        }

        // 1.b Add separate tax line if applicable and account found
        if (totalTaxAmount > 0 && taxAccount) {
            transactionDetails.push({
                ledgerAccountId: taxAccount.id,
                debitAmount: totalTaxAmount,
                creditAmount: 0,
                description: `Purchase Tax Input - ${billEntry.billNumber}`,
                lineNumber: lineNumber++
            });
        }

        // 2. Credit line to Supplier control account (Liability)
        transactionDetails.push({
            ledgerAccountId: supplierLedgerId,
            debitAmount: 0,
            creditAmount: parseFloat(billEntry.totalAmount),
            description: `Supplier Payable - ${billEntry.billNumber}`,
            lineNumber: lineNumber++
        });

        // Log to transaction tables
        const TransactionService = require('../utils/transactionService');
        const transactionHeader = await TransactionService.logBillEntryTransaction(
            billEntry,
            transactionDetails,
            req.user.id
        );

        await billEntry.update({
            status: 'Posted',
            postedAt: new Date(),
            postedBy: req.user.id,
            updatedBy: req.user.id
        });

        const updatedBill = await BillEntry.findByPk(id, {
            include: [
                { model: Supplier, as: 'Supplier' },
                {
                    model: BillEntryDetail,
                    as: 'Details',
                    attributes: ['id', 'billEntryId', 'ledgerId', 'description', 'quantity', 'unitPrice', 'amount', 'taxAmount', 'totalAmount', 'taxPercentage', 'lineNumber', 'remarks'],
                    include: [
                        { model: LedgerAccount, as: 'LedgerAccount', attributes: ['id', 'ledgerCode', 'name'] }
                    ]
                }
            ]
        });

        res.json({
            message: 'Bill Entry posted and transactions created successfully',
            data: updatedBill,
            transactionNumber: transactionHeader.transactionNumber
        });
    } catch (error) {
        console.error('Error posting bill entry:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Reject Bill Entry
 */
exports.rejectBillEntry = async (req, res) => {
    try {
        const { id } = req.params;
        const { rejectionReason } = req.body;

        const billEntry = await BillEntry.findByPk(id);
        if (!billEntry) {
            return res.status(404).json({ error: 'Bill Entry not found' });
        }

        if (!['Draft', 'Submitted'].includes(billEntry.status)) {
            return res.status(400).json({ error: 'Only Draft or Submitted bills can be rejected' });
        }

        await billEntry.update({
            status: 'Rejected',
            approvalStatus: 'Rejected',
            rejectionReason,
            updatedBy: req.user.id
        });

        res.json({
            message: 'Bill Entry rejected',
            data: billEntry
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Delete Draft Bill Entry
 */
exports.deleteBillEntry = async (req, res) => {
    try {
        const { id } = req.params;

        const billEntry = await BillEntry.findByPk(id);
        if (!billEntry) {
            return res.status(404).json({ error: 'Bill Entry not found' });
        }

        if (billEntry.status !== 'Draft' && billEntry.status !== 'Posted') {
            return res.status(400).json({ error: 'Only Draft or Posted bills can be deleted' });
        }

        const transaction = await sequelize.transaction();
        try {
            if (billEntry.status === 'Posted') {
                const { TransactionHeader, TransactionDetail } = require('../models');
                const header = await TransactionHeader.findOne({
                    where: { referenceId: id, transactionModule: 'BILL_ENTRY' },
                    transaction
                });

                if (header) {
                    await TransactionDetail.destroy({
                        where: { transactionHeaderId: header.id },
                        transaction
                    });
                    await header.destroy({ transaction });
                }
            }

            await billEntry.destroy({ transaction });
            await transaction.commit();

            res.json({
                message: `${billEntry.status} Bill Entry deleted successfully`
            });
        } catch (error) {
            if (!transaction.finished) {
                await transaction.rollback();
            }
            throw error;
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get Bill Payment History
 */
exports.getBillPaymentHistory = async (req, res) => {
    try {
        const { id } = req.params;

        const billEntry = await BillEntry.findByPk(id);
        if (!billEntry) {
            return res.status(404).json({ error: 'Bill Entry not found' });
        }

        const allocations = await PaymentAllocation.findAll({
            where: { billEntryId: id },
            include: [
                {
                    model: BillPayment,
                    as: 'BillPayment',
                    attributes: ['id', 'paymentNumber', 'paymentDate', 'paymentMethod', 'status']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json({
            message: 'Bill payment history retrieved successfully',
            data: {
                billEntry: {
                    id: billEntry.id,
                    billNumber: billEntry.billNumber,
                    totalAmount: billEntry.totalAmount,
                    paidAmount: billEntry.paidAmount,
                    balance: billEntry.totalAmount - billEntry.paidAmount
                },
                allocations
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get Outstanding Bills for Supplier
 */
exports.getOutstandingBills = async (req, res) => {
    try {
        const { supplierId } = req.params;
        const { page = 1, limit = 10 } = req.query;

        const offset = (page - 1) * limit;

        const { count, rows } = await BillEntry.findAndCountAll({
            where: {
                supplierId,
                status: ['Posted', 'Partially Paid'],
                [Op.where]: sequelize.where(
                    sequelize.col('BillEntry.paidAmount'),
                    Op.lt,
                    sequelize.col('BillEntry.totalAmount')
                )
            },
            include: [
                { model: Supplier, as: 'Supplier' },
                {
                    model: BillEntryDetail,
                    as: 'Details',
                    attributes: ['id', 'billEntryId', 'ledgerId', 'description', 'quantity', 'unitPrice', 'amount', 'taxAmount', 'totalAmount', 'taxPercentage', 'lineNumber', 'remarks'],
                    include: [
                        { model: LedgerAccount, as: 'LedgerAccount', attributes: ['id', 'ledgerCode', 'name'] }
                    ]
                },
                {
                    model: PaymentAllocation,
                    as: 'PaymentAllocations',
                    attributes: ['id', 'billPaymentId', 'allocatedAmount', 'createdAt'],
                    include: [
                        {
                            model: BillPayment,
                            as: 'BillPayment',
                            attributes: ['id', 'paymentNumber', 'paymentDate', 'status']
                        }
                    ]
                },
                { model: JournalEntry, as: 'JournalEntry' }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['dueDate', 'ASC']],
            distinct: true
        });

        // Calculate actual outstanding amounts for each bill
        const billsWithOutstanding = rows.map(bill => {
            const billData = bill.toJSON();

            // Calculate total allocated amount from PaymentAllocation
            const totalAllocated = billData.PaymentAllocations
                ? billData.PaymentAllocations.reduce((sum, allocation) => {
                    return sum + parseFloat(allocation.allocatedAmount || 0);
                }, 0)
                : 0;

            // Calculate outstanding balance
            const outstandingAmount = parseFloat(billData.totalAmount) - totalAllocated;

            return {
                ...billData,
                totalAllocated,
                outstandingAmount,
                // Also include for backward compatibility
                balance: outstandingAmount
            };
        });

        res.json({
            message: 'Outstanding bills retrieved successfully',
            data: billsWithOutstanding,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Add Bill Entry Detail
 */
exports.addBillEntryDetail = async (req, res) => {
    try {
        const { billEntryId } = req.params;
        const { ledgerId, description, quantity, unitPrice, amount, taxAmount, taxPercentage, remarks } = req.body;

        const billEntry = await BillEntry.findByPk(billEntryId);
        if (!billEntry) {
            return res.status(404).json({ error: 'Bill Entry not found' });
        }

        if (billEntry.status !== 'Draft') {
            return res.status(400).json({ error: 'Can only add details to Draft bills' });
        }

        if (!ledgerId || !amount) {
            return res.status(400).json({ error: 'Ledger ID and amount are required' });
        }

        const ledger = await LedgerAccount.findByPk(ledgerId);
        if (!ledger) {
            return res.status(404).json({ error: `Ledger account with ID ${ledgerId} not found` });
        }

        const lastDetail = await BillEntryDetail.findOne({
            where: { billEntryId },
            order: [['lineNumber', 'DESC']]
        });
        const nextLineNumber = (lastDetail ? lastDetail.lineNumber : 0) + 1;

        const detail = await BillEntryDetail.create({
            billEntryId,
            ledgerId,
            description,
            quantity: quantity || 0,
            unitPrice: unitPrice || 0,
            amount: parseFloat(amount),
            taxAmount: parseFloat(taxAmount) || 0,
            totalAmount: parseFloat(amount) + (parseFloat(taxAmount) || 0),
            taxPercentage: taxPercentage || 0,
            lineNumber: nextLineNumber,
            remarks,
            createdBy: req.user.id
        });

        const completeDetail = await BillEntryDetail.findByPk(detail.id, {
            include: [
                { model: LedgerAccount, as: 'LedgerAccount', attributes: ['id', 'ledgerCode', 'name'] },
                { model: User, as: 'Creator', attributes: ['id', 'fullName'] }
            ]
        });

        res.status(201).json({
            message: 'Bill Entry detail added successfully',
            data: completeDetail
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Update Bill Entry Detail
 */
exports.updateBillEntryDetail = async (req, res) => {
    try {
        const { billEntryId, detailId } = req.params;
        const { ledgerId, description, quantity, unitPrice, amount, taxAmount, taxPercentage, remarks } = req.body;

        const detail = await BillEntryDetail.findByPk(detailId);
        if (!detail || detail.billEntryId !== parseInt(billEntryId)) {
            return res.status(404).json({ error: 'Bill Entry Detail not found' });
        }

        const billEntry = await BillEntry.findByPk(billEntryId);
        if (billEntry.status !== 'Draft') {
            return res.status(400).json({ error: 'Can only update details in Draft bills' });
        }

        const updates = {};
        if (ledgerId) {
            const ledger = await LedgerAccount.findByPk(ledgerId);
            if (!ledger) {
                return res.status(404).json({ error: `Ledger account with ID ${ledgerId} not found` });
            }
            updates.ledgerId = ledgerId;
        }
        if (description !== undefined) updates.description = description;
        if (quantity !== undefined) updates.quantity = quantity;
        if (unitPrice !== undefined) updates.unitPrice = unitPrice;
        if (amount !== undefined) {
            updates.amount = parseFloat(amount);
            if (!taxAmount) {
                updates.totalAmount = parseFloat(amount) + (detail.taxAmount || 0);
            }
        }
        if (taxAmount !== undefined) {
            updates.taxAmount = parseFloat(taxAmount);
            if (!amount) {
                updates.totalAmount = (detail.amount || 0) + parseFloat(taxAmount);
            }
        }
        if (amount && taxAmount) {
            updates.totalAmount = parseFloat(amount) + parseFloat(taxAmount);
        }
        if (taxPercentage !== undefined) updates.taxPercentage = taxPercentage;
        if (remarks !== undefined) updates.remarks = remarks;

        updates.updatedBy = req.user.id;

        await detail.update(updates);

        const updatedDetail = await BillEntryDetail.findByPk(detailId, {
            include: [
                { model: LedgerAccount, as: 'LedgerAccount', attributes: ['id', 'ledgerCode', 'name'] },
                { model: User, as: 'Creator', attributes: ['id', 'fullName'] },
                { model: User, as: 'Updater', attributes: ['id', 'fullName'] }
            ]
        });

        res.json({
            message: 'Bill Entry detail updated successfully',
            data: updatedDetail
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Delete Bill Entry Detail
 */
exports.deleteBillEntryDetail = async (req, res) => {
    try {
        const { billEntryId, detailId } = req.params;

        const detail = await BillEntryDetail.findByPk(detailId);
        if (!detail || detail.billEntryId !== parseInt(billEntryId)) {
            return res.status(404).json({ error: 'Bill Entry Detail not found' });
        }

        const billEntry = await BillEntry.findByPk(billEntryId);
        if (billEntry.status !== 'Draft') {
            return res.status(400).json({ error: 'Can only delete details from Draft bills' });
        }

        await detail.destroy();

        res.json({
            message: 'Bill Entry detail deleted successfully'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get Bill Entry Details
 */
exports.getBillEntryDetails = async (req, res) => {
    try {
        const { billEntryId } = req.params;

        const billEntry = await BillEntry.findByPk(billEntryId);
        if (!billEntry) {
            return res.status(404).json({ error: 'Bill Entry not found' });
        }

        const details = await BillEntryDetail.findAll({
            where: { billEntryId },
            attributes: ['id', 'billEntryId', 'ledgerId', 'description', 'quantity', 'unitPrice', 'amount', 'taxAmount', 'totalAmount', 'taxPercentage', 'lineNumber', 'remarks'],
            include: [
                { model: LedgerAccount, as: 'LedgerAccount', attributes: ['id', 'ledgerCode', 'name', 'description'] },
                { model: User, as: 'Creator', attributes: ['id', 'fullName'] },
                { model: User, as: 'Updater', attributes: ['id', 'fullName'] }
            ],
            order: [['lineNumber', 'ASC']]
        });

        res.json({
            message: 'Bill Entry details retrieved successfully',
            billNumber: billEntry.billNumber,
            billEntryId: billEntry.id,
            data: details
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
