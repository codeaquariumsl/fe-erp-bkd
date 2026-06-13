
const GRN = require('../models/grn');
const GRNItem = require('../models/grnItem');
const Supplier = require('../models/supplier');
const Store = require('../models/store');
const Item = require('../models/item');
const Stock = require('../models/stock');
const StockDetail = require('../models/stockDetail');
const { sequelize } = require('../models');
const User = require('../models/user');
const { generateDocumentNumber } = require('./documentControllerClient');
const app = require('../app');
const PurchaseOrder = require('../models/purchaseOrder');
const {
    calculateEffectiveAvailableQty,
    getEffectiveAvailableQtyCondition,
    reserveGrnItemQty,
    releaseGrnItemQty
} = require('../utils/grnReservationHelper');
const PalletRack = require('../models/palletRack');
const { Op } = require('sequelize');
const { LedgerAccount, TransactionHeader } = require('../models');
const TransactionService = require('../utils/transactionService');

// Helper to add usernames to GRN
async function addGRNUsernames(grn) {
    if (!grn) return grn;
    const userIds = [grn.createdBy, grn.updatedBy, grn.approvedBy, grn.qcCheckedBy].filter(Boolean);
    const users = userIds.length ? await User.findAll({ where: { id: userIds } }) : [];
    const userMap = {};
    users.forEach(u => { userMap[u.id] = u.username; });
    grn = grn.toJSON ? grn.toJSON() : grn;
    grn.createdUserName = userMap[grn.createdBy] || null;
    grn.updatedUserName = userMap[grn.updatedBy] || null;
    grn.approvedUserName = userMap[grn.approvedBy] || null;
    grn.qcCheckedUserName = userMap[grn.qcCheckedBy] || null;
    return grn;
}

// Create a new GRN with items
exports.createGRN = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        // Generate GRN number  
        const { supplierId, storeId, grnDate, purchaseOrderId, totalAmount, items, locationId } = req.body;
        const grnNumber = await generateDocumentNumber('GRN', locationId);
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }
        // Check supplier and store
        const supplier = await Supplier.findByPk(supplierId, { transaction: t });
        const store = await Store.findByPk(storeId, { transaction: t });
        if (!supplier || !store) {
            await t.rollback();
            return res.status(400).json({ error: 'Supplier or Store not found' });
        }
        // Create GRN
        const grn = await GRN.create({
            grnNumber,
            supplierId,
            storeId,
            grnDate,
            purchaseOrderId,
            totalAmount,
            status: 'Pending',
            locationId,
            createdBy: currentUserId, updatedBy: currentUserId
        }, { transaction: t });
        // Add items
        if (Array.isArray(items)) {
            for (const item of items) {
                const itemExists = await Item.findByPk(item.itemId, { transaction: t });
                if (!itemExists) {
                    await t.rollback();
                    return res.status(400).json({ error: `Item not found: ${item.itemId}` });
                }

                // If this GRN is linked to a Purchase Order, update the PO item's availableQty
                if (purchaseOrderId) {
                    const PurchaseOrderItem = require('../models/purchaseOrderItem');
                    const poItem = await PurchaseOrderItem.findOne({
                        where: {
                            purchaseOrderId: purchaseOrderId,
                            itemId: item.itemId
                        },
                        transaction: t
                    });

                    if (poItem) {
                        // Check if there's enough available quantity in the PO
                        if (poItem.availableQty < item.grnQty) {
                            await t.rollback();
                            return res.status(400).json({
                                error: `Insufficient available quantity in Purchase Order for item ${item.itemId}. Available: ${poItem.availableQty}, Requested: ${item.grnQty}`
                            });
                        }

                        // Reduce the availableQty in Purchase Order Item
                        await poItem.update({
                            availableQty: poItem.availableQty - item.grnQty,
                            updatedBy: currentUserId
                        }, { transaction: t });
                    } else {
                        await t.rollback();
                        return res.status(400).json({
                            error: `Item ${item.itemId} not found in Purchase Order ${purchaseOrderId}`
                        });
                    }
                }

                const createdGrnItem = await GRNItem.create({
                    grnId: grn.id,
                    itemId: item.itemId,
                    grnQty: item.grnQty,
                    availableQty: item.availableQty,
                    weight: item.weight,
                    costPrice: item.costPrice,
                    expireDate: item.expireDate != "" ? item.expireDate : null,
                    coldRoomId: item.coldRoomId || null,
                    palletRackId: item.palletRackId || null,
                    createdBy: currentUserId,
                    updatedBy: currentUserId
                }, { transaction: t });

                // Update stock and insert stock detail immediately on creation
                let stock = await Stock.findOne({
                    where: { itemId: item.itemId, storeId: storeId },
                    transaction: t
                });

                if (stock) {
                    await stock.update({
                        availableQty: stock.availableQty + item.grnQty,
                        weight: (stock.weight || 0) + (item.weight || 0),
                        updatedBy: currentUserId
                    }, { transaction: t });
                } else {
                    stock = await Stock.create({
                        itemId: item.itemId,
                        storeId: storeId,
                        locationId: locationId,
                        availableQty: item.grnQty,
                        weight: item.weight,
                        status: 'Active',
                        createdBy: currentUserId,
                        updatedBy: currentUserId
                    }, { transaction: t });
                }

                await StockDetail.create({
                    stockId: stock.id,
                    documentType: 'GRN',
                    documentId: grn.id,
                    inOut: 'IN',
                    qty: item.grnQty,
                    weight: item.weight,
                    date: new Date(),
                    remark: 'GRN Created - Stock Updated',
                    createdBy: currentUserId,
                    updatedBy: currentUserId
                }, { transaction: t });

                if (item.palletRackId) {
                    let rack = await PalletRack.findOne({ where: { id: item.palletRackId }, transaction: t });
                    if (rack) {
                        await rack.update({
                            availableQty: rack.availableQty + item.grnQty,
                            weight: (rack.weight || 0) + (item.weight || 0),
                            updatedBy: currentUserId
                        }, { transaction: t });
                    }
                }
            }
        }
        await t.commit();

        const result = await GRN.findByPk(grn.id, {
            include: [
                { model: Supplier },
                { model: Store },
                { model: PurchaseOrder, attributes: ['id', 'orderNumber'] },
                {
                    model: GRNItem, include: [
                        Item,
                        { model: require('../models/coldRoom'), as: 'ColdRoom', attributes: ['id', 'name'] },
                        { model: require('../models/palletRack'), as: 'PalletRack', attributes: ['id', 'code'] }
                    ]
                }
            ]
        });
        // Add coldRoomName and rackCode to each GRNItem in the response
        if (result && result.GRNItems) {
            result.GRNItems = result.GRNItems.map(item => ({
                ...item.toJSON(),
                coldRoomName: item.ColdRoom ? item.ColdRoom.name : null,
                rackCode: item.PalletRack ? item.PalletRack.code : null
            }));
        }
        res.status(201).json(result);
        return; // Prevents further code execution
    } catch (error) {
        if (t.finished !== 'commit' && t.finished !== 'rollback') {
            await t.rollback();
        }
        res.status(400).json({ error: error.message });
    }
};

// Approve or reject a GRN
exports.approveOrRejectGRN = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { status, locationId } = req.body; // status: 'Approved' or 'Rejected'
        if (!['Approved', 'Rejected'].includes(status)) {
            await t.rollback();
            return res.status(400).json({ error: 'Invalid status. Must be Approved or Rejected.' });
        }
        const grn = await GRN.findByPk(req.params.id, { include: [GRNItem], transaction: t });
        if (!grn) {
            await t.rollback();
            return res.status(404).json({ error: 'GRN not found' });
        }
        // Get current user ID for audit fields
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }
        await grn.update({ status, approvedBy: currentUserId, approvedAt: new Date() }, { transaction: t });
        if (status === 'Approved') {
            // Stock update logic moved to createGRN as per user request
            // approveOrRejectGRN now focuses on transaction logging (accounting)
            // insert transaction header and transaction details logic is handled after commit
        }
        await t.commit();

        if (status === 'Approved') {
            try {
                // Re-fetch GRN with Supplier to ensure we have the latest data including ledgerAccountId
                const approvedGrn = await GRN.findByPk(grn.id, {
                    include: [{ model: Supplier }]
                });

                const amount = parseFloat(approvedGrn.totalAmount) || 0;
                if (amount > 0) {
                    // Find appropriate ledger accounts
                    // 1. Debit Account: Purchase (Prioritize 'Purchase', fallback to others)
                    let debitAccount = await LedgerAccount.findOne({
                        where: {
                            [Op.or]: [
                                { name: { [Op.like]: '%Purchase%' } },
                                { ledgerCode: { [Op.like]: '%PURCHASE%' } },
                            ]
                        }
                    });

                    // 2. Credit Account: Supplier's Ledger Account
                    let creditAccountId = approvedGrn.Supplier ? approvedGrn.Supplier.ledgerAccountId : null;
                    let creditAccountName = approvedGrn.Supplier ? approvedGrn.Supplier.name : 'Unknown Supplier';

                    if (!creditAccountId) {
                        // Fallback if supplier has no specific ledger account assigned
                        console.warn(`Supplier ${creditAccountName} (ID: ${approvedGrn.supplierId}) has no ledgerAccountId. Using generic Accounts Payable.`);
                        let apAccount = await LedgerAccount.findOne({
                            where: {
                                [Op.or]: [
                                    { name: { [Op.like]: '%Accounts Payable%' } },
                                    { name: { [Op.like]: '%Creditor%' } },
                                    { name: { [Op.like]: '%Supplier%' } },
                                    { ledgerCode: { [Op.like]: '%AP%' } }
                                ]
                            }
                        });
                        if (apAccount) creditAccountId = apAccount.id;
                    }

                    if (debitAccount && creditAccountId) {
                        const transactionDetails = [
                            {
                                ledgerAccountId: debitAccount.id,
                                debitAmount: amount, // Expense/Asset increase -> Debit
                                creditAmount: 0,
                                description: `GRN Approval - ${approvedGrn.grnNumber} - Purchase`,
                                lineNumber: 1
                            },
                            {
                                ledgerAccountId: creditAccountId,
                                debitAmount: 0,
                                creditAmount: amount, // Liability increase -> Credit
                                description: `GRN Approval - ${approvedGrn.grnNumber} - Supplier: ${creditAccountName}`,
                                lineNumber: 2
                            }
                        ];

                        await TransactionService.logGRNTransaction(
                            approvedGrn,
                            transactionDetails,
                            currentUserId
                        );
                        console.log(`Transaction logged for GRN approval: ${approvedGrn.grnNumber}`);
                    } else {
                        console.warn('Could not find appropriate ledger accounts for GRN transaction. Debit:', debitAccount?.id, 'Credit:', creditAccountId);
                    }
                }
            } catch (logError) {
                console.error('Warning: Failed to log GRN transaction:', logError.message);
            }
        }
        res.json({ message: `GRN ${status.toLowerCase()}`, grn });
    } catch (error) {
        await t.rollback();
        res.status(400).json({ error: error.message });
    }
};

// List all GRNs
exports.getAllGRNs = async (req, res) => {
    try {
        const grns = await GRN.findAll({
            where: { locationId: req.query.locationId || { [Op.ne]: null } },
            include: [
                { model: Supplier },
                { model: Store },
                {
                    model: PurchaseOrder,
                    attributes: ['id', 'orderNumber', 'orderDate', 'totalAmount', 'status'],
                    include: [
                        {
                            model: require('../models/purchaseOrderItem'),
                            as: 'PurchaseOrderItems',
                            include: [
                                {
                                    model: Item,
                                    attributes: ['id', 'name', 'sku', 'unit']
                                }
                            ]
                        }
                    ]
                },
                {
                    model: GRNItem, include: [
                        Item,
                        { model: require('../models/coldRoom'), as: 'ColdRoom', attributes: ['id', 'name'] },
                        { model: require('../models/palletRack'), as: 'PalletRack', attributes: ['id', 'code'] }
                    ]
                }
            ],
            order: [['createdAt', 'DESC']]
        });
        // Add coldRoomName and rackCode to each GRNItem in the response
        const withNames = await Promise.all(grns.map(async grn => {
            grn = grn.toJSON ? grn.toJSON() : grn;
            if (grn.GRNItems) {
                grn.GRNItems = grn.GRNItems.map(item => ({
                    ...item,
                    coldRoomName: item.ColdRoom ? item.ColdRoom.name : null,
                    rackCode: item.PalletRack ? item.PalletRack.code : null
                }));
            }
            return addGRNUsernames(grn);
        }));
        res.json(withNames);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get a single GRN by ID
exports.getGRNById = async (req, res) => {
    try {
        const grn = await GRN.findByPk(req.params.id, {
            include: [
                { model: Supplier },
                { model: Store },
                {
                    model: PurchaseOrder,
                    attributes: ['id', 'orderNumber', 'orderDate', 'totalAmount', 'status'],
                    include: [
                        {
                            model: require('../models/purchaseOrderItem'),
                            as: 'PurchaseOrderItems',
                            include: [
                                {
                                    model: Item,
                                    attributes: ['id', 'name', 'sku', 'unit']
                                }
                            ]
                        }
                    ]
                },
                {
                    model: GRNItem, include: [
                        Item,
                        { model: require('../models/coldRoom'), as: 'ColdRoom', attributes: ['id', 'name'] },
                        { model: require('../models/palletRack'), as: 'PalletRack', attributes: ['id', 'code'] }
                    ]
                }
            ]
        });
        if (!grn) return res.status(404).json({ error: 'GRN not found' });
        let grnObj = grn.toJSON ? grn.toJSON() : grn;
        if (grnObj.GRNItems) {
            grnObj.GRNItems = grnObj.GRNItems.map(item => ({
                ...item,
                coldRoomName: item.ColdRoom ? item.ColdRoom.name : null,
                rackCode: item.PalletRack ? item.PalletRack.code : null
            }));
        }
        const withNames = await addGRNUsernames(grnObj);
        res.json(withNames);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update a GRN (only if Pending)
exports.updateGRN = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const grn = await GRN.findByPk(req.params.id, { transaction: t });
        if (!grn) {
            await t.rollback();
            return res.status(404).json({ error: 'GRN not found' });
        }
        if (grn.status !== 'Pending') {
            await t.rollback();
            return res.status(400).json({ error: 'Only Pending GRN can be updated' });
        }
        const { grnNumber, supplierId, storeId, grnDate, items } = req.body;
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }
        await grn.update({ grnNumber, supplierId, storeId, grnDate, updatedBy: currentUserId }, { transaction: t });
        if (Array.isArray(items)) {
            // If this GRN is linked to a Purchase Order, we need to restore the old quantities first
            if (grn.purchaseOrderId) {
                const PurchaseOrderItem = require('../models/purchaseOrderItem');
                const existingGrnItems = await GRNItem.findAll({
                    where: { grnId: grn.id },
                    transaction: t
                });

                // Restore the availableQty for existing items
                for (const existingItem of existingGrnItems) {
                    const poItem = await PurchaseOrderItem.findOne({
                        where: {
                            purchaseOrderId: grn.purchaseOrderId,
                            itemId: existingItem.itemId
                        },
                        transaction: t
                    });

                    if (poItem) {
                        // Restore the quantity that was previously deducted
                        await poItem.update({
                            availableQty: poItem.availableQty + existingItem.grnQty,
                            updatedBy: currentUserId
                        }, { transaction: t });
                    }
                }
            }

            await GRNItem.destroy({ where: { grnId: grn.id }, transaction: t });

            for (const item of items) {
                // If this GRN is linked to a Purchase Order, update the PO item's availableQty
                if (grn.purchaseOrderId) {
                    const PurchaseOrderItem = require('../models/purchaseOrderItem');
                    const poItem = await PurchaseOrderItem.findOne({
                        where: {
                            purchaseOrderId: grn.purchaseOrderId,
                            itemId: item.itemId
                        },
                        transaction: t
                    });

                    if (poItem) {
                        // Check if there's enough available quantity in the PO
                        if (poItem.availableQty < item.grnQty) {
                            await t.rollback();
                            return res.status(400).json({
                                error: `Insufficient available quantity in Purchase Order for item ${item.itemId}. Available: ${poItem.availableQty}, Requested: ${item.grnQty}`
                            });
                        }

                        // Reduce the availableQty in Purchase Order Item
                        await poItem.update({
                            availableQty: poItem.availableQty - item.grnQty,
                            updatedBy: currentUserId
                        }, { transaction: t });
                    } else {
                        await t.rollback();
                        return res.status(400).json({
                            error: `Item ${item.itemId} not found in Purchase Order ${grn.purchaseOrderId}`
                        });
                    }
                }

                await GRNItem.create({
                    grnId: grn.id,
                    itemId: item.itemId,
                    grnQty: item.grnQty,
                    availableQty: item.availableQty,
                    weight: item.weight,
                    costPrice: item.costPrice,
                    expireDate: item.expireDate != "" ? item.expireDate : null,
                    coldRoomId: item.coldRoomId || null,
                    palletRackId: item.palletRackId || null,
                    createdBy: currentUserId
                }, { transaction: t });
            }
        }
        await t.commit();
        const updated = await GRN.findByPk(grn.id, {
            include: [
                { model: Supplier },
                { model: Store },
                {
                    model: GRNItem, include: [
                        Item,
                        { model: require('../models/coldRoom'), as: 'ColdRoom', attributes: ['id', 'name'] },
                        { model: require('../models/palletRack'), as: 'PalletRack', attributes: ['id', 'code'] }
                    ]
                }
            ]
        });
        // Add coldRoomName and rackCode to each GRNItem in the response
        if (updated && updated.GRNItems) {
            updated.GRNItems = updated.GRNItems.map(item => ({
                ...item.toJSON(),
                coldRoomName: item.ColdRoom ? item.ColdRoom.name : null,
                rackCode: item.PalletRack ? item.PalletRack.code : null
            }));
        }
        res.json(updated);
    } catch (error) {
        await t.rollback();
        res.status(400).json({ error: error.message });
    }
};

// Delete a GRN (only if Pending)
exports.deleteGRN = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const grn = await GRN.findByPk(req.params.id, { transaction: t });
        if (!grn) {
            await t.rollback();
            return res.status(404).json({ error: 'GRN not found' });
        }
        if (grn.status !== 'Pending') {
            await t.rollback();
            return res.status(400).json({ error: 'Only Pending GRN can be deleted' });
        }

        // If this GRN is linked to a Purchase Order, restore the availableQty
        if (grn.purchaseOrderId) {
            const PurchaseOrderItem = require('../models/purchaseOrderItem');
            const grnItems = await GRNItem.findAll({
                where: { grnId: grn.id },
                transaction: t
            });

            // Restore the availableQty for all items
            for (const grnItem of grnItems) {
                const poItem = await PurchaseOrderItem.findOne({
                    where: {
                        purchaseOrderId: grn.purchaseOrderId,
                        itemId: grnItem.itemId
                    },
                    transaction: t
                });

                if (poItem) {
                    // Restore the quantity that was previously deducted
                    await poItem.update({
                        availableQty: poItem.availableQty + grnItem.grnQty,
                        updatedBy: req.user?.id || null
                    }, { transaction: t });
                }
            }
        }

        await GRNItem.destroy({ where: { grnId: grn.id }, transaction: t });
        await grn.destroy({ transaction: t });
        await t.commit();
        res.json({ message: 'GRN deleted' });
    } catch (error) {
        await t.rollback();
        res.status(400).json({ error: error.message });
    }
};

// QC check a GRN after approval
exports.qcCheckGRN = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const grnId = req.params.id;
        const { qcStatus, reason } = req.body; // qcStatus is boolean (true = pass, false = fail)

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const grn = await GRN.findByPk(grnId, { transaction: t });
        if (!grn) {
            await t.rollback();
            return res.status(404).json({ error: 'GRN not found' });
        }

        if (grn.status !== 'Approved') {
            await t.rollback();
            return res.status(400).json({ error: 'Only approved GRN can be QC checked' });
        }

        if (qcStatus === false && !reason) {
            await t.rollback();
            return res.status(400).json({ error: 'Reason is required when QC fails' });
        }

        // Update GRN QC fields and status
        await grn.update({
            qcCheckedAt: new Date(),
            qcCheckedBy: currentUserId,
            status: qcStatus ? 'QC Checked' : 'QC Failed',
            remarks: qcStatus ? null : reason // Store reason only if QC failed
        }, { transaction: t });
        await t.commit();

        const updated = await GRN.findByPk(grn.id, {
            include: [
                { model: Supplier },
                { model: Store },
                {
                    model: GRNItem,
                    include: [Item]
                }
            ]
        });

        res.json({
            message: `QC ${qcStatus ? 'passed' : 'failed'}`,
            grn: updated,
            qcStatus,
            reason: qcStatus ? null : reason,
            qcCheckedAt: grn.qcCheckedAt
        });
    } catch (error) {
        await t.rollback();
        res.status(400).json({ error: error.message });
    }
};

// Get GRN list and available qty for a selected item
exports.getItemGRNAvailability = async (req, res) => {
    try {

        // Find all GRNItems with (availableQty - reservedQty) > 0 and include GRN and Item
        const grnItems = await GRNItem.findAll({
            where: getEffectiveAvailableQtyCondition(),
            include: [
                {
                    model: GRN,
                    attributes: ['id', 'grnNumber', 'status'],
                    where: { status: 'QC Checked' } // Only include QC Checked GRNs
                },
                { model: Item, attributes: ['id', 'name', 'color', 'country'] }
            ]
        });

        // Group by itemId first, then by grnId to merge multiple records for same GRN
        const grouped = {};
        grnItems.forEach(grnItem => {
            const itemId = grnItem.itemId;
            const grnId = grnItem.GRN ? grnItem.GRN.id : grnItem.grnId;

            if (!grouped[itemId]) {
                grouped[itemId] = {
                    item: grnItem.Item ? {
                        id: grnItem.Item.id,
                        name: grnItem.Item.name,
                        color: grnItem.Item.color,
                        country: grnItem.Item.country
                    } : { id: itemId },
                    grns: {}
                };
            }

            // If this GRN already exists for this item, sum the available quantities
            if (grouped[itemId].grns[grnId]) {
                grouped[itemId].grns[grnId].availableQty += calculateEffectiveAvailableQty(grnItem);
            } else {
                grouped[itemId].grns[grnId] = {
                    grnId: grnId,
                    grnNumber: grnItem.GRN ? grnItem.GRN.grnNumber : undefined,
                    grnStatus: grnItem.GRN ? grnItem.GRN.status : undefined,
                    availableQty: calculateEffectiveAvailableQty(grnItem),
                };
            }
        });

        // Convert grns object to array for each item
        const result = Object.values(grouped).map(itemGroup => ({
            item: itemGroup.item,
            grns: Object.values(itemGroup.grns)
        }));

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Reserve GRN Item Quantity
exports.reserveGrnItemQuantity = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { grnItemId, reserveQty, reason, reservedBy } = req.body;

        if (!grnItemId || !reserveQty || reserveQty <= 0) {
            await t.rollback();
            return res.status(400).json({ error: 'grnItemId and valid reserveQty are required' });
        }

        const grnItem = await GRNItem.findByPk(grnItemId, { transaction: t });
        if (!grnItem) {
            await t.rollback();
            return res.status(404).json({ error: 'GRN Item not found' });
        }

        // Reserve the quantity
        await reserveGrnItemQty(grnItem, reserveQty, t);

        await t.commit();

        res.json({
            message: `Successfully reserved ${reserveQty} units from GRN Item ${grnItemId}`,
            grnItemId: grnItemId,
            reservedQty: reserveQty,
            newReservedTotal: (grnItem.reservedQty || 0) + reserveQty,
            effectiveAvailable: grnItem.availableQty - ((grnItem.reservedQty || 0) + reserveQty),
            reason: reason || 'Manual reservation',
            reservedBy: reservedBy || 'system'
        });
    } catch (error) {
        await t.rollback();
        res.status(400).json({ error: error.message });
    }
};

// Release GRN Item Quantity
exports.releaseGrnItemQuantity = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { grnItemId, releaseQty, reason, releasedBy } = req.body;

        if (!grnItemId || !releaseQty || releaseQty <= 0) {
            await t.rollback();
            return res.status(400).json({ error: 'grnItemId and valid releaseQty are required' });
        }

        const grnItem = await GRNItem.findByPk(grnItemId, { transaction: t });
        if (!grnItem) {
            await t.rollback();
            return res.status(404).json({ error: 'GRN Item not found' });
        }

        // Release the quantity
        await releaseGrnItemQty(grnItem, releaseQty, t);

        await t.commit();

        res.json({
            message: `Successfully released ${releaseQty} units from GRN Item ${grnItemId}`,
            grnItemId: grnItemId,
            releasedQty: releaseQty,
            newReservedTotal: Math.max(0, (grnItem.reservedQty || 0) - releaseQty),
            effectiveAvailable: grnItem.availableQty - Math.max(0, (grnItem.reservedQty || 0) - releaseQty),
            reason: reason || 'Manual release',
            releasedBy: releasedBy || 'system'
        });
    } catch (error) {
        await t.rollback();
        res.status(400).json({ error: error.message });
    }
};
// Sync existing Approved GRNs to transactions
exports.syncApprovedGRNTransactions = async (req, res) => {
    try {
        const approvedGRNs = await GRN.findAll({
            where: { status: 'Approved' },
            include: [{ model: Supplier }]
        });

        let successCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const grn of approvedGRNs) {
            // Check if transaction exists
            const existingTxn = await TransactionHeader.findOne({
                where: {
                    transactionModule: 'GRN',
                    referenceId: grn.id
                }
            });

            if (existingTxn) {
                skippedCount++;
                continue;
            }

            try {
                const amount = parseFloat(grn.totalAmount) || 0;
                if (amount <= 0) {
                    skippedCount++;
                    continue;
                }

                // 1. Debit Account: Purchase
                let debitAccount = await LedgerAccount.findOne({
                    where: {
                        [Op.or]: [
                            { name: { [Op.like]: '%Purchase%' } },
                            { ledgerCode: { [Op.like]: '%PURCHASE%' } },
                        ]
                    }
                });

                // 2. Credit Account: Supplier's Ledger Account
                let creditAccountId = grn.Supplier ? grn.Supplier.ledgerAccountId : null;
                let creditAccountName = grn.Supplier ? grn.Supplier.name : 'Unknown Supplier';

                if (!creditAccountId) {
                    // Fallback
                    let apAccount = await LedgerAccount.findOne({
                        where: {
                            [Op.or]: [
                                { name: { [Op.like]: '%Accounts Payable%' } },
                                { name: { [Op.like]: '%Creditor%' } },
                                { name: { [Op.like]: '%Supplier%' } },
                                { ledgerCode: { [Op.like]: '%AP%' } }
                            ]
                        }
                    });
                    if (apAccount) creditAccountId = apAccount.id;
                }

                if (!debitAccount || !creditAccountId) {
                    errorCount++;
                    errors.push({ grn: grn.grnNumber, error: 'Appropriate ledger accounts not found' });
                    continue;
                }

                const transactionDetails = [
                    {
                        ledgerAccountId: debitAccount.id,
                        debitAmount: amount, // Expense/Asset increase -> Debit
                        creditAmount: 0,
                        description: `GRN Approval - ${grn.grnNumber} - Purchase`,
                        lineNumber: 1
                    },
                    {
                        ledgerAccountId: creditAccountId,
                        debitAmount: 0,
                        creditAmount: amount, // Liability increase -> Credit
                        description: `GRN Approval - ${grn.grnNumber} - Supplier: ${creditAccountName}`,
                        lineNumber: 2
                    }
                ];

                const userId = (req.user && req.user.id) || 1; // Default to system/admin if no user context

                await TransactionService.logGRNTransaction(
                    grn,
                    transactionDetails,
                    userId
                );
                successCount++;
            } catch (err) {
                errorCount++;
                errors.push({ grn: grn.grnNumber, error: err.message });
                console.error(`Failed to sync GRN ${grn.grnNumber}:`, err.message);
            }
        }

        res.json({
            message: 'Sync completed',
            total: approvedGRNs.length,
            synced: successCount,
            skipped: skippedCount,
            errors: errorCount,
            errorDetails: errors
        });
    } catch (error) {
        console.error('Error in syncApprovedGRNTransactions:', error);
        res.status(500).json({ error: error.message });
    }
};
