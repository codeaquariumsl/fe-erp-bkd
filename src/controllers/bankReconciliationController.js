const { BankReconciliation, BankReconciliationItem, BankStatement, BankStatementLine, LedgerAccount, JournalEntry, JournalEntryLine, Receipt, BillPayment, FundsTransfer, TransactionHeader, TransactionDetail, User, sequelize } = require('../models');
const { Op } = require('sequelize');

// Generate unique reconciliation number
const generateReconciliationNumber = async () => {
    const lastReconciliation = await BankReconciliation.findOne({
        order: [['id', 'DESC']],
        attributes: ['reconciliationNumber']
    });

    if (!lastReconciliation) {
        return 'BR-0001';
    }

    const lastNumber = parseInt(lastReconciliation.reconciliationNumber.split('-')[1]);
    const newNumber = (lastNumber + 1).toString().padStart(4, '0');
    return `BR-${newNumber}`;
};

// Helper function to get the opening balance for a bank account
const getOpeningBalanceForAccount = async (bankAccountId) => {
    // Find the last approved reconciliation for this account
    const lastReconciliation = await BankReconciliation.findOne({
        where: { bankAccountId, status: 'Approved' },
        order: [['reconciliationDate', 'DESC'], ['id', 'DESC']]
    });

    if (lastReconciliation) {
        return parseFloat(lastReconciliation.closingBalance);
    }

    // Fallback to ledger account opening balance
    const bankAccount = await LedgerAccount.findByPk(bankAccountId);
    return parseFloat(bankAccount?.openingBalance) || 0;
};

// Generate unique statement number
const generateStatementNumber = async () => {
    const lastStatement = await BankStatement.findOne({
        order: [['id', 'DESC']],
        attributes: ['statementNumber']
    });

    if (!lastStatement) {
        return 'BS-0001';
    }

    const lastNumber = parseInt(lastStatement.statementNumber.split('-')[1]);
    const newNumber = (lastNumber + 1).toString().padStart(4, '0');
    return `BS-${newNumber}`;
};

/**
 * Create a new bank reconciliation
 * POST /api/accounting/bank-reconciliations
 */
exports.createBankReconciliation = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const {
            bankAccountId,
            reconciliationDate,
            statementDate,
            statementPeriodFrom,
            statementPeriodTo,
            openingBalance,
            closingBalance,
            remarks
        } = req.body;

        // Validate bank account exists
        const bankAccount = await LedgerAccount.findByPk(bankAccountId);
        if (!bankAccount) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Bank account not found' });
        }

        // Use provided reconciliation number (Reference Number) or generate one
        let reconciliationNumber = req.body.reconciliationNumber;
        if (!reconciliationNumber) {
            reconciliationNumber = await generateReconciliationNumber();
        } else {
            // Check if reconciliation number already exists
            const existing = await BankReconciliation.findOne({ where: { reconciliationNumber } });
            if (existing) {
                await transaction.rollback();
                return res.status(400).json({ error: 'Reconciliation Reference Number already exists' });
            }
        }

        // Get book opening balance (passed from UI or calculated)
        const bookOpeningBalance = parseFloat(openingBalance) || await getOpeningBalanceForAccount(bankAccountId);

        // Create reconciliation
        const reconciliation = await BankReconciliation.create({
            reconciliationNumber,
            bankAccountId,
            reconciliationDate: reconciliationDate || new Date(),
            statementDate: statementDate || new Date(),
            statementPeriodFrom,
            statementPeriodTo,
            openingBalance: bookOpeningBalance, // Opening balance per statement
            closingBalance: closingBalance || 0, // Statement balance per UI
            bookOpeningBalance: bookOpeningBalance,
            bookClosingBalance: bookOpeningBalance, // Will be updated
            totalDeposits: 0,
            totalWithdrawals: 0,
            reconciledDeposits: 0,
            reconciledWithdrawals: 0,
            unreconciledDeposits: 0,
            unreconciledWithdrawals: 0,
            difference: (parseFloat(closingBalance) || 0) - bookOpeningBalance,
            status: 'Draft',
            remarks,
            isBalanced: false,
            createdBy: req.user.id,
            updatedBy: req.user.id
        }, { transaction });

        // If items are provided, add them
        if (req.body.items && Array.isArray(req.body.items)) {
            const reconciliationItems = req.body.items.map(item => ({
                bankReconciliationId: reconciliation.id,
                transactionType: 'Book',
                transactionDate: item.transactionDate,
                description: item.description,
                referenceNumber: item.chequeNumber || item.referenceNumber,
                debitAmount: item.debitAmount || 0,
                creditAmount: item.creditAmount || 0,
                isReconciled: true,
                transactionDetailId: item.id,
                createdBy: req.user.id,
                updatedBy: req.user.id
            }));
            await BankReconciliationItem.bulkCreate(reconciliationItems, { transaction });
        }

        // Recalculate totals immediately
        await recalculateReconciliationTotals(reconciliation.id, transaction);

        await transaction.commit();

        res.status(201).json({
            message: 'Bank reconciliation created successfully',
            reconciliation
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error creating bank reconciliation:', error);
        res.status(500).json({ error: 'Failed to create bank reconciliation', details: error.message });
    }
};

/**
 * Get all bank reconciliations with filters
 * GET /api/accounting/bank-reconciliations
 */
exports.getAllBankReconciliations = async (req, res) => {
    try {
        const {
            bankAccountId,
            status,
            isBalanced,
            dateFrom,
            dateTo,
            page = 1,
            limit = 10
        } = req.query;

        const where = {};

        if (bankAccountId) where.bankAccountId = bankAccountId;
        if (status) where.status = status;
        if (isBalanced !== undefined) where.isBalanced = isBalanced === 'true';
        if (dateFrom && dateTo) {
            where.reconciliationDate = {
                [Op.between]: [dateFrom, dateTo]
            };
        }

        const offset = (page - 1) * limit;

        const { count, rows: reconciliations } = await BankReconciliation.findAndCountAll({
            where,
            include: [
                {
                    model: LedgerAccount,
                    as: 'BankAccount',
                    attributes: ['id', 'name', 'ledgerCode', 'openingBalance']
                },
                {
                    model: User,
                    as: 'Creator',
                    attributes: ['id', 'username', 'email']
                },
                {
                    model: User,
                    as: 'ApprovedByUser',
                    attributes: ['id', 'username', 'email']
                }
            ],
            order: [['reconciliationDate', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            reconciliations,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching bank reconciliations:', error);
        res.status(500).json({ error: 'Failed to fetch bank reconciliations', details: error.message });
    }
};

/**
 * Get bank reconciliation by ID
 * GET /api/accounting/bank-reconciliations/:id
 */
exports.getBankReconciliationById = async (req, res) => {
    try {
        const { id } = req.params;

        const reconciliation = await BankReconciliation.findByPk(id, {
            include: [
                {
                    model: LedgerAccount,
                    as: 'BankAccount',
                    attributes: ['id', 'name', 'ledgerCode', 'openingBalance']
                },
                {
                    model: BankReconciliationItem,
                    as: 'Items',
                    include: [
                        {
                            model: JournalEntry,
                            as: 'JournalEntry',
                            attributes: ['id', 'journalNumber', 'journalDate']
                        },
                        {
                            model: Receipt,
                            as: 'Receipt',
                            attributes: ['id', 'receiptNo', 'receiptDate']
                        },
                        {
                            model: BillPayment,
                            as: 'BillPayment',
                            attributes: ['id', 'paymentNumber', 'paymentDate']
                        },
                        {
                            model: FundsTransfer,
                            as: 'FundsTransfer',
                            attributes: ['id', 'transferNumber', 'transferDate']
                        },
                        {
                            model: BankStatementLine,
                            as: 'BankStatementLine',
                            attributes: ['id', 'lineNumber', 'transactionDate', 'description']
                        },
                        {
                            model: TransactionDetail,
                            as: 'TransactionDetail',
                            include: [
                                {
                                    model: TransactionHeader,
                                    as: 'TransactionHeader',
                                    attributes: ['id', 'transactionNumber', 'transactionDate', 'transactionModule']
                                }
                            ]
                        }
                    ]
                },
                {
                    model: User,
                    as: 'Creator',
                    attributes: ['id', 'username', 'email']
                },
                {
                    model: User,
                    as: 'ApprovedByUser',
                    attributes: ['id', 'username', 'email']
                }
            ]
        });

        if (!reconciliation) {
            return res.status(404).json({ error: 'Bank reconciliation not found' });
        }

        res.json({ reconciliation });
    } catch (error) {
        console.error('Error fetching bank reconciliation:', error);
        res.status(500).json({ error: 'Failed to fetch bank reconciliation', details: error.message });
    }
};

/**
 * Update bank reconciliation
 * PUT /api/accounting/bank-reconciliations/:id
 */
exports.updateBankReconciliation = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { id } = req.params;
        const updateData = req.body;

        const reconciliation = await BankReconciliation.findByPk(id);
        if (!reconciliation) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Bank reconciliation not found' });
        }

        // Only allow updates if status is Draft or In Progress
        if (!['Draft', 'In Progress'].includes(reconciliation.status)) {
            await transaction.rollback();
            return res.status(400).json({ error: 'Cannot update reconciliation in current status' });
        }

        // Update reconciliation
        await reconciliation.update({
            ...updateData,
            updatedBy: req.user.id
        }, { transaction });

        await transaction.commit();

        res.json({
            message: 'Bank reconciliation updated successfully',
            reconciliation
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error updating bank reconciliation:', error);
        res.status(500).json({ error: 'Failed to update bank reconciliation', details: error.message });
    }
};

/**
 * Delete bank reconciliation (only if Draft)
 * DELETE /api/accounting/bank-reconciliations/:id
 */
exports.deleteBankReconciliation = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { id } = req.params;

        const reconciliation = await BankReconciliation.findByPk(id);
        if (!reconciliation) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Bank reconciliation not found' });
        }

        // Only allow deletion if status is Draft
        if (reconciliation.status !== 'Draft') {
            await transaction.rollback();
            return res.status(400).json({ error: 'Can only delete draft reconciliations' });
        }

        // Delete all items first
        await BankReconciliationItem.destroy({
            where: { bankReconciliationId: id },
            transaction
        });

        // Delete reconciliation
        await reconciliation.destroy({ transaction });

        await transaction.commit();

        res.json({ message: 'Bank reconciliation deleted successfully' });
    } catch (error) {
        await transaction.rollback();
        console.error('Error deleting bank reconciliation:', error);
        res.status(500).json({ error: 'Failed to delete bank reconciliation', details: error.message });
    }
};

/**
 * Get unreconciled book transactions for a bank account
 * GET /api/accounting/bank-reconciliations/unreconciled-transactions/:bankAccountId
 */
exports.getUnreconciledTransactions = async (req, res) => {
    try {
        const { bankAccountId } = req.params;
        const { dateFrom, dateTo } = req.query;

        const where = {
            ledgerAccountId: bankAccountId,
            '$ReconciliationItems.id$': null // Not reconciled
        };

        if (dateFrom && dateTo) {
            where.createdAt = {
                [Op.between]: [dateFrom, dateTo]
            };
        }

        // Get journal entry lines for the bank account
        const journalLines = await JournalEntryLine.findAll({
            where,
            include: [
                {
                    model: JournalEntry,
                    as: 'JournalEntry',
                    attributes: ['id', 'journalNumber', 'journalDate', 'description', 'status'],
                    where: { status: 'Posted' }
                },
                {
                    model: BankReconciliationItem,
                    as: 'ReconciliationItems',
                    required: false
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json({ transactions: journalLines });
    } catch (error) {
        console.error('Error fetching unreconciled transactions:', error);
        res.status(500).json({ error: 'Failed to fetch unreconciled transactions', details: error.message });
    }
};

/**
 * Get unreconciled transaction details (General Ledger) for a bank account
 * GET /api/accounting/bank-reconciliations/unreconciled-transaction-details/:bankAccountId
 */
exports.getUnreconciledTransactionDetails = async (req, res) => {
    try {
        const { bankAccountId } = req.params;
        const { dateFrom, dateTo } = req.query;

        if (!bankAccountId) {
            return res.status(400).json({ error: 'Bank account ID is required' });
        }

        // 1. Get Opening Balance
        const openingBalance = await getOpeningBalanceForAccount(bankAccountId);

        // 2. Build where clause for unreconciled transactions
        const where = {
            ledgerAccountId: bankAccountId,
            isReconciled: false
        };

        if (dateFrom && dateTo) {
            where.createdAt = {
                [Op.between]: [new Date(dateFrom), new Date(dateTo)]
            };
        } else if (dateTo) {
            where.createdAt = {
                [Op.lte]: new Date(dateTo)
            };
        }

        // 3. Get Transaction Details (GL entries for this bank account)
        const transactionDetails = await TransactionDetail.findAll({
            where,
            include: [
                {
                    model: TransactionHeader,
                    as: 'TransactionHeader',
                    attributes: ['id', 'transactionNumber', 'transactionDate', 'transactionModule', 'referenceNumber', 'referenceId', 'description', 'status'],
                    where: { status: 'Posted' }
                }
            ],
            order: [['createdAt', 'ASC']]
        });

        // 4. Categorize transactions and fetch additional details if needed
        const checksAndPayments = []; // Debits to bank are withdrawals in statement? No, wait.
        const depositsAndCredits = []; // Credits to bank are deposits in statement?

        // Accounting standard: bank is an asset.
        // Bank account (Asset) increases with Debit (Cash coming in = Deposit).
        // Bank account (Asset) decreases with Credit (Cash going out = Payment).
        // BUT, Bank Statement is from bank's perspective (Liability to them).
        // Statement Credits are deposits. Statement Debits are withdrawals.

        // So:
        // GL Debit = Bank Deposit (Credit in statement)
        // GL Credit = Bank Withdrawal (Debit in statement)

        for (const detail of transactionDetails) {
            const header = detail.TransactionHeader;
            const txn = {
                id: detail.id,
                transactionDate: header.transactionDate,
                transactionNumber: header.transactionNumber,
                referenceNumber: header.referenceNumber,
                description: detail.description || header.description,
                debitAmount: parseFloat(detail.debitAmount) || 0,
                creditAmount: parseFloat(detail.creditAmount) || 0,
                chequeNumber: null,
                sourceModule: header.transactionModule,
                transactionHeaderId: header.id
            };

            // Try to find cheque number from specific modules
            if (header.transactionModule === 'RECEIPT') {
                const ReceiptPayment = require('../models/receiptPayment');
                const p = await ReceiptPayment.findOne({
                    where: { receiptId: header.referenceId, ledgerAccountId: bankAccountId }
                });
                if (p) txn.chequeNumber = p.chequeNo;
            } else if (header.transactionModule === 'BILL_PAYMENT') {
                const SupplierPaymentMethod = require('../models/supplierPaymentMethod');
                // Note: might need to check how to link accurately if multiple bank methods used
                const p = await SupplierPaymentMethod.findOne({
                    where: { supplierPaymentId: header.referenceId, ledgerAccountId: bankAccountId }
                });
                if (p) txn.chequeNumber = p.chequeNo;
            } else if (header.transactionModule === 'ONE_PAYMENT') {
                // Check if one payment has cheque number logic (usually does)
                const OnePayment = require('../models/onePayment');
                const op = await OnePayment.findByPk(header.referenceId);
                if (op) txn.chequeNumber = op.chequeNo;
            }

            // Fallback to referenceNumber if no specific cheque number found
            if (!txn.chequeNumber) txn.chequeNumber = header.referenceNumber;

            // Categorize
            if (txn.debitAmount > 0) {
                // GL Debit = Statement Credit (Deposit)
                txn.amount = txn.debitAmount;
                depositsAndCredits.push(txn);
            } else if (txn.creditAmount > 0) {
                // GL Credit = Statement Debit (Payment)
                txn.amount = txn.creditAmount;
                checksAndPayments.push(txn);
            }
        }

        res.json({
            message: 'Unreconciled transaction details retrieved successfully',
            openingBalance,
            checksAndPayments,
            depositsAndCredits
        });
    } catch (error) {
        console.error('Error fetching unreconciled transaction details:', error);
        res.status(500).json({ error: 'Failed to fetch unreconciled transaction details', details: error.message });
    }
};

/**
 * Add items to reconciliation (book transactions or statement lines)
 * POST /api/accounting/bank-reconciliations/:id/items
 */
exports.addReconciliationItems = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { id } = req.params;
        const { items } = req.body; // Array of items to add

        const reconciliation = await BankReconciliation.findByPk(id);
        if (!reconciliation) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Bank reconciliation not found' });
        }

        if (!['Draft', 'In Progress'].includes(reconciliation.status)) {
            await transaction.rollback();
            return res.status(400).json({ error: 'Cannot add items to reconciliation in current status' });
        }

        // Create reconciliation items
        const createdItems = await BankReconciliationItem.bulkCreate(
            items.map(item => ({
                ...item,
                bankReconciliationId: id,
                createdBy: req.user.id,
                updatedBy: req.user.id
            })),
            { transaction }
        );

        // Update reconciliation status to In Progress
        if (reconciliation.status === 'Draft') {
            await reconciliation.update({ status: 'In Progress' }, { transaction });
        }

        // Recalculate totals
        await recalculateReconciliationTotals(id, transaction);

        await transaction.commit();

        res.status(201).json({
            message: 'Items added to reconciliation successfully',
            items: createdItems
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error adding reconciliation items:', error);
        res.status(500).json({ error: 'Failed to add reconciliation items', details: error.message });
    }
};

/**
 * Match book transaction with statement line
 * POST /api/accounting/bank-reconciliations/:id/match
 */
exports.matchTransactions = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { id } = req.params;
        const { bookItemId, statementItemId } = req.body;

        const reconciliation = await BankReconciliation.findByPk(id);
        if (!reconciliation) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Bank reconciliation not found' });
        }

        // Get both items
        const bookItem = await BankReconciliationItem.findByPk(bookItemId);
        const statementItem = await BankReconciliationItem.findByPk(statementItemId);

        if (!bookItem || !statementItem) {
            await transaction.rollback();
            return res.status(404).json({ error: 'One or both items not found' });
        }

        // Verify items belong to this reconciliation
        if (bookItem.bankReconciliationId !== parseInt(id) || statementItem.bankReconciliationId !== parseInt(id)) {
            await transaction.rollback();
            return res.status(400).json({ error: 'Items do not belong to this reconciliation' });
        }

        // Match the items
        await bookItem.update({
            isReconciled: true,
            reconciledWith: statementItemId,
            reconciliationType: 'Matched',
            updatedBy: req.user.id
        }, { transaction });

        await statementItem.update({
            isReconciled: true,
            reconciledWith: bookItemId,
            reconciliationType: 'Matched',
            updatedBy: req.user.id
        }, { transaction });

        // Recalculate totals
        await recalculateReconciliationTotals(id, transaction);

        await transaction.commit();

        res.json({
            message: 'Transactions matched successfully',
            bookItem,
            statementItem
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error matching transactions:', error);
        res.status(500).json({ error: 'Failed to match transactions', details: error.message });
    }
};

/**
 * Unmatch transactions
 * POST /api/accounting/bank-reconciliations/:id/unmatch
 */
exports.unmatchTransactions = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { id } = req.params;
        const { itemId } = req.body;

        const item = await BankReconciliationItem.findByPk(itemId);
        if (!item) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Item not found' });
        }

        if (!item.isReconciled || !item.reconciledWith) {
            await transaction.rollback();
            return res.status(400).json({ error: 'Item is not matched' });
        }

        // Get the matched item
        const matchedItem = await BankReconciliationItem.findByPk(item.reconciledWith);

        // Unmatch both items
        await item.update({
            isReconciled: false,
            reconciledWith: null,
            reconciliationType: null,
            updatedBy: req.user.id
        }, { transaction });

        if (matchedItem) {
            await matchedItem.update({
                isReconciled: false,
                reconciledWith: null,
                reconciliationType: null,
                updatedBy: req.user.id
            }, { transaction });
        }

        // Recalculate totals
        await recalculateReconciliationTotals(id, transaction);

        await transaction.commit();

        res.json({
            message: 'Transactions unmatched successfully'
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error unmatching transactions:', error);
        res.status(500).json({ error: 'Failed to unmatch transactions', details: error.message });
    }
};

/**
 * Complete reconciliation
 * POST /api/accounting/bank-reconciliations/:id/complete
 */
exports.completeReconciliation = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { id } = req.params;

        const reconciliation = await BankReconciliation.findByPk(id, {
            include: [{ model: BankReconciliationItem, as: 'Items' }]
        });

        if (!reconciliation) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Bank reconciliation not found' });
        }

        // Recalculate totals one final time
        await recalculateReconciliationTotals(id, transaction);

        // Reload to get updated values
        await reconciliation.reload({ transaction });

        // Update status to Reconciled
        await reconciliation.update({
            status: 'Reconciled',
            updatedBy: req.user.id
        }, { transaction });

        await transaction.commit();

        res.json({
            message: 'Bank reconciliation completed successfully',
            reconciliation
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error completing reconciliation:', error);
        res.status(500).json({ error: 'Failed to complete reconciliation', details: error.message });
    }
};

/**
 * Approve reconciliation
 * POST /api/accounting/bank-reconciliations/:id/approve
 */
exports.approveReconciliation = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { id } = req.params;

        const reconciliation = await BankReconciliation.findByPk(id);
        if (!reconciliation) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Bank reconciliation not found' });
        }

        if (reconciliation.status !== 'Reconciled') {
            await transaction.rollback();
            return res.status(400).json({ error: 'Can only approve reconciled reconciliations' });
        }

        await reconciliation.update({
            status: 'Approved',
            approvedBy: req.user.id,
            approvedAt: new Date(),
            updatedBy: req.user.id
        }, { transaction });

        // Mark linked GL transaction details as reconciled
        const reconciledBookItems = await BankReconciliationItem.findAll({
            where: {
                bankReconciliationId: id,
                isReconciled: true,
                transactionDetailId: { [Op.ne]: null }
            },
            transaction
        });

        if (reconciledBookItems.length > 0) {
            const detailIds = reconciledBookItems.map(item => item.transactionDetailId);
            await TransactionDetail.update({
                isReconciled: true,
                reconciledAt: new Date(),
                reconciledBy: req.user.id
            }, {
                where: { id: { [Op.in]: detailIds } },
                transaction
            });
        }

        await transaction.commit();

        res.json({
            message: 'Bank reconciliation approved successfully',
            reconciliation
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error approving reconciliation:', error);
        res.status(500).json({ error: 'Failed to approve reconciliation', details: error.message });
    }
};

/**
 * Reject reconciliation
 * POST /api/accounting/bank-reconciliations/:id/reject
 */
exports.rejectReconciliation = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { id } = req.params;
        const { rejectionReason } = req.body;

        const reconciliation = await BankReconciliation.findByPk(id);
        if (!reconciliation) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Bank reconciliation not found' });
        }

        await reconciliation.update({
            status: 'Rejected',
            rejectionReason,
            updatedBy: req.user.id
        }, { transaction });

        await transaction.commit();

        res.json({
            message: 'Bank reconciliation rejected',
            reconciliation
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error rejecting reconciliation:', error);
        res.status(500).json({ error: 'Failed to reject reconciliation', details: error.message });
    }
};

/**
 * Helper function to recalculate reconciliation totals
 */
async function recalculateReconciliationTotals(reconciliationId, transaction) {
    const items = await BankReconciliationItem.findAll({
        where: { bankReconciliationId: reconciliationId },
        transaction
    });

    let totalDeposits = 0;
    let totalWithdrawals = 0;
    let reconciledDeposits = 0;
    let reconciledWithdrawals = 0;

    items.forEach(item => {
        const debit = parseFloat(item.debitAmount) || 0;
        const credit = parseFloat(item.creditAmount) || 0;

        // In bank reconciliation context:
        // Item is "Matched" if isReconciled is true
        if (item.isReconciled) {
            reconciledDeposits += credit;
            reconciledWithdrawals += debit;
        }
    });

    const reconciliation = await BankReconciliation.findByPk(reconciliationId, { transaction });

    // The logic as per Image 1:
    // Marked Balance = Reconciled Net Movement
    const markedBalance = reconciledDeposits - reconciledWithdrawals;

    // Adjusted Book Balance = Opening Balance + Marked Balance
    const bookClosingBalance = parseFloat(reconciliation.openingBalance) + markedBalance;

    // Difference = Statement Balance - Adjusted Book Balance
    const difference = parseFloat(reconciliation.closingBalance) - bookClosingBalance;
    const isBalanced = Math.abs(difference) < 0.01;

    await reconciliation.update({
        totalDeposits: reconciledDeposits, // Simplify for this manual mode
        totalWithdrawals: reconciledWithdrawals,
        reconciledDeposits,
        reconciledWithdrawals,
        bookClosingBalance,
        difference,
        isBalanced
    }, { transaction });
}

/**
 * Create bank statement
 * POST /api/accounting/bank-statements
 */
exports.createBankStatement = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const {
            bankAccountId,
            statementDate,
            periodFrom,
            periodTo,
            openingBalance,
            closingBalance,
            lines,
            remarks
        } = req.body;

        // Validate bank account
        const bankAccount = await LedgerAccount.findByPk(bankAccountId);
        if (!bankAccount) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Bank account not found' });
        }

        // Generate statement number
        const statementNumber = await generateStatementNumber();

        // Calculate totals from lines
        let totalDeposits = 0;
        let totalWithdrawals = 0;

        if (lines && lines.length > 0) {
            lines.forEach(line => {
                totalDeposits += parseFloat(line.creditAmount) || 0;
                totalWithdrawals += parseFloat(line.debitAmount) || 0;
            });
        }

        // Create statement
        const statement = await BankStatement.create({
            statementNumber,
            bankAccountId,
            statementDate,
            periodFrom,
            periodTo,
            openingBalance: openingBalance || 0,
            closingBalance: closingBalance || 0,
            totalDeposits,
            totalWithdrawals,
            totalTransactions: lines ? lines.length : 0,
            status: 'Draft',
            remarks,
            createdBy: req.user.id,
            updatedBy: req.user.id
        }, { transaction });

        // Create statement lines if provided
        if (lines && lines.length > 0) {
            await BankStatementLine.bulkCreate(
                lines.map((line, index) => ({
                    ...line,
                    bankStatementId: statement.id,
                    lineNumber: index + 1,
                    createdBy: req.user.id,
                    updatedBy: req.user.id
                })),
                { transaction }
            );
        }

        await transaction.commit();

        res.status(201).json({
            message: 'Bank statement created successfully',
            statement
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error creating bank statement:', error);
        res.status(500).json({ error: 'Failed to create bank statement', details: error.message });
    }
};

/**
 * Get all bank statements
 * GET /api/accounting/bank-statements
 */
exports.getAllBankStatements = async (req, res) => {
    try {
        const {
            bankAccountId,
            status,
            dateFrom,
            dateTo,
            page = 1,
            limit = 10
        } = req.query;

        const where = {};

        if (bankAccountId) where.bankAccountId = bankAccountId;
        if (status) where.status = status;
        if (dateFrom && dateTo) {
            where.statementDate = {
                [Op.between]: [dateFrom, dateTo]
            };
        }

        const offset = (page - 1) * limit;

        const { count, rows: statements } = await BankStatement.findAndCountAll({
            where,
            include: [
                {
                    model: LedgerAccount,
                    as: 'BankAccount',
                    attributes: ['id', 'name', 'ledgerCode']
                },
                {
                    model: User,
                    as: 'Creator',
                    attributes: ['id', 'username', 'email']
                }
            ],
            order: [['statementDate', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            statements,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching bank statements:', error);
        res.status(500).json({ error: 'Failed to fetch bank statements', details: error.message });
    }
};

/**
 * Get bank statement by ID
 * GET /api/accounting/bank-statements/:id
 */
exports.getBankStatementById = async (req, res) => {
    try {
        const { id } = req.params;

        const statement = await BankStatement.findByPk(id, {
            include: [
                {
                    model: LedgerAccount,
                    as: 'BankAccount',
                    attributes: ['id', 'name', 'ledgerCode']
                },
                {
                    model: BankStatementLine,
                    as: 'Lines',
                    order: [['lineNumber', 'ASC']]
                },
                {
                    model: User,
                    as: 'Creator',
                    attributes: ['id', 'username', 'email']
                }
            ]
        });

        if (!statement) {
            return res.status(404).json({ error: 'Bank statement not found' });
        }

        res.json({ statement });
    } catch (error) {
        console.error('Error fetching bank statement:', error);
        res.status(500).json({ error: 'Failed to fetch bank statement', details: error.message });
    }
};

/**
 * Get reconciliation summary/report
 * GET /api/accounting/bank-reconciliations/:id/summary
 */
exports.getReconciliationSummary = async (req, res) => {
    try {
        const { id } = req.params;

        const reconciliation = await BankReconciliation.findByPk(id, {
            include: [
                {
                    model: LedgerAccount,
                    as: 'BankAccount'
                },
                {
                    model: BankReconciliationItem,
                    as: 'Items'
                }
            ]
        });

        if (!reconciliation) {
            return res.status(404).json({ error: 'Bank reconciliation not found' });
        }

        // Categorize items
        const matchedItems = reconciliation.Items.filter(item => item.isReconciled && item.reconciliationType === 'Matched');
        const outstandingDeposits = reconciliation.Items.filter(item => !item.isReconciled && item.creditAmount > 0);
        const outstandingWithdrawals = reconciliation.Items.filter(item => !item.isReconciled && item.debitAmount > 0);
        const bankCharges = reconciliation.Items.filter(item => item.reconciliationType === 'Bank Charge');
        const bankInterest = reconciliation.Items.filter(item => item.reconciliationType === 'Bank Interest');
        const adjustments = reconciliation.Items.filter(item => item.reconciliationType === 'Adjustment');
        const errors = reconciliation.Items.filter(item => item.reconciliationType === 'Error');

        const summary = {
            reconciliation: {
                id: reconciliation.id,
                reconciliationNumber: reconciliation.reconciliationNumber,
                bankAccount: reconciliation.BankAccount.name,
                reconciliationDate: reconciliation.reconciliationDate,
                statementDate: reconciliation.statementDate,
                status: reconciliation.status,
                isBalanced: reconciliation.isBalanced
            },
            balances: {
                statementOpeningBalance: reconciliation.openingBalance,
                statementClosingBalance: reconciliation.closingBalance,
                bookOpeningBalance: reconciliation.bookOpeningBalance,
                bookClosingBalance: reconciliation.bookClosingBalance,
                difference: reconciliation.difference
            },
            totals: {
                totalDeposits: reconciliation.totalDeposits,
                totalWithdrawals: reconciliation.totalWithdrawals,
                reconciledDeposits: reconciliation.reconciledDeposits,
                reconciledWithdrawals: reconciliation.reconciledWithdrawals,
                unreconciledDeposits: reconciliation.unreconciledDeposits,
                unreconciledWithdrawals: reconciliation.unreconciledWithdrawals
            },
            itemCounts: {
                totalItems: reconciliation.Items.length,
                matchedItems: matchedItems.length,
                outstandingDeposits: outstandingDeposits.length,
                outstandingWithdrawals: outstandingWithdrawals.length,
                bankCharges: bankCharges.length,
                bankInterest: bankInterest.length,
                adjustments: adjustments.length,
                errors: errors.length
            },
            items: {
                matched: matchedItems,
                outstandingDeposits,
                outstandingWithdrawals,
                bankCharges,
                bankInterest,
                adjustments,
                errors
            }
        };

        res.json({ summary });
    } catch (error) {
        console.error('Error generating reconciliation summary:', error);
        res.status(500).json({ error: 'Failed to generate reconciliation summary', details: error.message });
    }
};

module.exports = exports;
