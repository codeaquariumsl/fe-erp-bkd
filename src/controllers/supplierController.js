const { Supplier, User, LedgerAccount, AccountType, AccountCategory, ControlAccount, sequelize } = require('../models');
const { Op } = require('sequelize');

// Create a new supplier
exports.createSupplier = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const data = req.body;
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        // 1. Find the Supplier Control Account
        const controlAccount = await ControlAccount.findOne({
            where: { controlType: 'SUPPLIER', status: 'Active' }
        });

        let ledgerAccountId = null;

        if (controlAccount) {
            // 2. Generate Next Ledger Code
            const prefixCode = controlAccount.code;
            const lastAccount = await LedgerAccount.findOne({
                where: {
                    controlAccountId: controlAccount.id,
                    ledgerCode: { [Op.like]: `${prefixCode}%` }
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
            const ledgerCode = `${prefixCode}${String(nextNumber).padStart(3, '0')}`;

            // 3. Create Ledger Account
            const ledgerAccount = await LedgerAccount.create({
                ledgerCode,
                name: `Supplier - ${data.name}`,
                description: `Auto-generated ledger for supplier ${data.name}`,
                accountTypeId: controlAccount.accountTypeId,
                accountCategoryId: controlAccount.accountCategoryId,
                isUseControlAccount: true,
                controlAccountId: controlAccount.id,
                ledgerType: 'GENERAL',
                createdBy: currentUserId
            }, { transaction: t });

            ledgerAccountId = ledgerAccount.id;
        }

        // 4. Create Supplier
        const supplier = await Supplier.create({
            ...data,
            ledgerAccountId,
            createdBy: currentUserId,
            updatedBy: currentUserId
        }, { transaction: t });

        await t.commit();

        // Fetch supplier with ledger account for response
        const newSupplier = await Supplier.findByPk(supplier.id, {
            include: [{ model: LedgerAccount, as: 'LedgerAccount' }]
        });

        res.status(201).json(newSupplier);
    } catch (error) {
        if (t) await t.rollback();
        console.error('Create supplier error:', error);
        res.status(400).json({ error: error.message });
    }
};

// Get all suppliers
exports.getSuppliers = async (req, res) => {
    try {
        const suppliers = await Supplier.findAll({
            where: { status: 'active' },
            include: [
                {
                    model: User,
                    as: 'createdByUser',
                    attributes: ['id', 'username']
                },
                {
                    model: User,
                    as: 'updatedByUser',
                    attributes: ['id', 'username']
                },
                {
                    model: LedgerAccount,
                    as: 'LedgerAccount',
                    attributes: ['id', 'ledgerCode', 'name']
                }
            ]
        });
        const suppliersWithUsernames = suppliers.map(supplier => {
            const supplierObj = supplier.toJSON();
            supplierObj.createdByUsername = supplierObj.createdByUser ? supplierObj.createdByUser.username : null;
            supplierObj.updatedByUsername = supplierObj.updatedByUser ? supplierObj.updatedByUser.username : null;
            delete supplierObj.createdByUser;
            delete supplierObj.updatedByUser;
            return supplierObj;
        });
        res.json(suppliersWithUsernames);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get all expense suppliers
exports.getExpenseSuppliers = async (req, res) => {
    try {
        const suppliers = await Supplier.findAll({
            where: { status: 'active', ledgerType: 'Expense' },
            include: [
                {
                    model: User,
                    as: 'createdByUser',
                    attributes: ['id', 'username']
                },
                {
                    model: User,
                    as: 'updatedByUser',
                    attributes: ['id', 'username']
                },
                {
                    model: LedgerAccount,
                    as: 'LedgerAccount',
                    attributes: ['id', 'ledgerCode', 'name']
                }
            ]
        });
        const suppliersWithUsernames = suppliers.map(supplier => {
            const supplierObj = supplier.toJSON();
            supplierObj.createdByUsername = supplierObj.createdByUser ? supplierObj.createdByUser.username : null;
            supplierObj.updatedByUsername = supplierObj.updatedByUser ? supplierObj.updatedByUser.username : null;
            delete supplierObj.createdByUser;
            delete supplierObj.updatedByUser;
            return supplierObj;
        });
        res.json(suppliersWithUsernames);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get a single supplier by ID
exports.getSupplierById = async (req, res) => {
    try {
        const supplier = await Supplier.findByPk(req.params.id, {
            include: [
                {
                    model: User,
                    as: 'createdByUser',
                    attributes: ['id', 'username']
                },
                {
                    model: User,
                    as: 'updatedByUser',
                    attributes: ['id', 'username']
                },
                {
                    model: LedgerAccount,
                    as: 'LedgerAccount',
                    attributes: ['id', 'ledgerCode', 'name']
                }
            ]
        });
        if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
        const supplierObj = supplier.toJSON();
        supplierObj.createdByUsername = supplierObj.createdByUser ? supplierObj.createdByUser.username : null;
        supplierObj.updatedByUsername = supplierObj.updatedByUser ? supplierObj.updatedByUser.username : null;
        delete supplierObj.createdByUser;
        delete supplierObj.updatedByUser;
        res.json(supplierObj);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update a supplier
exports.updateSupplier = async (req, res) => {
    try {
        const data = req.body;
        const supplier = await Supplier.findByPk(req.params.id);
        if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }
        await supplier.update({ ...data, updatedBy: currentUserId });
        res.json(supplier);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Delete a supplier
exports.deleteSupplier = async (req, res) => {
    try {
        const supplier = await Supplier.findByPk(req.params.id);
        if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
        await supplier.destroy();
        res.json({ message: 'Supplier deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
