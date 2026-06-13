const { Op } = require('sequelize');
const Unit = require('../models/unit');
const User = require('../models/user');
const { generateDocumentNumber } = require('./documentControllerClient');

// Create a new unit
exports.createUnit = async (req, res) => {
    try {
        const {
            name,
            symbol,
            description,
            unitType,
            baseUnit,
            conversionFactor,
            isActive,
            isDecimalAllowed,
            locationId
        } = req.body;
        const code = await generateDocumentNumber('UNIT', locationId);

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const unit = await Unit.create({
            name,
            code,
            symbol,
            description,
            unitType: unitType || 'COUNT',
            baseUnit,
            conversionFactor: conversionFactor || 1.0,
            isActive: isActive !== undefined ? isActive : true,
            isDecimalAllowed: isDecimalAllowed !== undefined ? isDecimalAllowed : true,
            createdBy: currentUserId,
            updatedBy: currentUserId
        });

        res.status(201).json(unit);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get all units with creator/updater usernames
exports.getUnits = async (req, res) => {
    try {
        const { page = 1, limit = 50, search, isActive, unitType } = req.query;
        const offset = (page - 1) * limit;

        const whereClause = {};
        if (search) {
            whereClause[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
                { code: { [Op.like]: `%${search}%` } },
                { symbol: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } }
            ];
        }
        if (isActive !== undefined) {
            whereClause.isActive = isActive === 'true';
        }
        if (unitType) {
            whereClause.unitType = unitType;
        }

        const { count, rows: units } = await Unit.findAndCountAll({
            where: whereClause,
            include: [
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] }
            ],
            order: [['unitType', 'ASC'], ['name', 'ASC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        // Format response to include creator/updater usernames
        const result = units.map(unit => {
            const obj = unit.toJSON();
            obj.createdByUsername = obj.Creator ? obj.Creator.username : null;
            obj.updatedByUsername = obj.Updater ? obj.Updater.username : null;
            delete obj.Creator;
            delete obj.Updater;
            return obj;
        });

        res.json({
            units: result,
            totalCount: count,
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / limit)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get a single unit by ID with creator/updater usernames
exports.getUnitById = async (req, res) => {
    try {
        const unit = await Unit.findByPk(req.params.id, {
            include: [
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] }
            ]
        });

        if (!unit) {
            return res.status(404).json({ error: 'Unit not found' });
        }

        const obj = unit.toJSON();
        obj.createdByUsername = obj.Creator ? obj.Creator.username : null;
        obj.updatedByUsername = obj.Updater ? obj.Updater.username : null;
        delete obj.Creator;
        delete obj.Updater;

        res.json(obj);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update a unit
exports.updateUnit = async (req, res) => {
    try {
        const {
            name,
            code,
            symbol,
            description,
            unitType,
            baseUnit,
            conversionFactor,
            isActive,
            isDecimalAllowed
        } = req.body;

        const unit = await Unit.findByPk(req.params.id);
        if (!unit) {
            return res.status(404).json({ error: 'Unit not found' });
        }

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        await unit.update({
            name,
            code,
            symbol,
            description,
            unitType,
            baseUnit,
            conversionFactor,
            isActive,
            isDecimalAllowed,
            updatedBy: currentUserId
        });

        res.json(unit);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Delete a unit
exports.deleteUnit = async (req, res) => {
    try {
        const unit = await Unit.findByPk(req.params.id);
        if (!unit) {
            return res.status(404).json({ error: 'Unit not found' });
        }

        await unit.destroy();
        res.json({ message: 'Unit deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get active units (for dropdowns)
exports.getActiveUnits = async (req, res) => {
    try {
        const { unitType } = req.query;
        const whereClause = { isActive: true };

        if (unitType) {
            whereClause.unitType = unitType;
        }

        const units = await Unit.findAll({
            where: whereClause,
            attributes: ['id', 'name', 'code', 'symbol', 'unitType', 'isDecimalAllowed'],
            order: [['unitType', 'ASC'], ['name', 'ASC']]
        });

        res.json(units);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get unit types enum values
exports.getUnitTypes = async (req, res) => {
    try {
        const unitTypes = [
            { value: 'WEIGHT', label: 'Weight' },
            { value: 'VOLUME', label: 'Volume' },
            { value: 'LENGTH', label: 'Length' },
            { value: 'AREA', label: 'Area' },
            { value: 'COUNT', label: 'Count' },
            { value: 'TIME', label: 'Time' },
            { value: 'OTHER', label: 'Other' }
        ];

        res.json(unitTypes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Convert between units (if conversion factor is available)
exports.convertUnits = async (req, res) => {
    try {
        const { fromUnitId, toUnitId, value } = req.body;

        if (!fromUnitId || !toUnitId || !value) {
            return res.status(400).json({ error: 'fromUnitId, toUnitId, and value are required' });
        }

        const fromUnit = await Unit.findByPk(fromUnitId);
        const toUnit = await Unit.findByPk(toUnitId);

        if (!fromUnit || !toUnit) {
            return res.status(404).json({ error: 'One or both units not found' });
        }

        // Simple conversion logic - can be enhanced based on business needs
        if (fromUnit.baseUnit && toUnit.baseUnit && fromUnit.baseUnit === toUnit.baseUnit) {
            const baseValue = value * fromUnit.conversionFactor;
            const convertedValue = baseValue / toUnit.conversionFactor;

            res.json({
                fromUnit: {
                    id: fromUnit.id,
                    name: fromUnit.name,
                    symbol: fromUnit.symbol
                },
                toUnit: {
                    id: toUnit.id,
                    name: toUnit.name,
                    symbol: toUnit.symbol
                },
                originalValue: value,
                convertedValue: convertedValue,
                formula: `${value} ${fromUnit.symbol} × ${fromUnit.conversionFactor} ÷ ${toUnit.conversionFactor} = ${convertedValue} ${toUnit.symbol}`
            });
        } else {
            res.status(400).json({
                error: 'Units cannot be converted - different base units or no conversion factor available',
                fromUnit: fromUnit.name,
                toUnit: toUnit.name
            });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};