const { Op } = require('sequelize');
const ReturnType = require('../models/returnType');
const User = require('../models/user');
const { generateDocumentNumber } = require('./documentControllerClient');

// Create a new return type
exports.createReturnType = async (req, res) => {
    try {
        const {
            name,
            description,
            isActive,
            isRefundable,
            isReplaceable,
            priority,
            locationId
        } = req.body;
        const code = await generateDocumentNumber('RT', locationId);

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const returnType = await ReturnType.create({
            name,
            code,
            description,
            isActive: isActive !== undefined ? isActive : true,
            isRefundable: isRefundable !== undefined ? isRefundable : true,
            isReplaceable: isReplaceable !== undefined ? isReplaceable : true,
            priority: priority || 0,
            createdBy: currentUserId,
            updatedBy: currentUserId
        });

        res.status(201).json(returnType);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get all return types with creator/updater usernames
exports.getReturnTypes = async (req, res) => {
    try {
        const { page = 1, limit = 50, search, isActive } = req.query;
        const offset = (page - 1) * limit;

        const whereClause = {};
        if (search) {
            whereClause[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
                { code: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } }
            ];
        }
        if (isActive !== undefined) {
            whereClause.isActive = isActive === 'true';
        }

        const { count, rows: returnTypes } = await ReturnType.findAndCountAll({
            where: whereClause,
            include: [
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] }
            ],
            order: [['priority', 'DESC'], ['name', 'ASC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        // Format response to include creator/updater usernames
        const result = returnTypes.map(rt => {
            const obj = rt.toJSON();
            obj.createdByUsername = obj.Creator ? obj.Creator.username : null;
            obj.updatedByUsername = obj.Updater ? obj.Updater.username : null;
            delete obj.Creator;
            delete obj.Updater;
            return obj;
        });

        res.json({
            returnTypes: result,
            totalCount: count,
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / limit)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get a single return type by ID with creator/updater usernames
exports.getReturnTypeById = async (req, res) => {
    try {
        const returnType = await ReturnType.findByPk(req.params.id, {
            include: [
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] }
            ]
        });

        if (!returnType) {
            return res.status(404).json({ error: 'Return type not found' });
        }

        const obj = returnType.toJSON();
        obj.createdByUsername = obj.Creator ? obj.Creator.username : null;
        obj.updatedByUsername = obj.Updater ? obj.Updater.username : null;
        delete obj.Creator;
        delete obj.Updater;

        res.json(obj);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update a return type
exports.updateReturnType = async (req, res) => {
    try {
        const {
            name,
            code,
            description,
            isActive,
            isRefundable,
            isReplaceable,
            priority
        } = req.body;

        const returnType = await ReturnType.findByPk(req.params.id);
        if (!returnType) {
            return res.status(404).json({ error: 'Return type not found' });
        }

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        await returnType.update({
            name,
            code,
            description,
            isActive,
            isRefundable,
            isReplaceable,
            priority,
            updatedBy: currentUserId
        });

        res.json(returnType);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Delete a return type
exports.deleteReturnType = async (req, res) => {
    try {
        const returnType = await ReturnType.findByPk(req.params.id);
        if (!returnType) {
            return res.status(404).json({ error: 'Return type not found' });
        }

        await returnType.destroy();
        res.json({ message: 'Return type deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get active return types (for dropdowns)
exports.getActiveReturnTypes = async (req, res) => {
    try {
        const returnTypes = await ReturnType.findAll({
            where: { isActive: true },
            attributes: ['id', 'name', 'code', 'isRefundable', 'isReplaceable', 'priority'],
            order: [['priority', 'DESC'], ['name', 'ASC']]
        });

        res.json(returnTypes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};