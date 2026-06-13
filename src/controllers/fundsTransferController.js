const { FundsTransfer, LedgerAccount, Bank, BankBranch, JournalEntry, User, sequelize, TransactionHeader } = require('../models');
const { Op } = require('sequelize');
const AutoPostingService = require('../utils/autoPostingService');
const TransactionService = require('../utils/transactionService');

/**
 * Generate unique Transfer Number
 */
const generateTransferNumber = async () => {
    try {
        const lastTransfer = await FundsTransfer.findOne({
            order: [['id', 'DESC']]
        });

        const nextNumber = (lastTransfer ? parseInt(lastTransfer.transferNumber.substring(2)) : 0) + 1;
        return `FT${String(nextNumber).padStart(6, '0')}`;
    } catch (error) {
        throw error;
    }
};

/**
 * Create Funds Transfer
 */
exports.createFundsTransfer = async (req, res) => {
    try {
        const { sourceBankAccountId, destinationBankAccountId, transferDate, amount, description, referenceNumber } = req.body;

        // Validation
        if (!sourceBankAccountId || !destinationBankAccountId || !transferDate || !amount) {
            return res.status(400).json({
                error: 'Source account, destination account, transfer date, and amount are required'
            });
        }

        // Validate accounts are different
        if (parseInt(sourceBankAccountId) === parseInt(destinationBankAccountId)) {
            return res.status(400).json({ error: 'Source and destination accounts must be different' });
        }

        // Verify both accounts exist
        // Verify both accounts exist and are bank ledgers
        const sourceAccount = await LedgerAccount.findByPk(sourceBankAccountId, {
            include: [{ model: Bank, as: 'Bank' }, { model: BankBranch, as: 'Branch' }]
        });
        if (!sourceAccount) {
            return res.status(400).json({ error: `Source account with ID ${sourceBankAccountId} not found` });
        }
        if (!sourceAccount.isBankLedger) {
            return res.status(400).json({ error: `Source account is not a valid bank ledger` });
        }

        const destinationAccount = await LedgerAccount.findByPk(destinationBankAccountId, {
            include: [{ model: Bank, as: 'Bank' }, { model: BankBranch, as: 'Branch' }]
        });
        if (!destinationAccount) {
            return res.status(400).json({ error: `Destination account with ID ${destinationBankAccountId} not found` });
        }
        if (!destinationAccount.isBankLedger) {
            return res.status(400).json({ error: `Destination account is not a valid bank ledger` });
        }

        const transferNumber = await generateTransferNumber();
        const transferAmount = parseFloat(amount);

        const fundsTransfer = await FundsTransfer.create({
            transferNumber,
            transferDate,
            sourceBankAccountId,
            destinationBankAccountId,
            amount: transferAmount,
            description,
            referenceNumber: referenceNumber || null,
            status: 'Draft',
            createdBy: req.user.id
        });

        // Fetch complete transfer with relationships
        const completeTransfer = await FundsTransfer.findByPk(fundsTransfer.id, {
            include: [
                {
                    model: LedgerAccount,
                    as: 'SourceBankAccount',
                    include: [{ model: Bank, as: 'Bank' }, { model: BankBranch, as: 'Branch' }]
                },
                {
                    model: LedgerAccount,
                    as: 'DestinationBankAccount',
                    include: [{ model: Bank, as: 'Bank' }, { model: BankBranch, as: 'Branch' }]
                },
                { model: User, as: 'Creator', attributes: ['id', 'fullName', 'email'] }
            ]
        });

        res.status(201).json({
            message: 'Funds Transfer created successfully',
            data: completeTransfer
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get all Funds Transfers
 */
exports.getAllFundsTransfers = async (req, res) => {
    try {
        const { status, reconciliationStatus, dateFrom, dateTo, sourceBankAccountId, destinationBankAccountId, page = 1, limit = 10 } = req.query;
        const where = {};

        if (status) where.status = status;
        if (reconciliationStatus) where.reconciliationStatus = reconciliationStatus;
        if (sourceBankAccountId) where.sourceBankAccountId = sourceBankAccountId;
        if (destinationBankAccountId) where.destinationBankAccountId = destinationBankAccountId;
        if (dateFrom || dateTo) {
            where.transferDate = {};
            if (dateFrom) where.transferDate[Op.gte] = new Date(dateFrom);
            if (dateTo) where.transferDate[Op.lte] = new Date(dateTo);
        }

        const offset = (page - 1) * limit;

        const { count, rows } = await FundsTransfer.findAndCountAll({
            where,
            include: [
                {
                    model: LedgerAccount,
                    as: 'SourceBankAccount',
                    attributes: ['id', 'ledgerCode', 'name', 'accountNumber'],
                    include: [{ model: Bank, as: 'Bank', attributes: ['name', 'code'] }]
                },
                {
                    model: LedgerAccount,
                    as: 'DestinationBankAccount',
                    attributes: ['id', 'ledgerCode', 'name', 'accountNumber'],
                    include: [{ model: Bank, as: 'Bank', attributes: ['name', 'code'] }]
                },
                { model: User, as: 'Creator', attributes: ['id', 'fullName', 'email'] },
                { model: User, as: 'ApprovedByUser', attributes: ['id', 'fullName', 'email'] },
                { model: User, as: 'PostedByUser', attributes: ['id', 'fullName', 'email'] },
                // { model: TransactionHeader, as: 'TransactionHeader' }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['transferDate', 'DESC'], ['transferNumber', 'DESC']],
            distinct: true
        });

        res.json({
            message: 'Funds Transfers retrieved successfully',
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
 * Get Funds Transfer by ID
 */
exports.getFundsTransferById = async (req, res) => {
    try {
        const { id } = req.params;

        const fundsTransfer = await FundsTransfer.findByPk(id, {
            include: [
                { model: LedgerAccount, as: 'SourceBankAccount' },
                { model: LedgerAccount, as: 'DestinationBankAccount' },
                { model: JournalEntry, as: 'JournalEntry' },
                // { model: TransactionHeader, as: 'TransactionHeader' },
                { model: User, as: 'Creator', attributes: ['id', 'fullName', 'email'] },
                { model: User, as: 'ApprovedByUser', attributes: ['id', 'fullName', 'email'] },
                { model: User, as: 'PostedByUser', attributes: ['id', 'fullName', 'email'] },
                { model: User, as: 'ReconciledByUser', attributes: ['id', 'fullName', 'email'] }
            ]
        });

        if (!fundsTransfer) {
            return res.status(404).json({ error: 'Funds Transfer not found' });
        }

        res.json({
            message: 'Funds Transfer retrieved successfully',
            data: fundsTransfer
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Update Funds Transfer (Draft only)
 */
exports.updateFundsTransfer = async (req, res) => {
    try {
        const { id } = req.params;
        const { transferDate, amount, description, referenceNumber } = req.body;

        const fundsTransfer = await FundsTransfer.findByPk(id);
        if (!fundsTransfer) {
            return res.status(404).json({ error: 'Funds Transfer not found' });
        }

        if (fundsTransfer.status !== 'Draft') {
            return res.status(400).json({ error: 'Only Draft transfers can be updated' });
        }

        const updates = {};
        if (transferDate) updates.transferDate = transferDate;
        if (amount) updates.amount = parseFloat(amount);
        if (description) updates.description = description;
        if (referenceNumber) updates.referenceNumber = referenceNumber;

        updates.updatedBy = req.user.id;

        await fundsTransfer.update(updates);

        const updatedTransfer = await FundsTransfer.findByPk(id, {
            include: [
                { model: LedgerAccount, as: 'SourceBankAccount' },
                { model: LedgerAccount, as: 'DestinationBankAccount' }
            ]
        });

        res.json({
            message: 'Funds Transfer updated successfully',
            data: updatedTransfer
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Submit Funds Transfer for Approval
 */
exports.submitFundsTransfer = async (req, res) => {
    try {
        const { id } = req.params;

        const fundsTransfer = await FundsTransfer.findByPk(id);
        if (!fundsTransfer) {
            return res.status(404).json({ error: 'Funds Transfer not found' });
        }

        if (fundsTransfer.status !== 'Draft') {
            return res.status(400).json({ error: 'Only Draft transfers can be submitted' });
        }

        await fundsTransfer.update({
            status: 'Submitted',
            updatedBy: req.user.id
        });

        res.json({
            message: 'Funds Transfer submitted for approval',
            data: fundsTransfer
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Approve Funds Transfer
 */
exports.approveFundsTransfer = async (req, res) => {
    try {
        const { id } = req.params;

        const fundsTransfer = await FundsTransfer.findByPk(id);
        if (!fundsTransfer) {
            return res.status(404).json({ error: 'Funds Transfer not found' });
        }

        if (fundsTransfer.status !== 'Submitted') {
            return res.status(400).json({ error: 'Only Submitted transfers can be approved' });
        }

        await fundsTransfer.update({
            status: 'Approved',
            approvalStatus: 'Approved',
            approvedAt: new Date(),
            approvedBy: req.user.id,
            updatedBy: req.user.id
        });

        res.json({
            message: 'Funds Transfer approved successfully',
            data: fundsTransfer
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Post Funds Transfer
 */
exports.postFundsTransfer = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;

        const fundsTransfer = await FundsTransfer.findByPk(id, {
            include: [
                { model: LedgerAccount, as: 'SourceBankAccount' },
                { model: LedgerAccount, as: 'DestinationBankAccount' }
            ],
            transaction: t
        });

        if (!fundsTransfer) {
            await t.rollback();
            return res.status(404).json({ error: 'Funds Transfer not found' });
        }

        if (fundsTransfer.status !== 'Approved') {
            await t.rollback();
            return res.status(400).json({ error: 'Only Approved transfers can be posted' });
        }

        // Prepare transaction details for direct logging (No Journal Entry)
        const transactionDetails = [
            {
                ledgerAccountId: fundsTransfer.destinationBankAccountId,
                debitAmount: fundsTransfer.amount,
                creditAmount: 0,
                description: `Transfer in - ${fundsTransfer.transferNumber}`
            },
            {
                ledgerAccountId: fundsTransfer.sourceBankAccountId,
                debitAmount: 0,
                creditAmount: fundsTransfer.amount,
                description: `Transfer out - ${fundsTransfer.transferNumber}`
            }
        ];

        // Log transaction directly to TransactionHeader and TransactionDetail
        const transactionHeader = await TransactionService.logFundsTransferTransaction(
            fundsTransfer,
            transactionDetails,
            req.user.id
        );

        await fundsTransfer.update({
            status: 'Posted',
            postedAt: new Date(),
            postedBy: req.user.id,
            // transactionHeaderId: transactionHeader.id,
            reconciliationStatus: 'Pending',
            updatedBy: req.user.id
        }, { transaction: t });

        await t.commit();

        const updatedTransfer = await FundsTransfer.findByPk(id, {
            include: [
                { model: LedgerAccount, as: 'SourceBankAccount' },
                { model: LedgerAccount, as: 'DestinationBankAccount' }
            ]
        });

        res.json({
            message: 'Funds Transfer posted successfully',
            data: updatedTransfer
        });
    } catch (error) {
        if (t) await t.rollback();
        console.error('Error posting funds transfer:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Reconcile Funds Transfer
 */
exports.reconcileFundsTransfer = async (req, res) => {
    try {
        const { id } = req.params;
        const { reconciliationDate } = req.body;

        const fundsTransfer = await FundsTransfer.findByPk(id);
        if (!fundsTransfer) {
            return res.status(404).json({ error: 'Funds Transfer not found' });
        }

        if (fundsTransfer.status !== 'Posted') {
            return res.status(400).json({ error: 'Only Posted transfers can be reconciled' });
        }

        await fundsTransfer.update({
            reconciliationStatus: 'Reconciled',
            reconciledAt: reconciliationDate || new Date(),
            reconciledBy: req.user.id,
            updatedBy: req.user.id
        });

        res.json({
            message: 'Funds Transfer reconciled successfully',
            data: fundsTransfer
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Reject Funds Transfer
 */
exports.rejectFundsTransfer = async (req, res) => {
    try {
        const { id } = req.params;
        const { rejectionReason } = req.body;

        const fundsTransfer = await FundsTransfer.findByPk(id);
        if (!fundsTransfer) {
            return res.status(404).json({ error: 'Funds Transfer not found' });
        }

        if (!['Draft', 'Submitted'].includes(fundsTransfer.status)) {
            return res.status(400).json({ error: 'Only Draft or Submitted transfers can be rejected' });
        }

        await fundsTransfer.update({
            status: 'Rejected',
            approvalStatus: 'Rejected',
            rejectionReason,
            updatedBy: req.user.id
        });

        res.json({
            message: 'Funds Transfer rejected',
            data: fundsTransfer
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Cancel Funds Transfer
 */
exports.cancelFundsTransfer = async (req, res) => {
    try {
        const { id } = req.params;
        const { cancellationReason } = req.body;

        const fundsTransfer = await FundsTransfer.findByPk(id);
        if (!fundsTransfer) {
            return res.status(404).json({ error: 'Funds Transfer not found' });
        }

        if (!['Draft', 'Submitted'].includes(fundsTransfer.status)) {
            return res.status(400).json({ error: 'Only Draft or Submitted transfers can be cancelled' });
        }

        await fundsTransfer.update({
            status: 'Cancelled',
            cancellationReason,
            updatedBy: req.user.id
        });

        res.json({
            message: 'Funds Transfer cancelled',
            data: fundsTransfer
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Delete Draft Funds Transfer
 */
exports.deleteFundsTransfer = async (req, res) => {
    try {
        const { id } = req.params;

        const fundsTransfer = await FundsTransfer.findByPk(id);
        if (!fundsTransfer) {
            return res.status(404).json({ error: 'Funds Transfer not found' });
        }

        if (fundsTransfer.status !== 'Draft') {
            return res.status(400).json({ error: 'Only Draft transfers can be deleted' });
        }

        await fundsTransfer.destroy();

        res.json({
            message: 'Draft Funds Transfer deleted successfully'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get Bank Account Summary
 */
exports.getBankAccountTransfers = async (req, res) => {
    try {
        const { accountId } = req.params;
        const { dateFrom, dateTo, page = 1, limit = 10 } = req.query;

        const offset = (page - 1) * limit;
        const where = {
            [Op.or]: [
                { sourceBankAccountId: accountId },
                { destinationBankAccountId: accountId }
            ],
            status: 'Posted'
        };

        if (dateFrom || dateTo) {
            where.transferDate = {};
            if (dateFrom) where.transferDate[Op.gte] = new Date(dateFrom);
            if (dateTo) where.transferDate[Op.lte] = new Date(dateTo);
        }

        const { count, rows } = await FundsTransfer.findAndCountAll({
            where,
            include: [
                {
                    model: LedgerAccount,
                    as: 'SourceBankAccount',
                    attributes: ['id', 'ledgerCode', 'name', 'accountNumber'],
                    include: [{ model: Bank, as: 'Bank', attributes: ['name'] }]
                },
                {
                    model: LedgerAccount,
                    as: 'DestinationBankAccount',
                    attributes: ['id', 'ledgerCode', 'name', 'accountNumber'],
                    include: [{ model: Bank, as: 'Bank', attributes: ['name'] }]
                }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['transferDate', 'DESC']],
            distinct: true
        });

        res.json({
            message: 'Bank account transfers retrieved successfully',
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
