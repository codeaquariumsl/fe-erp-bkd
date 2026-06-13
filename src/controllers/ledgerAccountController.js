const { LedgerAccount, AccountType, AccountCategory, ControlAccount, Bank, BankBranch, JournalEntryLine, User, PettyCashBook, sequelize } = require('../models');
const { Op } = require('sequelize');


/**
 * Get next Ledger Account code for a given Account Category or Control Account
 * Format: {AccountCategoryCode}{5-digit-number} or {ControlAccountCode}{3-digit-number}
 * Example: If AccountCategory code is "AS" and last category is "AS00005", next will be "AS00006"
 * If ControlAccount code is "CA" and last category is "CA005", next will be "CA006"
 */
exports.getNextLedgerAccountCode = async (req, res) => {
    try {
        const { accountCategoryId, controlAccountId } = req.query;

        let nextCode;
        let prefixCode;
        let paddingLength;

        if (accountCategoryId) {
            const accountCategory = await AccountCategory.findByPk(accountCategoryId);
            if (!accountCategory) {
                return res.status(404).json({ error: 'Account Category not found' });
            }
            if (!accountCategory.code) {
                return res.status(400).json({ error: 'Account Category does not have a code defined' });
            }
            prefixCode = accountCategory.code;
            paddingLength = 5;

            const lastAccount = await LedgerAccount.findOne({
                where: {
                    accountCategoryId,
                    ledgerCode: {
                        [Op.like]: `${prefixCode}00%`
                    }
                },
                order: [['ledgerCode', 'DESC']],
                attributes: ['ledgerCode']
            });
            let nextNumber = 1;
            if (lastAccount && lastAccount.ledgerCode) {
                const numericPart = lastAccount.ledgerCode.substring(5);
                const lastNumber = parseInt(numericPart, 10);
                if (!isNaN(lastNumber)) {
                    nextNumber = lastNumber + 1;
                }
            }
            nextCode = `${prefixCode}${String(nextNumber).padStart(paddingLength, '0')}`;

        } else if (controlAccountId) {
            const controlAccount = await ControlAccount.findByPk(controlAccountId);
            if (!controlAccount) {
                return res.status(404).json({ error: 'Control Account not found' });
            }
            if (!controlAccount.code) {
                return res.status(400).json({ error: 'Control Account does not have a code defined' });
            }
            prefixCode = controlAccount.code;
            paddingLength = 3;

            const lastAccount = await LedgerAccount.findOne({
                where: {
                    controlAccountId,
                    ledgerCode: {
                        [Op.like]: `${prefixCode}%`
                    }
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
            nextCode = `${prefixCode}${String(nextNumber).padStart(paddingLength, '0')}`;

        } else {
            return res.status(400).json({ error: 'Either accountCategoryId or controlAccountId must be provided' });
        }

        res.json({
            message: 'Next Ledger Account code retrieved successfully',
            data: { nextCode: nextCode }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Create new Ledger Account
 */
exports.createLedgerAccount = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const {
            name, ledgerCode, description, accountTypeId, accountCategoryId, isUseControlAccount, controlAccountId,
            openingBalance, openingBalanceType, ledgerType, isBankLedger, bankId, branchId, accountNumber, accountHolderName,
            cashBookLedgerId, pettyCashAmount, bufferLevel, location, custodian
        } = req.body;

        // Validation
        if (!name || !accountTypeId || !accountCategoryId) {
            if (!transaction.finished) await transaction.rollback();
            return res.status(400).json({
                error: 'name, accountTypeId, and accountCategoryId are required'
            });
        }

        // Verify Account Type
        const accountType = await AccountType.findByPk(accountTypeId, { transaction });
        if (!accountType) {
            if (!transaction.finished) await transaction.rollback();
            return res.status(404).json({ error: 'Account Type not found' });
        }

        // Verify Account Category
        const accountCategory = await AccountCategory.findByPk(accountCategoryId, { transaction });
        if (!accountCategory || accountCategory.accountTypeId !== parseInt(accountTypeId)) {
            if (!transaction.finished) await transaction.rollback();
            return res.status(404).json({ error: 'Account Category not found or type mismatch' });
        }

        // Verify Control Account if provided
        if (controlAccountId) {
            const controlAccount = await ControlAccount.findByPk(controlAccountId, { transaction });
            if (!controlAccount) {
                if (!transaction.finished) await transaction.rollback();
                return res.status(404).json({ error: 'Control Account not found' });
            }
        }

        // Verify Bank details if isBankLedger is true
        if (isBankLedger) {
            if (!bankId || !branchId || !accountNumber) {
                if (!transaction.finished) await transaction.rollback();
                return res.status(400).json({ error: 'Bank, Branch, and Account Number are required for Bank Ledgers' });
            }

            // Verify Bank and Branch exist
            const bank = await Bank.findByPk(bankId, { transaction });
            if (!bank) {
                if (!transaction.finished) await transaction.rollback();
                return res.status(404).json({ error: 'Bank not found' });
            }

            const branch = await BankBranch.findByPk(branchId, { transaction });
            if (!branch) {
                if (!transaction.finished) await transaction.rollback();
                return res.status(404).json({ error: 'Branch not found' });
            }

            if (branch.bankId !== parseInt(bankId)) {
                if (!transaction.finished) await transaction.rollback();
                return res.status(400).json({ error: 'Branch does not belong to the selected Bank' });
            }
        }

        // Get user ID from auth middleware or request body
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;

        if (!currentUserId) {
            if (!transaction.finished) await transaction.rollback();
            return res.status(401).json({
                error: 'Unauthorized: missing user context',
                details: 'User ID is required for creating ledger accounts'
            });
        }

        const ledgerAccount = await LedgerAccount.create({
            ledgerCode,
            name,
            description,
            accountTypeId,
            accountCategoryId,
            isUseControlAccount,
            controlAccountId: controlAccountId && controlAccountId !== '' ? controlAccountId : null,
            openingBalance: openingBalance || 0,
            openingBalanceType: openingBalanceType || 'DR',
            ledgerType: ledgerType || 'GENERAL',
            isBankLedger: isBankLedger || false,
            bankId: isBankLedger ? bankId : null,
            branchId: isBankLedger ? branchId : null,
            accountNumber: isBankLedger ? accountNumber : null,
            accountHolderName: isBankLedger ? accountHolderName : null,
            cashBookLedgerId: cashBookLedgerId || null,
            pettyCashAmount: pettyCashAmount || 0,
            bufferLevel: bufferLevel || 0,
            createdBy: currentUserId
        }, { transaction });

        // If ledgerType is PETTY_CASH, create a Petty Cash Book automatically
        if (ledgerType === 'PETTY_CASH') {
            await PettyCashBook.create({
                pettyCashCode: ledgerCode,
                name: name,
                location: location || 'Head Office',
                custodian: custodian || 'General',
                initialAmount: parseFloat(pettyCashAmount) || 0.00,
                currentBalance: parseFloat(pettyCashAmount) || 0.00,
                ledgerAccountId: ledgerAccount.id,
                status: 'Active',
                createdBy: currentUserId
            }, { transaction });
        }

        await transaction.commit();

        res.status(201).json({
            message: 'Ledger Account created successfully',
            data: ledgerAccount
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }
        // Enhanced error handling for validation errors
        if (error.name === 'SequelizeValidationError') {
            const validationErrors = error.errors.map(err => ({
                field: err.path,
                message: err.message,
                value: err.value,
                validatorKey: err.validatorKey
            }));
            return res.status(400).json({
                error: 'Validation error',
                details: validationErrors,
                message: error.errors.map(e => e.message).join(', ')
            });
        }

        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({
                error: 'Duplicate entry',
                details: error.errors.map(err => ({
                    field: err.path,
                    message: err.message
                }))
            });
        }

        if (error.name === 'SequelizeForeignKeyConstraintError') {
            return res.status(400).json({
                error: 'Foreign key constraint error',
                details: error.message
            });
        }

        console.error('Ledger Account creation error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get all Ledger Accounts with filters
 */
exports.getAllLedgerAccounts = async (req, res) => {
    try {
        const { accountTypeId, accountCategoryId, controlAccountId, ledgerType, status, search, page = 1, limit = 10 } = req.query;
        const where = {};

        if (accountTypeId) where.accountTypeId = accountTypeId;
        if (accountCategoryId) where.accountCategoryId = accountCategoryId;
        if (controlAccountId) where.controlAccountId = controlAccountId;
        if (ledgerType) where.ledgerType = ledgerType;
        if (status) where.status = status;

        if (search) {
            where[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
                { ledgerCode: { [Op.like]: `%${search}%` } }
            ];
        }

        const offset = (page - 1) * limit;

        const { count, rows } = await LedgerAccount.findAndCountAll({
            where,
            include: [
                { model: AccountType, as: 'AccountType', attributes: ['id', 'name'] },
                { model: AccountCategory, as: 'AccountCategory', attributes: ['id', 'name'] },
                { model: ControlAccount, as: 'ControlAccount', attributes: ['id', 'name'] },
                { model: Bank, as: 'Bank', attributes: ['id', 'name', 'code'] },
                { model: BankBranch, as: 'Branch', attributes: ['id', 'branchName', 'branchCode'] }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['ledgerCode', 'ASC']],
            distinct: true
        });

        res.json({
            message: 'Ledger Accounts retrieved successfully',
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


exports.getAllLedgerAccountsWithoutPagination = async (req, res) => {
    try {
        const ledgerAccounts = await LedgerAccount.findAll({
            where: {
                status: 'Active'
            },
            include: [
                { model: AccountType, as: 'AccountType', attributes: ['id', 'name'] },
                { model: AccountCategory, as: 'AccountCategory', attributes: ['id', 'name'] },
                { model: ControlAccount, as: 'ControlAccount', attributes: ['id', 'name'] },
                { model: Bank, as: 'Bank', attributes: ['id', 'name', 'code'] },
                { model: BankBranch, as: 'Branch', attributes: ['id', 'branchName', 'branchCode'] }
            ],
            order: [['ledgerCode', 'ASC']]
        });

        res.json({
            message: 'All Ledger Accounts retrieved successfully',
            data: ledgerAccounts,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get Ledger Account by ID
 */
exports.getLedgerAccountById = async (req, res) => {
    try {
        const { id } = req.params;

        const ledgerAccount = await LedgerAccount.findByPk(id, {
            include: [
                { model: AccountType, as: 'AccountType' },
                { model: AccountCategory, as: 'AccountCategory' },
                { model: ControlAccount, as: 'ControlAccount' },
                { model: ControlAccount, as: 'ControlAccount' },
                { model: Bank, as: 'Bank' },
                { model: BankBranch, as: 'Branch' },
                { model: User, as: 'Creator', attributes: ['id', 'name', 'email'] }
            ]
        });

        if (!ledgerAccount) {
            return res.status(404).json({ error: 'Ledger Account not found' });
        }

        res.json({
            message: 'Ledger Account retrieved successfully',
            data: ledgerAccount
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Update Ledger Account
 */
exports.updateLedgerAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name, description, accountCategoryId, isUseControlAccount, controlAccountId, status,
            isBankLedger, bankId, branchId, accountNumber, accountHolderName
        } = req.body;

        const ledgerAccount = await LedgerAccount.findByPk(id);
        if (!ledgerAccount) {
            return res.status(404).json({ error: 'Ledger Account not found' });
        }

        // Verify Account Category if changing
        if (accountCategoryId && accountCategoryId !== ledgerAccount.accountCategoryId) {
            const accountCategory = await AccountCategory.findByPk(accountCategoryId);
            if (!accountCategory) {
                return res.status(404).json({ error: 'Account Category not found' });
            }
        }

        // Verify Control Account if changing
        if (controlAccountId && controlAccountId !== ledgerAccount.controlAccountId) {
            const controlAccount = await ControlAccount.findByPk(controlAccountId);
            if (!controlAccount) {
                return res.status(404).json({ error: 'Control Account not found' });
            }
        }

        // Verify Bank Details if updating bank ledger info
        if (isBankLedger || (ledgerAccount.isBankLedger && (bankId || branchId))) {
            // If transitioning to bank ledger or updating existing bank ledger
            const targetBankId = bankId || ledgerAccount.bankId;
            const targetBranchId = branchId || ledgerAccount.branchId;

            if (targetBankId) {
                const bank = await Bank.findByPk(targetBankId);
                if (!bank) return res.status(404).json({ error: 'Bank not found' });
            }

            if (targetBranchId) {
                const branch = await BankBranch.findByPk(targetBranchId);
                if (!branch) return res.status(404).json({ error: 'Branch not found' });

                if (targetBankId && branch.bankId !== parseInt(targetBankId)) {
                    return res.status(400).json({ error: 'Branch does not belong to the selected Bank' });
                }
            }
        }

        await ledgerAccount.update({
            name: name || ledgerAccount.name,
            description: description !== undefined ? description : ledgerAccount.description,
            accountCategoryId: accountCategoryId || ledgerAccount.accountCategoryId,
            isUseControlAccount: isUseControlAccount || ledgerAccount.isUseControlAccount,
            controlAccountId: controlAccountId !== undefined ? controlAccountId : ledgerAccount.controlAccountId,
            status: status || ledgerAccount.status,
            isBankLedger: isBankLedger !== undefined ? isBankLedger : ledgerAccount.isBankLedger,
            bankId: bankId !== undefined ? bankId : ledgerAccount.bankId,
            branchId: branchId !== undefined ? branchId : ledgerAccount.branchId,
            accountNumber: accountNumber !== undefined ? accountNumber : ledgerAccount.accountNumber,
            accountHolderName: accountHolderName !== undefined ? accountHolderName : ledgerAccount.accountHolderName,
            updatedBy: req.user.id
        });

        res.json({
            message: 'Ledger Account updated successfully',
            data: ledgerAccount
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Deactivate Ledger Account
 */
exports.deactivateLedgerAccount = async (req, res) => {
    try {
        const { id } = req.params;

        const ledgerAccount = await LedgerAccount.findByPk(id);
        if (!ledgerAccount) {
            return res.status(404).json({ error: 'Ledger Account not found' });
        }

        // Check if any journal entries exist
        const journalCount = await JournalEntryLine.count({
            where: { ledgerAccountId: id }
        });

        if (journalCount > 0) {
            return res.status(400).json({
                error: `Cannot deactivate: ${journalCount} journal entries exist for this ledger`
            });
        }

        await ledgerAccount.update({
            status: 'Inactive',
            updatedBy: req.user.id
        });

        res.json({
            message: 'Ledger Account deactivated successfully',
            data: ledgerAccount
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get Chart of Accounts - Complete ledger hierarchy
 */
exports.getChartOfAccounts = async (req, res) => {
    try {
        const { status = 'Active' } = req.query;

        const accountTypes = await AccountType.findAll({
            where: { status },
            include: [
                {
                    model: AccountCategory,
                    as: 'Categories',
                    include: [
                        {
                            model: LedgerAccount,
                            as: 'LedgerAccounts',
                            where: { status },
                            attributes: ['id', 'ledgerCode', 'name', 'openingBalance', 'openingBalanceType']
                        }
                    ]
                }
            ],
            order: [[{ model: AccountCategory, as: 'Categories' }, 'name', 'ASC']]
        });

        res.json({
            message: 'Chart of Accounts retrieved successfully',
            data: accountTypes
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Setup system-required ledgers
 */
exports.setupSystemLedgers = async (req, res) => {
    try {
        const requiredLedgers = [
            { name: 'Inventory Asset', accountType: 'Asset', accountCategory: 'Current Assets', ledgerType: 'SYSTEM' },
            { name: 'Cost of Goods Sold', accountType: 'Expense', accountCategory: 'Operating Expenses', ledgerType: 'SYSTEM' },
            { name: 'Sales Income', accountType: 'Income', accountCategory: 'Operating Income', ledgerType: 'SYSTEM' },
            { name: 'Purchase Expense', accountType: 'Expense', accountCategory: 'Operating Expenses', ledgerType: 'SYSTEM' },
            { name: 'Stock Adjustment Gain', accountType: 'Income', accountCategory: 'Other Income', ledgerType: 'SYSTEM' },
            { name: 'Stock Adjustment Loss', accountType: 'Expense', accountCategory: 'Other Expenses', ledgerType: 'SYSTEM' }
        ];

        const createdLedgers = [];

        for (const ledger of requiredLedgers) {
            // Find or create account type
            let accountType = await AccountType.findOne({
                where: { name: ledger.accountType }
            });

            if (!accountType) {
                const drBehavior = ledger.accountType === 'Asset' ? 'increase' : 'decrease';
                const crBehavior = ledger.accountType === 'Asset' ? 'decrease' : 'increase';

                accountType = await AccountType.create({
                    name: ledger.accountType,
                    drBehavior,
                    crBehavior,
                    isSystemProtected: true,
                    createdBy: req.user.id
                });
            }

            // Find or create account category
            let accountCategory = await AccountCategory.findOne({
                where: {
                    name: ledger.accountCategory,
                    accountTypeId: accountType.id
                }
            });

            if (!accountCategory) {
                accountCategory = await AccountCategory.create({
                    name: ledger.accountCategory,
                    accountTypeId: accountType.id,
                    createdBy: req.user.id
                });
            }

            // Create ledger account
            const ledgerCode = await generateLedgerCode(accountType.id, accountCategory.id);

            const newLedger = await LedgerAccount.create({
                ledgerCode,
                name: ledger.name,
                accountTypeId: accountType.id,
                accountCategoryId: accountCategory.id,
                ledgerType: ledger.ledgerType,
                createdBy: req.user.id
            });

            createdLedgers.push(newLedger);
        }

        res.status(201).json({
            message: 'System ledgers setup completed',
            data: createdLedgers
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get ledger by code
 */
exports.getLedgerByCode = async (req, res) => {
    try {
        const { code } = req.params;

        const ledger = await LedgerAccount.findOne({
            where: { ledgerCode: code },
            include: [
                { model: AccountType, as: 'AccountType' },
                { model: AccountCategory, as: 'AccountCategory' }
            ]
        });

        if (!ledger) {
            return res.status(404).json({ error: 'Ledger not found' });
        }

        res.json({
            message: 'Ledger retrieved successfully',
            data: ledger
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get Expense Ledger Accounts
 * Returns all ledger accounts where AccountType is 'Expense'
 */
exports.getExpenseLedgers = async (req, res) => {
    try {
        const { status = 'Active', search, page = 1, limit = 100 } = req.query;

        // Find the Expense account type
        const expenseAccountType = await AccountType.findOne({
            where: { name: 'Expense' }
        });

        if (!expenseAccountType) {
            return res.status(404).json({
                error: 'Expense account type not found',
                message: 'Please ensure the chart of accounts is properly configured'
            });
        }

        const where = {
            accountTypeId: expenseAccountType.id,
            status
        };

        if (search) {
            where[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
                { ledgerCode: { [Op.like]: `%${search}%` } }
            ];
        }

        const offset = (page - 1) * limit;

        const { count, rows } = await LedgerAccount.findAndCountAll({
            where,
            include: [
                { model: AccountType, as: 'AccountType', attributes: ['id', 'name'] },
                { model: AccountCategory, as: 'AccountCategory', attributes: ['id', 'name', 'code'] },
                { model: ControlAccount, as: 'ControlAccount', attributes: ['id', 'name', 'code'] }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['ledgerCode', 'ASC']],
            distinct: true
        });

        res.json({
            message: 'Expense ledger accounts retrieved successfully',
            data: rows,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching expense ledgers:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get Payment Ledger Accounts
 * Returns all ledger accounts that can be used for payments (Bank, Cash, Petty Cash, Cash Book)
 */
exports.getPaymentLedgers = async (req, res) => {
    try {
        const { status = 'Active', search } = req.query;

        const where = {
            status,
            ledgerType: {
                [Op.in]: ['BANK', 'CASH', 'PETTY_CASH', 'CASH_BOOK']
            }
        };

        if (search) {
            where[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
                { ledgerCode: { [Op.like]: `%${search}%` } },
                { accountNumber: { [Op.like]: `%${search}%` } }
            ];
        }

        const paymentLedgers = await LedgerAccount.findAll({
            where,
            include: [
                { model: AccountType, as: 'AccountType', attributes: ['id', 'name'] },
                { model: AccountCategory, as: 'AccountCategory', attributes: ['id', 'name', 'code'] },
                { model: ControlAccount, as: 'ControlAccount', attributes: ['id', 'name', 'code'] },
                { model: Bank, as: 'Bank', attributes: ['id', 'name', 'code'] },
                { model: BankBranch, as: 'Branch', attributes: ['id', 'branchName', 'branchCode'] }
            ],
            order: [
                ['ledgerType', 'ASC'],
                ['name', 'ASC']
            ]
        });

        // Group by ledger type for easier frontend consumption
        const groupedLedgers = {
            bank: paymentLedgers.filter(l => l.ledgerType === 'BANK'),
            cash: paymentLedgers.filter(l => l.ledgerType === 'CASH'),
            pettyCash: paymentLedgers.filter(l => l.ledgerType === 'PETTY_CASH'),
            cashBook: paymentLedgers.filter(l => l.ledgerType === 'CASH_BOOK'),
            cheque: paymentLedgers.filter(l => l.name === 'Cheque In Hand')
        };

        res.json({
            message: 'Payment ledger accounts retrieved successfully',
            data: paymentLedgers,
            grouped: groupedLedgers,
            summary: {
                total: paymentLedgers.length,
                bank: groupedLedgers.bank.length,
                cash: groupedLedgers.cash.length,
                pettyCash: groupedLedgers.pettyCash.length,
                cashBook: groupedLedgers.cashBook.length
            }
        });
    } catch (error) {
        console.error('Error fetching payment ledgers:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get Bank Ledger Accounts
 * Returns all bank ledger accounts
 */
exports.getBankLedgers = async (req, res) => {
    try {
        const { status = 'Active', search } = req.query;

        const where = {
            status,
            ledgerType: {
                [Op.in]: ['BANK']
            }
        };

        if (search) {
            where[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
                { ledgerCode: { [Op.like]: `%${search}%` } },
                { accountNumber: { [Op.like]: `%${search}%` } }
            ];
        }

        const paymentLedgers = await LedgerAccount.findAll({
            where,
            include: [
                { model: AccountType, as: 'AccountType', attributes: ['id', 'name'] },
                { model: AccountCategory, as: 'AccountCategory', attributes: ['id', 'name', 'code'] },
                { model: ControlAccount, as: 'ControlAccount', attributes: ['id', 'name', 'code'] },
                { model: Bank, as: 'Bank', attributes: ['id', 'name', 'code'] },
                { model: BankBranch, as: 'Branch', attributes: ['id', 'branchName', 'branchCode'] }
            ],
            order: [
                ['ledgerType', 'ASC'],
                ['name', 'ASC']
            ]
        });

        // Group by ledger type for easier frontend consumption
        const groupedLedgers = {
            bank: paymentLedgers.filter(l => l.ledgerType === 'BANK'),
        };

        res.json({
            message: 'Bank ledger accounts retrieved successfully',
            data: paymentLedgers,
            grouped: groupedLedgers,
            summary: {
                total: paymentLedgers.length,
                bank: groupedLedgers.bank.length,
            }
        });
    } catch (error) {
        console.error('Error fetching bank ledgers:', error);
        res.status(500).json({ error: error.message });
    }
};

