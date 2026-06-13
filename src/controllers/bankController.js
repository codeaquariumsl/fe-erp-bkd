const { Bank, BankBranch, User } = require('../models');
const { Op } = require('sequelize');

/**
 * Create new Bank
 */
exports.createBank = async (req, res) => {
    try {
        const { code, name, status } = req.body;

        // Validation
        if (!code || !name) {
            return res.status(400).json({ error: 'Code and Name are required' });
        }

        // Check if bank already exists
        const existingBank = await Bank.findOne({
            where: {
                [Op.or]: [{ code }, { name }]
            }
        });

        if (existingBank) {
            return res.status(400).json({ error: 'Bank with this code or name already exists' });
        }

        const bank = await Bank.create({
            code,
            name,
            status: status || 'Active',
            createdBy: req.user.id
        });

        res.status(201).json({
            message: 'Bank created successfully',
            data: bank
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get all Banks
 */
exports.getAllBanks = async (req, res) => {
    try {
        const { status, page = 1, limit = 100 } = req.query;
        const where = {};
        if (status) where.status = status;

        const offset = (page - 1) * limit;

        const { count, rows } = await Bank.findAndCountAll({
            where,
            include: [
                { model: User, as: 'Creator', attributes: ['id', 'fullName'] }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['name', 'ASC']]
        });

        res.json({
            message: 'Banks retrieved successfully',
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
 * Get Bank by ID
 */
exports.getBankById = async (req, res) => {
    try {
        const { id } = req.params;

        const bank = await Bank.findByPk(id, {
            include: [
                { model: BankBranch, as: 'Branches' },
                { model: User, as: 'Creator', attributes: ['id', 'fullName'] },
                { model: User, as: 'Updater', attributes: ['id', 'fullName'] }
            ]
        });

        if (!bank) {
            return res.status(404).json({ error: 'Bank not found' });
        }

        res.json({
            message: 'Bank retrieved successfully',
            data: bank
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Update Bank
 */
exports.updateBank = async (req, res) => {
    try {
        const { id } = req.params;
        const { code, name, status } = req.body;

        const bank = await Bank.findByPk(id);
        if (!bank) {
            return res.status(404).json({ error: 'Bank not found' });
        }

        // Check for duplicate code/name if changed
        if (code && code !== bank.code) {
            const exists = await Bank.findOne({ where: { code, id: { [Op.ne]: id } } });
            if (exists) return res.status(400).json({ error: 'Bank code already exists' });
        }
        if (name && name !== bank.name) {
            const exists = await Bank.findOne({ where: { name, id: { [Op.ne]: id } } });
            if (exists) return res.status(400).json({ error: 'Bank name already exists' });
        }

        await bank.update({
            code: code || bank.code,
            name: name || bank.name,
            status: status || bank.status,
            updatedBy: req.user.id
        });

        res.json({
            message: 'Bank updated successfully',
            data: bank
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Delete Bank (Soft Delete)
 */
exports.deleteBank = async (req, res) => {
    try {
        const { id } = req.params;

        const bank = await Bank.findByPk(id);
        if (!bank) {
            return res.status(404).json({ error: 'Bank not found' });
        }

        // Check if branches exist
        const branchCount = await BankBranch.count({ where: { bankId: id } });
        if (branchCount > 0) {
            return res.status(400).json({ error: `Cannot delete: ${branchCount} branches exist for this bank` });
        }

        // Instead of hard delete, maybe just check if any usage? 
        // For now, allow soft delete by setting status to Inactive is what the user usually wants, 
        // but if they explicitly asked for CRUD delete, usually strict consistency check is needed.
        // I will implement soft delete logic (status = Inactive) if safe, or hard delete if no deps.
        // Actually, the prompt says "crud endpoints".
        // I will implement a check. If really need hard delete, use destroy. 
        // But usually banks are reference data.

        // I'll stick to 'update status' as 'delete' or provide a real destroy if safe.
        // Let's implement destroy but guard it.

        await bank.destroy();

        res.json({
            message: 'Bank deleted successfully'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
