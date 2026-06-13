const { AccountType, User, AccountCategory, ControlAccount, LedgerAccount } = require('../models');
const { Op } = require('sequelize');

// ===== ACCOUNT TYPE CONTROLLER =====

/**
 * Create new Account Type
 * Validates: unique name, Dr/Cr behavior consistency
 */
exports.createAccountType = async (req, res) => {
    try {
        const { name, description, drBehavior, crBehavior } = req.body;

        // Validation
        if (!name || !drBehavior || !crBehavior) {
            return res.status(400).json({ error: 'Name, drBehavior, and crBehavior are required' });
        }

        if (!['increase', 'decrease'].includes(drBehavior) || !['increase', 'decrease'].includes(crBehavior)) {
            return res.status(400).json({ error: 'drBehavior and crBehavior must be "increase" or "decrease"' });
        }

        // Check for duplicate name
        const existing = await AccountType.findOne({ where: { name } });
        if (existing) {
            return res.status(400).json({ error: 'Account Type with this name already exists' });
        }

        const accountType = await AccountType.create({
            name,
            description,
            drBehavior,
            crBehavior,
            createdBy: req.user.id
        });

        res.status(201).json({
            message: 'Account Type created successfully',
            data: accountType
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get all Account Types with category count
 */
exports.getAllAccountTypes = async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        const where = status ? { status } : {};
        const offset = (page - 1) * limit;

        const { count, rows } = await AccountType.findAndCountAll({
            where,
            include: [
                { model: AccountCategory, as: 'Categories', attributes: ['id', 'name'] }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['code', 'ASC']]
        });

        res.json({
            message: 'Account Types retrieved successfully',
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
 * Get Account Type by ID
 */
exports.getAccountTypeById = async (req, res) => {
    try {
        const { id } = req.params;

        const accountType = await AccountType.findByPk(id, {
            include: [
                {
                    model: AccountCategory,
                    as: 'Categories',
                    include: [
                        { model: LedgerAccount, as: 'LedgerAccounts', attributes: ['id', 'name'] }
                    ]
                },
                { model: User, as: 'Creator', attributes: ['id', 'name', 'email'] }
            ]
        });

        if (!accountType) {
            return res.status(404).json({ error: 'Account Type not found' });
        }

        res.json({
            message: 'Account Type retrieved successfully',
            data: accountType
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Update Account Type
 */
exports.updateAccountType = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, drBehavior, crBehavior, status } = req.body;

        const accountType = await AccountType.findByPk(id);
        if (!accountType) {
            return res.status(404).json({ error: 'Account Type not found' });
        }

        // Prevent editing system-protected types
        if (accountType.isSystemProtected) {
            return res.status(403).json({ error: 'Cannot edit system-protected Account Types' });
        }

        // Validate Dr/Cr behavior if changing
        if (drBehavior && !['increase', 'decrease'].includes(drBehavior)) {
            return res.status(400).json({ error: 'drBehavior must be "increase" or "decrease"' });
        }
        if (crBehavior && !['increase', 'decrease'].includes(crBehavior)) {
            return res.status(400).json({ error: 'crBehavior must be "increase" or "decrease"' });
        }

        // Check for duplicate name if changing
        if (name && name !== accountType.name) {
            const existing = await AccountType.findOne({ where: { name } });
            if (existing) {
                return res.status(400).json({ error: 'Account Type with this name already exists' });
            }
        }

        await accountType.update({
            name: name || accountType.name,
            description: description !== undefined ? description : accountType.description,
            drBehavior: drBehavior || accountType.drBehavior,
            crBehavior: crBehavior || accountType.crBehavior,
            status: status || accountType.status,
            updatedBy: req.user.id
        });

        res.json({
            message: 'Account Type updated successfully',
            data: accountType
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Deactivate Account Type
 */
exports.deactivateAccountType = async (req, res) => {
    try {
        const { id } = req.params;

        const accountType = await AccountType.findByPk(id);
        if (!accountType) {
            return res.status(404).json({ error: 'Account Type not found' });
        }

        // Check if any categories exist
        const categoryCount = await AccountCategory.count({
            where: { accountTypeId: id }
        });

        if (categoryCount > 0) {
            return res.status(400).json({
                error: `Cannot deactivate: ${categoryCount} categories are linked to this Account Type`
            });
        }

        await accountType.update({
            status: 'Inactive',
            updatedBy: req.user.id
        });

        res.json({
            message: 'Account Type deactivated successfully',
            data: accountType
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get Dr/Cr behavior rules
 */
exports.getAccountingRules = async (req, res) => {
    try {
        const rules = await AccountType.findAll({
            where: { status: 'Active' },
            attributes: ['id', 'name', 'drBehavior', 'crBehavior'],
            order: [['name', 'ASC']]
        });

        res.json({
            message: 'Accounting rules retrieved successfully',
            data: rules
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
