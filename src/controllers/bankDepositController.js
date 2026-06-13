const { BankDeposit, BankDepositItem, ReceiptPayment, LedgerAccount, User, sequelize, Receipt, PaymentType, Customer } = require('../models');
const { Op } = require('sequelize');
const { generateDocumentNumber } = require('./documentControllerClient');
const TransactionService = require('../utils/transactionService');


/**
 * Get Pending Payments for Deposit
 * Returns ReceiptPayment records that are active, not yet deposited, and have a ledger account.
 */
exports.getPendingPayments = async (req, res) => {
    try {
        const { locationId, paymentTypeId, dateFrom, dateTo, depositDate } = req.query;

        const whereClause = {
            isDeposited: false,
            isActive: true
        };

        if (paymentTypeId) whereClause.paymentTypeId = paymentTypeId;

        // For cheque deposits (paymentTypeId=4), only include cheques dated on or before the deposit date
        if (paymentTypeId == 4 && depositDate) {
            whereClause.chequeDate = { [Op.lte]: new Date(depositDate) };
        }

        const includeReceipt = {
            model: Receipt,
            as: 'receipt',
            where: {},
            include: [{ model: Customer, as: 'Customer' }]
        };

        if (locationId) includeReceipt.where.locationId = locationId;
        if (dateFrom || dateTo) {
            includeReceipt.where.receiptDate = {};
            if (dateFrom) includeReceipt.where.receiptDate[Op.gte] = new Date(dateFrom);
            if (dateTo) includeReceipt.where.receiptDate[Op.lte] = new Date(dateTo);
        }

        const pendingPayments = await ReceiptPayment.findAll({
            where: whereClause,
            include: [
                includeReceipt,
                { model: PaymentType },
                { model: LedgerAccount, as: 'ledgerAccount' }
            ],
            order: [[{ model: Receipt, as: 'receipt' }, 'receiptDate', 'ASC']]
        });

        res.json({
            message: 'Pending payments retrieved successfully',
            data: pendingPayments
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Create Bank Deposit
 */
exports.createBankDeposit = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const {
            depositDate,
            bankAccountId,
            locationId,
            description,
            referenceNumber,
            depositItems // Array of { receiptPaymentId, amount, description }
        } = req.body;

        const currentUserId = req.user.id;

        if (!bankAccountId || !depositDate || !locationId) {
            throw new Error('Bank account, deposit date, and location are required');
        }

        if (!Array.isArray(depositItems) || depositItems.length === 0) {
            throw new Error('Bank deposit must have at least one item');
        }

        const depositNumber = await generateDocumentNumber('BD', locationId);

        let totalAmount = 0;
        for (const item of depositItems) {
            totalAmount += parseFloat(item.amount) || 0;
        }

        const bankDeposit = await BankDeposit.create({
            depositNumber,
            depositDate,
            bankAccountId,
            locationId,
            totalAmount,
            description,
            referenceNumber,
            status: 'Draft',
            approvalStatus: 'Pending',
            createdBy: currentUserId,
            updatedBy: currentUserId
        }, { transaction: t });

        for (const item of depositItems) {
            await BankDepositItem.create({
                bankDepositId: bankDeposit.id,
                receiptPaymentId: item.receiptPaymentId || null,
                ledgerAccountId: item.ledgerAccountId || null,
                amount: item.amount,
                description: item.description,
                createdBy: currentUserId
            }, { transaction: t });
        }

        await t.commit();

        const result = await BankDeposit.findByPk(bankDeposit.id, {
            include: [
                { model: BankDepositItem, as: 'Items', include: [{ model: ReceiptPayment, as: 'ReceiptPayment' }, { model: LedgerAccount, as: 'LedgerAccount' }] },
                { model: LedgerAccount, as: 'BankAccount' },
                { model: User, as: 'Creator', attributes: ['id', 'username'] }
            ]
        });

        res.status(201).json({
            message: 'Bank Deposit created successfully',
            data: result
        });
    } catch (error) {
        console.log(error);
        if (t && !t.finished) await t.rollback();
        res.status(400).json({ error: error.message });
    }
};

/**
 * Get All Bank Deposits
 */
exports.getAllBankDeposits = async (req, res) => {
    try {
        const { status, dateFrom, dateTo, bankAccountId, locationId, page = 1, limit = 10 } = req.query;
        const where = {};

        if (status) where.status = status;
        if (bankAccountId) where.bankAccountId = bankAccountId;
        if (locationId) where.locationId = locationId;
        if (dateFrom || dateTo) {
            where.depositDate = {};
            if (dateFrom) where.depositDate[Op.gte] = new Date(dateFrom);
            if (dateTo) where.depositDate[Op.lte] = new Date(dateTo);
        }

        const offset = (page - 1) * limit;

        const { count, rows } = await BankDeposit.findAndCountAll({
            where,
            include: [
                { model: LedgerAccount, as: 'BankAccount', attributes: ['id', 'ledgerCode', 'name', 'accountNumber'] },
                { model: User, as: 'Creator', attributes: ['id', 'username'] }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['depositDate', 'DESC'], ['depositNumber', 'DESC']],
            distinct: true
        });

        res.json({
            message: 'Bank Deposits retrieved successfully',
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
 * Get Bank Deposit by ID
 */
exports.getBankDepositById = async (req, res) => {
    try {
        const { id } = req.params;

        const bankDeposit = await BankDeposit.findByPk(id, {
            include: [
                {
                    model: BankDepositItem,
                    as: 'Items',
                    include: [
                        {
                            model: ReceiptPayment,
                            as: 'ReceiptPayment',
                            include: [
                                {
                                    model: Receipt,
                                    as: 'receipt',
                                    include: [{ model: Customer, as: 'Customer' }]
                                },
                                { model: PaymentType }
                            ]
                        },
                        { model: LedgerAccount, as: 'LedgerAccount' }
                    ]
                },
                { model: LedgerAccount, as: 'BankAccount' },
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'ApprovedByUser', attributes: ['id', 'username'] }
            ]
        });

        if (!bankDeposit) {
            return res.status(404).json({ error: 'Bank Deposit not found' });
        }

        res.json({
            message: 'Bank Deposit retrieved successfully',
            data: bankDeposit
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Approve and Post Bank Deposit
 */
exports.postBankDeposit = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;

        // Include items and their related receipt payments to get the source ledger accounts
        const bankDeposit = await BankDeposit.findByPk(id, {
            include: [
                {
                    model: BankDepositItem,
                    as: 'Items',
                    include: [{ model: ReceiptPayment, as: 'ReceiptPayment' }]
                },
                { model: LedgerAccount, as: 'BankAccount' }
            ],
            transaction: t
        });

        if (!bankDeposit) {
            await t.rollback();
            return res.status(404).json({ error: 'Bank Deposit not found' });
        }

        if (bankDeposit.status === 'Posted') {
            await t.rollback();
            return res.status(400).json({ error: 'Bank Deposit is already posted' });
        }

        // Prepare transaction details for direct logging
        const transactionDetails = [];
        
        // 1. Debit the Bank Account (Destination)
        transactionDetails.push({
            ledgerAccountId: bankDeposit.bankAccountId,
            debitAmount: bankDeposit.totalAmount,
            creditAmount: 0,
            description: `Bank Deposit - ${bankDeposit.depositNumber}`
        });

        // 2. Credit the source accounts (from ReceiptPayment)
        for (const item of bankDeposit.Items) {
            if (item.receiptPaymentId) {
                const rp = item.ReceiptPayment;
                if (!rp) {
                    throw new Error(`Receipt Payment with ID ${item.receiptPaymentId} not found for item ${item.id}`);
                }

                transactionDetails.push({
                    ledgerAccountId: rp.ledgerAccountId,
                    debitAmount: 0,
                    creditAmount: item.amount,
                    description: `Deposit for Receipt Payment Reference: ${rp.referenceNo || 'N/A'}`
                });

                // Update items to be deposited
                await ReceiptPayment.update({
                    isDeposited: true,
                    bankDepositId: bankDeposit.id
                }, {
                    where: { id: item.receiptPaymentId },
                    transaction: t
                });
            } else if (item.ledgerAccountId) {
                transactionDetails.push({
                    ledgerAccountId: item.ledgerAccountId,
                    debitAmount: 0,
                    creditAmount: item.amount,
                    description: item.description || `Cash Deposit`
                });
            } else {
                throw new Error(`Item ${item.id} has no source account specified`);
            }
        }

        // Log transaction directly to TransactionHeader and TransactionDetail
        const transactionHeader = await TransactionService.logBankDepositTransaction(
            bankDeposit,
            transactionDetails,
            req.user.id
        );

        await bankDeposit.update({
            status: 'Posted',
            approvalStatus: 'Approved',
            approvedAt: new Date(),
            approvedBy: req.user.id,
            updatedBy: req.user.id
        }, { transaction: t });

        await t.commit();

        res.json({
            message: 'Bank Deposit posted successfully',
            data: bankDeposit,
            transactionHeaderId: transactionHeader.id
        });
    } catch (error) {
        if (t && !t.finished) await t.rollback();
        console.error('Error posting bank deposit:', error);
        res.status(500).json({ error: error.message });
    }
};


/**
 * Cancel Bank Deposit
 */
exports.cancelBankDeposit = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;

        const bankDeposit = await BankDeposit.findByPk(id, {
            include: [{ model: BankDepositItem, as: 'Items' }],
            transaction: t
        });

        if (!bankDeposit) {
            await t.rollback();
            return res.status(404).json({ error: 'Bank Deposit not found' });
        }

        // If already posted, we need to revert the isDeposited flag
        for (const item of bankDeposit.Items) {
            if (item.receiptPaymentId) {
                await ReceiptPayment.update({
                    isDeposited: false,
                    bankDepositId: null
                }, {
                    where: { id: item.receiptPaymentId },
                    transaction: t
                });
            }
        }

        await bankDeposit.update({
            status: 'Cancelled',
            updatedBy: req.user.id
        }, { transaction: t });

        await t.commit();

        res.json({
            message: 'Bank Deposit cancelled successfully',
            data: bankDeposit
        });
    } catch (error) {
        if (t && !t.finished) await t.rollback();
        res.status(500).json({ error: error.message });
    }
};

/**
 * Delete Bank Deposit (Draft only)
 */
exports.deleteBankDeposit = async (req, res) => {
    try {
        const { id } = req.params;

        const bankDeposit = await BankDeposit.findByPk(id);
        if (!bankDeposit) {
            return res.status(404).json({ error: 'Bank Deposit not found' });
        }

        if (bankDeposit.status !== 'Draft') {
            return res.status(400).json({ error: 'Only Draft deposits can be deleted' });
        }

        await bankDeposit.destroy();

        res.json({
            message: 'Bank Deposit deleted successfully'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
