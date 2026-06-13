const { AccountCategory, AccountType, LedgerAccount, User } = require('../models');
const { Op } = require('sequelize');

/**
 * Create new Account Category
 */
exports.createAccountCategory = async (req, res) => {
    try {
        const { name, description, accountTypeId, code } = req.body;

        // Validation   
        if (!name || !accountTypeId || !code) {
            return res.status(400).json({ error: 'Name, accountTypeId and code are required' });
        }

        // Verify Account Type exists
        const accountType = await AccountType.findByPk(accountTypeId);
        if (!accountType) {
            return res.status(404).json({ error: 'Account Type not found' });
        }

        const category = await AccountCategory.create({
            name,
            code,
            description,
            accountTypeId,
            createdBy: req.user.id
        });

        res.status(201).json({
            message: 'Account Category created successfully',
            data: category
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get all Account Categories
 */
exports.getAllAccountCategories = async (req, res) => {
    try {
        const { accountTypeId, status, page = 1, limit = 10 } = req.query;
        const where = {};
        if (accountTypeId) where.accountTypeId = accountTypeId;
        if (status) where.status = status;

        const offset = (page - 1) * limit;

        const { count, rows } = await AccountCategory.findAndCountAll({
            where,
            include: [
                { model: AccountType, as: 'AccountType', attributes: ['id', 'name', 'drBehavior', 'crBehavior'] },
                { model: LedgerAccount, as: 'LedgerAccounts', attributes: ['id', 'name', 'ledgerCode'] }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['name', 'ASC']]
        });

        res.json({
            message: 'Account Categories retrieved successfully',
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
 * Get Account Category by ID
 */
exports.getAccountCategoryById = async (req, res) => {
    try {
        const { id } = req.params;

        const category = await AccountCategory.findByPk(id, {
            include: [
                { model: AccountType, as: 'AccountType' },
                {
                    model: LedgerAccount,
                    as: 'LedgerAccounts',
                    attributes: ['id', 'ledgerCode', 'name', 'status']
                },
                { model: User, as: 'Creator', attributes: ['id', 'name', 'email'] }
            ]
        });

        if (!category) {
            return res.status(404).json({ error: 'Account Category not found' });
        }

        res.json({
            message: 'Account Category retrieved successfully',
            data: category
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Update Account Category
 */
exports.updateAccountCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, accountTypeId, status } = req.body;

        const category = await AccountCategory.findByPk(id);
        if (!category) {
            return res.status(404).json({ error: 'Account Category not found' });
        }

        // Verify Account Type if changing
        if (accountTypeId && accountTypeId !== category.accountTypeId) {
            const accountType = await AccountType.findByPk(accountTypeId);
            if (!accountType) {
                return res.status(404).json({ error: 'Account Type not found' });
            }
        }

        await category.update({
            name: name || category.name,
            description: description !== undefined ? description : category.description,
            accountTypeId: accountTypeId || category.accountTypeId,
            status: status || category.status,
            updatedBy: req.user.id
        });

        res.json({
            message: 'Account Category updated successfully',
            data: category
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Deactivate Account Category
 */
exports.deactivateAccountCategory = async (req, res) => {
    try {
        const { id } = req.params;

        const category = await AccountCategory.findByPk(id);
        if (!category) {
            return res.status(404).json({ error: 'Account Category not found' });
        }

        // Check if any ledgers exist
        const ledgerCount = await LedgerAccount.count({
            where: { accountCategoryId: id }
        });

        if (ledgerCount > 0) {
            return res.status(400).json({
                error: `Cannot deactivate: ${ledgerCount} ledger accounts exist under this category`
            });
        }

        await category.update({
            status: 'Inactive',
            updatedBy: req.user.id
        });

        res.json({
            message: 'Account Category deactivated successfully',
            data: category
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get categories by Account Type
 */
exports.getCategoriesByAccountType = async (req, res) => {
    try {
        const { accountTypeId } = req.params;

        const categories = await AccountCategory.findAll({
            where: {
                accountTypeId,
                status: 'Active'
            },
            include: [
                { model: AccountType, as: 'AccountType' }
            ],
            order: [['name', 'ASC']]
        });

        res.json({
            message: 'Categories retrieved successfully',
            data: categories
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get next Account Category code for a given Account Type
 * Format: {AccountTypeCode}{2-digit-number}
 * Example: If AccountType code is "AS" and last category is "AS05", next will be "AS06"
 */
exports.getNextAccountCategoryCode = async (req, res) => {
    try {
        const { accountTypeId } = req.query;

        // Validation
        if (!accountTypeId) {
            return res.status(400).json({ error: 'accountTypeId is required' });
        }

        // Get Account Type
        const accountType = await AccountType.findByPk(accountTypeId);
        if (!accountType) {
            return res.status(404).json({ error: 'Account Type not found' });
        }

        if (!accountType.code) {
            return res.status(400).json({ error: 'Account Type does not have a code defined' });
        }

        // Find the last Account Category for this Account Type
        // Order by code descending to get the highest code
        const lastCategory = await AccountCategory.findOne({
            where: {
                accountTypeId: accountTypeId,
                code: {
                    [Op.like]: `${accountType.code}%`
                }
            },
            order: [['code', 'DESC']]
        });

        let nextNumber = 1;

        if (lastCategory && lastCategory.code) {
            // Extract the last 2 digits from the code
            // Example: "AS05" -> "05" -> 5
            const codePrefix = accountType.code;
            const lastCode = lastCategory.code;

            // Get the numeric part after the prefix
            const numericPart = lastCode.substring(codePrefix.length);

            // Parse as integer and increment
            const lastNumber = parseInt(numericPart, 10);

            if (!isNaN(lastNumber)) {
                nextNumber = lastNumber + 1;
            }
        }

        // Format the next code with 2-digit padding
        const nextCode = `${accountType.code}${String(nextNumber).padStart(2, '0')}`;

        res.json({
            message: 'Next Account Category code generated successfully',
            data: {
                accountTypeId: accountType.id,
                accountTypeCode: accountType.code,
                accountTypeName: accountType.name,
                lastCode: lastCategory ? lastCategory.code : null,
                nextCode: nextCode,
                nextNumber: nextNumber
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
