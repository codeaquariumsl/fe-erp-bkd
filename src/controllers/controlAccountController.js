const { ControlAccount, AccountType, AccountCategory, LedgerAccount, User } = require('../models');
const { Op } = require('sequelize');

/**
 * Create new Control Account
 */
exports.createControlAccount = async (req, res) => {
    try {
        const { name, code, description, accountTypeId, accountCategoryId, controlType } = req.body;

        // Validation
        if (!name || !code || !accountTypeId || !accountCategoryId || !controlType) {
            return res.status(400).json({
                error: 'name, code, accountTypeId, accountCategoryId, and controlType are required'
            });
        }

        // Verify Account Type
        const accountType = await AccountType.findByPk(accountTypeId);
        if (!accountType) {
            return res.status(404).json({ error: 'Account Type not found' });
        }

        // Verify Account Category
        const accountCategory = await AccountCategory.findByPk(accountCategoryId);
        if (!accountCategory || accountCategory.accountTypeId !== parseInt(accountTypeId)) {
            return res.status(404).json({ error: 'Account Category not found or type mismatch' });
        }

        // Check unique name
        const existing = await ControlAccount.findOne({ where: { name } });
        if (existing) {
            return res.status(400).json({ error: 'Control Account with this name already exists' });
        }

        const controlAccount = await ControlAccount.create({
            name,
            code,
            description,
            accountTypeId,
            accountCategoryId,
            controlType,
            createdBy: req.user.id
        });

        res.status(201).json({
            message: 'Control Account created successfully',
            data: controlAccount
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get next Control Account code for a given Account Category
 * Format: {AccountCategoryCode}{2-digit-number}
 * Example: If AccountCategory code is "AC" and last category is "AC05", next will be "AC06"
 */
exports.getNextControlAccountCode = async (req, res) => {
    try {
        const { accountCategoryId } = req.query;

        // Validation
        if (!accountCategoryId) {
            return res.status(400).json({ error: 'accountCategoryId is required' });
        }

        const accountCategory = await AccountCategory.findByPk(accountCategoryId);
        if (!accountCategory) {
            return res.status(404).json({ error: 'Account Category not found' });
        }

        if (!accountCategory.code) {
            return res.status(400).json({ error: 'Account Category does not have a code defined' });
        }

        const lastControlAccount = await ControlAccount.findOne({
            where: {
                accountCategoryId,
                code: {
                    [Op.like]: `${accountCategory.code}%`
                }
            },
            order: [['code', 'DESC']],
        });

        let nextNumber = 1;

        if (lastControlAccount && lastControlAccount.code) {
            const codePrefix = accountCategory.code;
            const lastCode = lastControlAccount.code;

            // Get the numeric part after the prefix
            const numericPart = lastCode.substring(codePrefix.length);

            // Parse as integer and increment
            const lastNumber = parseInt(numericPart, 10);

            if (!isNaN(lastNumber)) {
                nextNumber = lastNumber + 1;
            }
        }

        const nextCode = `${accountCategory.code}${String(nextNumber).padStart(2, '0')}`;

        res.json({
            message: 'Next Control Account code retrieved successfully',
            data: {
                accountCategoryId: accountCategory.id,
                accountCategoryCode: accountCategory.code,
                lastCode: lastControlAccount ? lastControlAccount.code : null,
                nextCode: nextCode
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get all Control Accounts
 */
exports.getAllControlAccounts = async (req, res) => {
    try {
        const { controlType, status, page = 1, limit = 10 } = req.query;
        const where = {};
        if (controlType) where.controlType = controlType;
        if (status) where.status = status;

        const offset = (page - 1) * limit;

        const { count, rows } = await ControlAccount.findAndCountAll({
            where,
            include: [
                { model: AccountType, as: 'AccountType', attributes: ['id', 'name'] },
                { model: AccountCategory, as: 'AccountCategory', attributes: ['id', 'name'] },
                {
                    model: LedgerAccount,
                    as: 'LedgerAccounts',
                    attributes: ['id', 'ledgerCode', 'name'],
                    required: false
                }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['name', 'ASC']],
            distinct: true
        });

        res.json({
            message: 'Control Accounts retrieved successfully',
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
 * Get Control Account by ID with child ledgers
 */
exports.getControlAccountById = async (req, res) => {
    try {
        const { id } = req.params;

        const controlAccount = await ControlAccount.findByPk(id, {
            include: [
                { model: AccountType, as: 'AccountType' },
                { model: AccountCategory, as: 'AccountCategory' },
                {
                    model: LedgerAccount,
                    as: 'LedgerAccounts',
                    attributes: ['id', 'ledgerCode', 'name', 'status']
                },
                { model: User, as: 'Creator', attributes: ['id', 'name', 'email'] }
            ]
        });

        if (!controlAccount) {
            return res.status(404).json({ error: 'Control Account not found' });
        }

        res.json({
            message: 'Control Account retrieved successfully',
            data: controlAccount
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Update Control Account
 */
exports.updateControlAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, accountCategoryId, status } = req.body;

        const controlAccount = await ControlAccount.findByPk(id);
        if (!controlAccount) {
            return res.status(404).json({ error: 'Control Account not found' });
        }

        // Verify Account Category if changing
        if (accountCategoryId && accountCategoryId !== controlAccount.accountCategoryId) {
            const accountCategory = await AccountCategory.findByPk(accountCategoryId);
            if (!accountCategory) {
                return res.status(404).json({ error: 'Account Category not found' });
            }
        }

        // Check unique name if changing
        if (name && name !== controlAccount.name) {
            const existing = await ControlAccount.findOne({ where: { name } });
            if (existing) {
                return res.status(400).json({ error: 'Control Account with this name already exists' });
            }
        }

        await controlAccount.update({
            name: name || controlAccount.name,
            description: description !== undefined ? description : controlAccount.description,
            accountCategoryId: accountCategoryId || controlAccount.accountCategoryId,
            status: status || controlAccount.status,
            updatedBy: req.user.id
        });

        res.json({
            message: 'Control Account updated successfully',
            data: controlAccount
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Deactivate Control Account
 */
exports.deactivateControlAccount = async (req, res) => {
    try {
        const { id } = req.params;

        const controlAccount = await ControlAccount.findByPk(id);
        if (!controlAccount) {
            return res.status(404).json({ error: 'Control Account not found' });
        }

        // Check if any child ledgers exist
        const ledgerCount = await LedgerAccount.count({
            where: { controlAccountId: id }
        });

        if (ledgerCount > 0) {
            return res.status(400).json({
                error: `Cannot deactivate: ${ledgerCount} ledger accounts are linked to this Control Account`
            });
        }

        await controlAccount.update({
            status: 'Inactive',
            updatedBy: req.user.id
        });

        res.json({
            message: 'Control Account deactivated successfully',
            data: controlAccount
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get Control Accounts by Type
 */
exports.getControlAccountsByType = async (req, res) => {
    try {
        const { controlType } = req.params;

        const controlAccounts = await ControlAccount.findAll({
            where: {
                controlType,
                status: 'Active'
            },
            include: [
                { model: AccountType, as: 'AccountType', attributes: ['id', 'name'] },
                { model: AccountCategory, as: 'AccountCategory', attributes: ['id', 'name'] }
            ],
            order: [['name', 'ASC']]
        });

        res.json({
            message: 'Control Accounts retrieved successfully',
            data: controlAccounts
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
