const { Bank, BankBranch, User } = require('../models');
const { Op } = require('sequelize');

/**
 * Create new Bank Branch
 */
exports.createBankBranch = async (req, res) => {
    try {
        const { bankId, branchCode, branchName, swiftCode, status } = req.body;

        // Validation
        if (!bankId || !branchCode || !branchName) {
            return res.status(400).json({ error: 'Bank ID, Branch Code and Branch Name are required' });
        }

        // Verify Bank exists
        const bank = await Bank.findByPk(bankId);
        if (!bank) {
            return res.status(404).json({ error: 'Bank not found' });
        }

        // Check for duplicate branch within the same bank
        const existingBranch = await BankBranch.findOne({
            where: {
                bankId,
                branchCode
            }
        });

        if (existingBranch) {
            return res.status(400).json({ error: 'Branch with this code already exists for the selected bank' });
        }

        const branch = await BankBranch.create({
            bankId,
            branchCode,
            branchName,
            swiftCode,
            status: status || 'Active',
            createdBy: req.user.id
        });

        res.status(201).json({
            message: 'Bank Branch created successfully',
            data: branch
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get all Bank Branches
 */
exports.getAllBankBranches = async (req, res) => {
    try {
        const { bankId, status, page = 1, limit = 10 } = req.query;
        const where = {};
        if (bankId) where.bankId = bankId;
        if (status) where.status = status;

        const offset = (page - 1) * limit;

        const { count, rows } = await BankBranch.findAndCountAll({
            where,
            include: [
                { model: Bank, as: 'Bank', attributes: ['id', 'name', 'code'] },
                { model: User, as: 'Creator', attributes: ['id', 'fullName'] }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['branchName', 'ASC']]
        });

        res.json({
            message: 'Bank Branches retrieved successfully',
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
 * Get Bank Branch by ID
 */
exports.getBankBranchById = async (req, res) => {
    try {
        const { id } = req.params;

        const branch = await BankBranch.findByPk(id, {
            include: [
                { model: Bank, as: 'Bank', attributes: ['id', 'name', 'code'] },
                { model: User, as: 'Creator', attributes: ['id', 'fullName'] },
                { model: User, as: 'Updater', attributes: ['id', 'fullName'] }
            ]
        });

        if (!branch) {
            return res.status(404).json({ error: 'Bank Branch not found' });
        }

        res.json({
            message: 'Bank Branch retrieved successfully',
            data: branch
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Update Bank Branch
 */
exports.updateBankBranch = async (req, res) => {
    try {
        const { id } = req.params;
        const { bankId, branchCode, branchName, swiftCode, status } = req.body;

        const branch = await BankBranch.findByPk(id);
        if (!branch) {
            return res.status(404).json({ error: 'Bank Branch not found' });
        }

        // If bankId changed, check validity
        if (bankId && bankId !== branch.bankId) {
            const bank = await Bank.findByPk(bankId);
            if (!bank) return res.status(404).json({ error: 'Bank not found' });
        }

        // Check for uniqueness
        if ((branchCode && branchCode !== branch.branchCode) || (bankId && bankId !== branch.bankId)) {
            const checkBankId = bankId || branch.bankId;
            const checkBranchCode = branchCode || branch.branchCode;

            const existing = await BankBranch.findOne({
                where: {
                    bankId: checkBankId,
                    branchCode: checkBranchCode,
                    id: { [Op.ne]: id }
                }
            });

            if (existing) {
                return res.status(400).json({ error: 'Branch code already exists for this bank' });
            }
        }

        await branch.update({
            bankId: bankId || branch.bankId,
            branchCode: branchCode || branch.branchCode,
            branchName: branchName || branch.branchName,
            swiftCode: swiftCode !== undefined ? swiftCode : branch.swiftCode,
            status: status || branch.status,
            updatedBy: req.user.id
        });

        res.json({
            message: 'Bank Branch updated successfully',
            data: branch
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Delete Bank Branch
 */
exports.deleteBankBranch = async (req, res) => {
    try {
        const { id } = req.params;

        const branch = await BankBranch.findByPk(id);
        if (!branch) {
            return res.status(404).json({ error: 'Bank Branch not found' });
        }

        await branch.destroy();

        res.json({
            message: 'Bank Branch deleted successfully'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get Branches by Bank ID (Helper for frontend cascading)
 */
exports.getBranchesByBankId = async (req, res) => {
    try {
        const { bankId } = req.params;

        const branches = await BankBranch.findAll({
            where: {
                bankId,
                status: 'Active'
            },
            order: [['branchName', 'ASC']]
        });

        res.json({
            message: 'Branches retrieved successfully',
            data: branches
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
