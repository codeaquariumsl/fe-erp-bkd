const { BillPayment, BillPaymentDetail, BillPaymentEntry, BillEntry, Supplier, LedgerAccount, Bank, BankBranch, JournalEntry, TransactionHeader, TransactionDetail, User, sequelize, PaymentType } = require('../models');
const { Op } = require('sequelize');
const AutoPostingService = require('../utils/autoPostingService');
const TransactionService = require('../utils/transactionService');

/**
 * Generate unique Payment Number
 */
const generatePaymentNumber = async () => {
    try {
        const lastPayment = await BillPayment.findOne({
            order: [['id', 'DESC']]
        });

        const nextNumber = (lastPayment ? parseInt(lastPayment.paymentNumber.substring(2)) : 0) + 1;
        return `BP${String(nextNumber).padStart(6, '0')}`;
    } catch (error) {
        throw error;
    }
};

/**
 * Create Bill Payment
 */
exports.createBillPayment = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { supplierId, paymentDate, amount, description, referenceNumber, details: billEntries, payments: paymentDetails } = req.body;

        // Validation
        if (!supplierId || !paymentDate || !amount) {
            await transaction.rollback();
            return res.status(400).json({
                error: 'Supplier ID, payment date, and amount are required'
            });
        }

        // Validate details and payments arrays if provided
        if (billEntries && !Array.isArray(billEntries)) {
            await transaction.rollback();
            return res.status(400).json({ error: 'Details (bill entries) must be an array' });
        }
        if (paymentDetails && !Array.isArray(paymentDetails)) {
            await transaction.rollback();
            return res.status(400).json({ error: 'Payments (payment methods) must be an array' });
        }

        // Verify supplier exists
        const supplier = await Supplier.findByPk(supplierId, { transaction });
        if (!supplier) {
            await transaction.rollback();
            return res.status(400).json({ error: `Supplier with ID ${supplierId} not found` });
        }

        const paymentNumber = await generatePaymentNumber();
        const paymentAmount = parseFloat(amount);

        // Create bill payment
        const billPayment = await BillPayment.create({
            paymentNumber,
            supplierId,
            paymentDate,
            amount: paymentAmount,
            description,
            referenceNumber: referenceNumber || null,
            status: 'Draft',
            createdBy: req.user.id
        }, { transaction });

        // Create bill payment entries (bill allocations)
        if (billEntries && billEntries.length > 0) {
            const entriesToCreate = billEntries.map((entry, index) => ({
                billPaymentId: billPayment.id,
                billEntryId: entry.billEntryId || entry.billId,
                taxRate: entry.taxRate,
                taxAmount: entry.taxAmount,
                amount: parseFloat(entry.amount),
                description: entry.description || `Payment for bill ${entry.billEntryId || entry.billId}`,
                lineNumber: index + 1,
                createdBy: req.user.id
            }));
            await BillPaymentEntry.bulkCreate(entriesToCreate, { transaction });
        }

        // Create bill payment details (payment methods)
        if (paymentDetails && paymentDetails.length > 0) {
            const detailsToCreate = paymentDetails.map((detail, index) => ({
                billPaymentId: billPayment.id,
                amount: parseFloat(detail.paymentAmount || detail.amount),
                lineNumber: index + 1,
                paymentTypeId: detail.paymentTypeId,
                referenceNo: detail.referenceNo || detail.reference,
                ledgerAccountId: detail.ledgerAccountId,
                cardType: detail.cardType || null,
                bankId: detail.bankId || null,
                bankBranchId: detail.bankBranchId || null,
                chequeNo: detail.chequeNo || null,
                chequeDate: detail.chequeDate || null,
                createdBy: req.user.id
            }));

            await BillPaymentDetail.bulkCreate(detailsToCreate, { transaction });
        }

        await transaction.commit();

        // Fetch complete payment with relationships
        const completePayment = await BillPayment.findByPk(billPayment.id, {
            include: [
                { model: Supplier, as: 'Supplier', attributes: ['id', 'name', 'email'] },
                { model: User, as: 'Creator', attributes: ['id', 'fullName', 'email'] },
                {
                    model: BillPaymentEntry,
                    as: 'Entries',
                    include: [{ model: BillEntry, as: 'BillEntry' }]
                },
                {
                    model: BillPaymentDetail,
                    as: 'Details',
                    include: [
                        { model: LedgerAccount, as: 'LedgerAccount', include: [{ model: Bank, as: 'Bank' }, { model: BankBranch, as: 'Branch' }] }
                    ]
                }
            ]
        });

        res.status(201).json({
            message: 'Bill Payment created successfully',
            data: completePayment
        });
    } catch (error) {
        console.error('Error creating bill payment:', error);
        if (!transaction.finished) {
            await transaction.rollback();
        }
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get all Bill Payments
 */
exports.getAllBillPayments = async (req, res) => {
    try {
        const { supplierId, status, dateFrom, dateTo, page = 1, limit = 10 } = req.query;
        const where = {};

        if (supplierId) where.supplierId = supplierId;
        if (status) where.status = status;
        if (dateFrom || dateTo) {
            where.paymentDate = {};
            if (dateFrom) where.paymentDate[Op.gte] = new Date(dateFrom);
            if (dateTo) where.paymentDate[Op.lte] = new Date(dateTo);
        }

        const offset = (page - 1) * limit;

        const { count, rows } = await BillPayment.findAndCountAll({
            where,
            include: [
                { model: Supplier, as: 'Supplier', attributes: ['id', 'name', 'email', 'address', 'phone'] },
                { model: User, as: 'Creator', attributes: ['id', 'fullName', 'email'] },
                { model: User, as: 'ApprovedByUser', attributes: ['id', 'fullName', 'email'] },
                { model: User, as: 'PostedByUser', attributes: ['id', 'fullName', 'email'] },
                {
                    model: BillPaymentEntry,
                    as: 'Entries',
                    include: [{ model: BillEntry, as: 'BillEntry' }]
                },
                {
                    model: BillPaymentDetail,
                    as: 'Details',
                    include: [
                        { model: LedgerAccount, as: 'LedgerAccount' },
                        { model: PaymentType, as: 'PaymentType' },
                        { model: Bank, as: 'Bank' }
                    ]
                }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['paymentDate', 'DESC'], ['paymentNumber', 'DESC']],
            distinct: true
        });

        res.json({
            message: 'Bill Payments retrieved successfully',
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
 * Get Bill Payment by ID
 */
exports.getBillPaymentById = async (req, res) => {
    try {
        const { id } = req.params;

        const billPayment = await BillPayment.findByPk(id, {
            include: [
                { model: Supplier, as: 'Supplier' },
                {
                    model: BillPaymentEntry,
                    as: 'Entries',
                    include: [{ model: BillEntry, as: 'BillEntry' }]
                },
                {
                    model: BillPaymentDetail,
                    as: 'Details',
                    include: [{ model: LedgerAccount, as: 'LedgerAccount' }]
                },
                { model: TransactionHeader, as: 'TransactionHeader' },
                { model: User, as: 'Creator', attributes: ['id', 'fullName', 'email'] },
                { model: User, as: 'ApprovedByUser', attributes: ['id', 'fullName', 'email'] },
                { model: User, as: 'PostedByUser', attributes: ['id', 'fullName', 'email'] }
            ]
        });

        if (!billPayment) {
            return res.status(404).json({ error: 'Bill Payment not found' });
        }

        res.json({
            message: 'Bill Payment retrieved successfully',
            data: billPayment
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Allocate Payment to Bills
 */
exports.allocatePaymentToBills = async (req, res) => {
    try {
        const { id } = req.params;
        const { allocations } = req.body; // Array of { billEntryId, allocatedAmount }

        if (!allocations || !Array.isArray(allocations) || allocations.length === 0) {
            return res.status(400).json({ error: 'Allocations array is required' });
        }

        const billPayment = await BillPayment.findByPk(id);
        if (!billPayment) {
            return res.status(404).json({ error: 'Bill Payment not found' });
        }

        if (billPayment.status !== 'Draft') {
            return res.status(400).json({ error: 'Only Draft payments can be modified' });
        }

        // Validate total allocation doesn't exceed payment amount
        const totalAllocated = allocations.reduce((sum, alloc) => sum + parseFloat(alloc.allocatedAmount), 0);
        if (totalAllocated > billPayment.amount) {
            return res.status(400).json({
                error: `Total allocation (${totalAllocated}) cannot exceed payment amount (${billPayment.amount})`
            });
        }

        // Clear existing entries
        await BillPaymentEntry.destroy({ where: { billPaymentId: id } });

        // Create new entries
        for (const allocation of allocations) {
            // Verify bill exists
            const bill = await BillEntry.findByPk(allocation.billEntryId);
            if (!bill) {
                return res.status(400).json({ error: `Bill with ID ${allocation.billEntryId} not found` });
            }

            await BillPaymentEntry.create({
                billPaymentId: id,
                billEntryId: allocation.billEntryId,
                amount: parseFloat(allocation.allocatedAmount || allocation.amount),
                description: allocation.description || null,
                lineNumber: allocations.indexOf(allocation) + 1,
                createdBy: req.user.id
            });
        }

        const updatedPayment = await BillPayment.findByPk(id, {
            include: [
                {
                    model: BillPaymentEntry,
                    as: 'Entries',
                    include: [{ model: BillEntry, as: 'BillEntry', attributes: ['id', 'billNumber', 'totalAmount'] }]
                },
                {
                    model: BillPaymentDetail,
                    as: 'Details'
                }
            ]
        });

        res.json({
            message: 'Payment allocations updated successfully',
            data: updatedPayment
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get Bill Payment Entries
 */
exports.getBillPaymentEntries = async (req, res) => {
    try {
        const { id } = req.params;

        const entries = await BillPaymentEntry.findAll({
            where: { billPaymentId: id },
            include: [
                { model: BillEntry, as: 'BillEntry', attributes: ['id', 'billNumber', 'totalAmount', 'paidAmount'] }
            ]
        });

        res.json({
            message: 'Payment entries retrieved successfully',
            data: entries
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Submit Bill Payment for Approval
 */
exports.submitBillPayment = async (req, res) => {
    try {
        const { id } = req.params;

        const billPayment = await BillPayment.findByPk(id);
        if (!billPayment) {
            return res.status(404).json({ error: 'Bill Payment not found' });
        }

        if (billPayment.status !== 'Draft') {
            return res.status(400).json({ error: 'Only Draft payments can be submitted' });
        }

        await billPayment.update({
            status: 'Submitted',
            updatedBy: req.user.id
        });

        res.json({
            message: 'Bill Payment submitted for approval',
            data: billPayment
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Approve Bill Payment
 */
exports.approveBillPayment = async (req, res) => {
    try {
        const { id } = req.params;

        const billPayment = await BillPayment.findByPk(id);
        if (!billPayment) {
            return res.status(404).json({ error: 'Bill Payment not found' });
        }

        if (billPayment.status !== 'Submitted') {
            return res.status(400).json({ error: 'Only Submitted payments can be approved' });
        }

        await billPayment.update({
            status: 'Approved',
            approvalStatus: 'Approved',
            approvedAt: new Date(),
            approvedBy: req.user.id,
            updatedBy: req.user.id
        });

        res.json({
            message: 'Bill Payment approved successfully',
            data: billPayment
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Post Bill Payment (Create Transactions and Update Bill Status)
 */
exports.postBillPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { BillPaymentDetail } = require('../models');

        const billPayment = await BillPayment.findByPk(id, {
            include: [
                { model: Supplier, as: 'Supplier' },
                {
                    model: BillPaymentEntry,
                    as: 'Entries',
                    include: [{ model: BillEntry, as: 'BillEntry' }]
                },
                {
                    model: BillPaymentDetail,
                    as: 'Details'
                }
            ]
        });

        if (!billPayment) {
            return res.status(404).json({ error: 'Bill Payment not found' });
        }

        if (billPayment.status !== 'Approved') {
            return res.status(400).json({ error: 'Only Approved payments can be posted' });
        }

        // Check if payment has allocations/entries
        const hasEntries = billPayment.Entries && billPayment.Entries.length > 0;
        const hasDetails = billPayment.Details && billPayment.Details.length > 0;

        if (!hasEntries || !hasDetails) {
            return res.status(400).json({ error: 'Payment must have both bill entries and payment details to post' });
        }

        // Prepare transaction details for posting
        const transactionDetails = [];
        let lineNumber = 1;

        // Calculate total tax from entries
        const totalTaxAmount = billPayment.Entries.reduce((sum, entry) => sum + parseFloat(entry.taxAmount || 0), 0);
        let taxAccount = null;

        if (totalTaxAmount > 0) {
            taxAccount = await LedgerAccount.findOne({
                where: {
                    [Op.or]: [
                        { name: { [Op.like]: '%Tax Payable%' } },
                        { name: { [Op.like]: '%WHT%' } },
                        { name: { [Op.like]: '%Withholding%' } },
                        { name: { [Op.like]: '%VAT%' } },
                        { ledgerCode: { [Op.like]: '%TAX%' } },
                        { ledgerCode: { [Op.like]: '%WHT%' } }
                    ]
                }
            });

            if (!taxAccount) {
                console.warn('Tax amount exists in payment entries but no tax account found. Proceeding without separate tax line.');
            }
        }

        // 1. Debit Side: Supplier Control Account (reduces payable)
        if (billPayment.Supplier && billPayment.Supplier.ledgerAccountId) {
            transactionDetails.push({
                ledgerAccountId: billPayment.Supplier.ledgerAccountId,
                debitAmount: parseFloat(billPayment.amount),
                creditAmount: 0,
                description: `Bill Payment - ${billPayment.paymentNumber} to Supplier #${billPayment.supplierId}`,
                lineNumber: lineNumber++
            });
        } else {
            return res.status(400).json({ error: 'Supplier ledger account not found. Please configure supplier ledger account.' });
        }

        // 2. Credit Side: Each Payment Detail (Cash/Bank accounts)
        for (const detail of billPayment.Details) {
            const detailAmount = parseFloat(detail.amount);
            if (detailAmount <= 0) continue;

            transactionDetails.push({
                ledgerAccountId: detail.ledgerAccountId,
                debitAmount: 0,
                creditAmount: detailAmount,
                description: `Payment via detail line - ${billPayment.paymentNumber}`,
                lineNumber: lineNumber++
            });
        }

        // 3. Credit Side: Tax line (e.g. Withholding Tax)
        if (totalTaxAmount > 0 && taxAccount) {
            transactionDetails.push({
                ledgerAccountId: taxAccount.id,
                debitAmount: 0,
                creditAmount: totalTaxAmount,
                description: `Tax Deduction - ${billPayment.paymentNumber}`,
                lineNumber: lineNumber++
            });
        }

        // Log transaction directly to TransactionHeader and TransactionDetail tables
        const transactionHeader = await TransactionService.logBillPaymentTransaction(
            billPayment,
            transactionDetails,
            req.user.id
        );

        // Update bill payment status
        await billPayment.update({
            status: 'Posted',
            postedAt: new Date(),
            postedBy: req.user.id,
            transactionHeaderId: transactionHeader ? transactionHeader.id : null,
            updatedBy: req.user.id
        });

        // Update bill paid amounts and status based on Entries
        for (const entry of billPayment.Entries) {
            const bill = entry.BillEntry;
            if (!bill) continue;

            const allocationAmount = parseFloat(entry.amount);
            const currentPaidAmount = parseFloat(bill.paidAmount || 0);
            const totalAmount = parseFloat(bill.totalAmount || 0);

            const newPaidAmount = currentPaidAmount + allocationAmount;
            const newStatus = newPaidAmount >= totalAmount ? 'Paid' : 'Partially Paid';

            await bill.update({
                paidAmount: newPaidAmount,
                status: newStatus
            });
        }

        const updatedPayment = await BillPayment.findByPk(id, {
            include: [
                { model: Supplier, as: 'Supplier' },
                { model: TransactionHeader, as: 'TransactionHeader' },
                {
                    model: BillPaymentEntry,
                    as: 'Entries',
                    include: [{ model: BillEntry, as: 'BillEntry' }]
                },
                {
                    model: BillPaymentDetail,
                    as: 'Details',
                    include: [{ model: LedgerAccount, as: 'LedgerAccount' }]
                }
            ]
        });

        res.json({
            message: 'Bill Payment posted successfully',
            data: updatedPayment
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Reject Bill Payment
 */
exports.rejectBillPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { rejectionReason } = req.body;

        const billPayment = await BillPayment.findByPk(id);
        if (!billPayment) {
            return res.status(404).json({ error: 'Bill Payment not found' });
        }

        if (!['Draft', 'Submitted'].includes(billPayment.status)) {
            return res.status(400).json({ error: 'Only Draft or Submitted payments can be rejected' });
        }

        await billPayment.update({
            status: 'Rejected',
            approvalStatus: 'Rejected',
            rejectionReason,
            updatedBy: req.user.id
        });

        res.json({
            message: 'Bill Payment rejected',
            data: billPayment
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Update Bill Payment (Draft and Posted)
 */
exports.updateBillPayment = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { supplierId, paymentDate, amount, description, referenceNumber, details: billEntries, payments: paymentDetails } = req.body;

        const billPayment = await BillPayment.findByPk(id, {
            include: [
                { model: BillPaymentEntry, as: 'Entries', include: [{ model: BillEntry, as: 'BillEntry' }] },
                { model: BillPaymentDetail, as: 'Details' }
            ],
            transaction
        });

        if (!billPayment) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Bill Payment not found' });
        }

        if (billPayment.status !== 'Draft' && billPayment.status !== 'Posted') {
            await transaction.rollback();
            return res.status(400).json({ error: 'Only Draft or Posted payments can be updated' });
        }

        // If Posted, revert previous allocations first
        if (billPayment.status === 'Posted') {
            for (const entry of billPayment.Entries) {
                const bill = entry.BillEntry;
                if (bill) {
                    const currentPaid = parseFloat(bill.paidAmount || 0);
                    const newPaid = currentPaid - parseFloat(entry.amount);
                    const totalAmount = parseFloat(bill.totalAmount || 0);
                    
                    await bill.update({
                        paidAmount: Math.max(0, newPaid),
                        status: newPaid <= 0 ? 'Posted' : 'Partially Paid'
                    }, { transaction });
                }
            }
        }

        // Update core payment data
        await billPayment.update({
            supplierId: supplierId || billPayment.supplierId,
            paymentDate: paymentDate || billPayment.paymentDate,
            amount: amount || billPayment.amount,
            description: description || billPayment.description,
            referenceNumber: referenceNumber || billPayment.referenceNumber,
            updatedBy: req.user.id
        }, { transaction });

        // Update allocations (Entries)
        if (billEntries && Array.isArray(billEntries)) {
            await BillPaymentEntry.destroy({ where: { billPaymentId: id }, transaction });
            const entriesToCreate = billEntries.map((entry, index) => ({
                billPaymentId: id,
                billEntryId: entry.billEntryId || entry.billId,
                taxRate: entry.taxRate,
                taxAmount: entry.taxAmount,
                amount: parseFloat(entry.amount),
                description: entry.description || `Payment for bill ${entry.billEntryId || entry.billId}`,
                lineNumber: index + 1,
                createdBy: req.user.id
            }));
            await BillPaymentEntry.bulkCreate(entriesToCreate, { transaction });
        }

        // Update payment details
        if (paymentDetails && Array.isArray(paymentDetails)) {
            await BillPaymentDetail.destroy({ where: { billPaymentId: id }, transaction });
            const detailsToCreate = paymentDetails.map((detail, index) => ({
                billPaymentId: id,
                amount: parseFloat(detail.paymentAmount || detail.amount),
                lineNumber: index + 1,
                paymentTypeId: detail.paymentTypeId,
                referenceNo: detail.referenceNo || detail.reference,
                ledgerAccountId: detail.ledgerAccountId,
                cardType: detail.cardType || null,
                bankId: detail.bankId || null,
                bankBranchId: detail.bankBranchId || null,
                chequeNo: detail.chequeNo || null,
                chequeDate: detail.chequeDate || null,
                createdBy: req.user.id
            }));
            await BillPaymentDetail.bulkCreate(detailsToCreate, { transaction });
        }

        // If Posted, re-apply allocations and update accounting
        if (billPayment.status === 'Posted') {
            const updatedPayment = await BillPayment.findByPk(id, {
                include: [
                    { model: Supplier, as: 'Supplier' },
                    { model: BillPaymentEntry, as: 'Entries', include: [{ model: BillEntry, as: 'BillEntry' }] },
                    { model: BillPaymentDetail, as: 'Details' }
                ],
                transaction
            });

            // Re-apply paid amounts
            for (const entry of updatedPayment.Entries) {
                const bill = entry.BillEntry;
                if (bill) {
                    const newPaid = parseFloat(bill.paidAmount || 0) + parseFloat(entry.amount);
                    const total = parseFloat(bill.totalAmount || 0);
                    await bill.update({
                        paidAmount: newPaid,
                        status: newPaid >= total ? 'Paid' : 'Partially Paid'
                    }, { transaction });
                }
            }

            // Prepare Ledger Transactions
            const transactionDetails = [];
            let lineNumber = 1;

            // 1. Debit Supplier
            if (updatedPayment.Supplier && updatedPayment.Supplier.ledgerAccountId) {
                transactionDetails.push({
                    ledgerAccountId: updatedPayment.Supplier.ledgerAccountId,
                    debitAmount: parseFloat(updatedPayment.amount),
                    creditAmount: 0,
                    description: `Bill Payment - ${updatedPayment.paymentNumber} (Updated)`,
                    lineNumber: lineNumber++
                });
            }

            // 2. Credit Details
            for (const d of updatedPayment.Details) {
                transactionDetails.push({
                    ledgerAccountId: d.ledgerAccountId,
                    debitAmount: 0,
                    creditAmount: parseFloat(d.amount),
                    description: `Payment via detail line - ${updatedPayment.paymentNumber}`,
                    lineNumber: lineNumber++
                });
            }

            // Tax
            const totalTax = updatedPayment.Entries.reduce((sum, e) => sum + parseFloat(e.taxAmount || 0), 0);
            if (totalTax > 0) {
                const taxAccount = await LedgerAccount.findOne({
                    where: {
                        [Op.or]: [
                            { name: { [Op.like]: '%Tax Payable%' } },
                            { name: { [Op.like]: '%WHT%' } },
                            { ledgerCode: { [Op.like]: '%TAX%' } }
                        ]
                    },
                    transaction
                });
                if (taxAccount) {
                    transactionDetails.push({
                        ledgerAccountId: taxAccount.id,
                        debitAmount: 0,
                        creditAmount: totalTax,
                        description: `Tax Deduction - ${updatedPayment.paymentNumber}`,
                        lineNumber: lineNumber++
                    });
                }
            }

            // Update TransactionHeader/Details
            const header = await TransactionHeader.findOne({
                where: { referenceId: id, transactionModule: 'BILL_PAYMENT' },
                transaction
            });

            if (header) {
                await header.update({
                    transactionDate: updatedPayment.paymentDate,
                    totalDebit: parseFloat(updatedPayment.amount),
                    totalCredit: parseFloat(updatedPayment.amount),
                    updatedBy: req.user.id
                }, { transaction });

                await TransactionDetail.destroy({ where: { transactionHeaderId: header.id }, transaction });
                await TransactionDetail.bulkCreate(transactionDetails.map(td => ({
                    ...td,
                    transactionHeaderId: header.id,
                    createdBy: req.user.id
                })), { transaction });
            }
        }

        await transaction.commit();
        const finalPayment = await BillPayment.findByPk(id, {
            include: [
                { model: Supplier, as: 'Supplier' },
                { model: BillPaymentEntry, as: 'Entries' },
                { model: BillPaymentDetail, as: 'Details' }
            ]
        });

        res.json({ message: 'Bill Payment updated successfully', data: finalPayment });
    } catch (error) {
        if (!transaction.finished) await transaction.rollback();
        res.status(500).json({ error: error.message });
    }
};

/**
 * Cancel Bill Payment (Draft/Submitted only)
 */
exports.cancelBillPayment = async (req, res) => {
    try {
        const { id } = req.params;

        const billPayment = await BillPayment.findByPk(id);
        if (!billPayment) {
            return res.status(404).json({ error: 'Bill Payment not found' });
        }

        if (!['Draft', 'Submitted'].includes(billPayment.status)) {
            return res.status(400).json({ error: 'Only Draft or Submitted payments can be cancelled' });
        }

        await billPayment.update({
            status: 'Cancelled',
            updatedBy: req.user.id
        });

        res.json({
            message: 'Bill Payment cancelled',
            data: billPayment
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Delete Draft Bill Payment
 */
exports.deleteBillPayment = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { id } = req.params;

        const billPayment = await BillPayment.findByPk(id, {
            include: [{ model: BillPaymentEntry, as: 'Entries', include: [{ model: BillEntry, as: 'BillEntry' }] }],
            transaction
        });

        if (!billPayment) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Bill Payment not found' });
        }

        if (billPayment.status !== 'Draft' && billPayment.status !== 'Posted') {
            await transaction.rollback();
            return res.status(400).json({ error: 'Only Draft or Posted payments can be deleted' });
        }

        // If Posted, revert allocations and delete ledger transactions
        if (billPayment.status === 'Posted') {
            for (const entry of billPayment.Entries) {
                const bill = entry.BillEntry;
                if (bill) {
                    const currentPaid = parseFloat(bill.paidAmount || 0);
                    const newPaid = currentPaid - parseFloat(entry.amount);
                    await bill.update({
                        paidAmount: Math.max(0, newPaid),
                        status: newPaid <= 0 ? 'Posted' : 'Partially Paid'
                    }, { transaction });
                }
            }

            const header = await TransactionHeader.findOne({
                where: { referenceId: id, transactionModule: 'BILL_PAYMENT' },
                transaction
            });

            if (header) {
                await TransactionDetail.destroy({ where: { transactionHeaderId: header.id }, transaction });
                await header.destroy({ transaction });
            }
        }

        // Delete entries and details
        await BillPaymentEntry.destroy({ where: { billPaymentId: id }, transaction });
        await BillPaymentDetail.destroy({ where: { billPaymentId: id }, transaction });

        // Delete payment
        await billPayment.destroy({ transaction });

        await transaction.commit();
        res.json({
            message: `${billPayment.status} Bill Payment deleted successfully`
        });
    } catch (error) {
        if (!transaction.finished) await transaction.rollback();
        res.status(500).json({ error: error.message });
    }
};
