const {
    Stock, StockDetail, Item, Store, BatchItem, sequelize, Vehicle, Batch, Location, User,
    StockAdjustment, StockAdjustmentItem, StockReconciliation, StockReconciliationItem
} = require('../models');
const { generateDocumentNumber } = require('./documentControllerClient');

// Helper to add usernames to document
async function addNamesToDoc(doc) {
    if (!doc) return doc;
    const userIds = [doc.createdBy, doc.updatedBy, doc.approvedBy].filter(Boolean);
    const users = userIds.length ? await User.findAll({ where: { id: userIds } }) : [];
    const userMap = {};
    users.forEach(u => { userMap[u.id] = u.username; });
    doc = doc.toJSON ? doc.toJSON() : doc;
    doc.createdUserName = userMap[doc.createdBy] || null;
    doc.updatedUserName = userMap[doc.updatedBy] || null;
    doc.approvedUserName = userMap[doc.approvedBy] || null;
    return doc;
}

// Transfer stock between stores
exports.transferStock = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { itemId, fromStoreId, toStoreId, qty, weight, remark } = req.body;
        if (fromStoreId === toStoreId) return res.status(400).json({ error: 'Source and destination stores must be different.' });
        const fromStock = await Stock.findOne({ where: { itemId, storeId: fromStoreId }, transaction: t });
        if (!fromStock || fromStock.availableQty < qty) {
            await t.rollback();
            return res.status(400).json({ error: 'Insufficient stock in source store.' });
        }
        let toStock = await Stock.findOne({ where: { itemId, storeId: toStoreId }, transaction: t });
        if (!toStock) {
            toStock = await Stock.create({ itemId, storeId: toStoreId, availableQty: 0, weight: 0, status: 'Active' }, { transaction: t });
        }
        await fromStock.update({ availableQty: fromStock.availableQty - qty, weight: (fromStock.weight || 0) - (weight || 0) }, { transaction: t });
        await toStock.update({ availableQty: toStock.availableQty + qty, weight: (toStock.weight || 0) + (weight || 0) }, { transaction: t });
        await StockDetail.create({ stockId: fromStock.id, documentType: 'TRANSFER', documentId: 0, inOut: 'OUT', qty, weight, date: new Date(), remark: remark || 'Stock Transfer OUT' }, { transaction: t });
        await StockDetail.create({ stockId: toStock.id, documentType: 'TRANSFER', documentId: 0, inOut: 'IN', qty, weight, date: new Date(), remark: remark || 'Stock Transfer IN' }, { transaction: t });
        await t.commit();
        res.json({ message: 'Stock transferred successfully.' });
    } catch (error) {
        await t.rollback();
        res.status(400).json({ error: error.message });
    }
};

// --- STOCK ADJUSTMENT ---

exports.createStockAdjustment = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { locationId, storeId, adjustmentDate, reason, notes, items } = req.body;
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) throw new Error('Unauthorized: missing user context');

        const adjustmentNumber = await generateDocumentNumber('SADJ', locationId);

        const adjustment = await StockAdjustment.create({
            adjustmentNumber, locationId, storeId, adjustmentDate, reason, notes,
            status: 'Pending', createdBy: currentUserId, updatedBy: currentUserId
        }, { transaction: t });

        if (Array.isArray(items)) {
            for (const item of items) {
                await StockAdjustmentItem.create({
                    adjustmentId: adjustment.id,
                    itemId: item.itemId,
                    batchId: item.batchId || null,
                    systemQty: item.systemQty || 0,
                    adjustedQty: item.adjustedQty,
                    newQty: (parseFloat(item.systemQty) || 0) + (parseFloat(item.adjustedQty) || 0),
                    remark: item.remark,
                    createdBy: currentUserId,
                    updatedBy: currentUserId
                }, { transaction: t });
            }
        }

        await t.commit();
        res.status(201).json(adjustment);
    } catch (error) {
        if (t && !t.finished) await t.rollback();
        res.status(400).json({ error: error.message });
    }
};

exports.updateStockAdjustment = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const adjustment = await StockAdjustment.findByPk(req.params.id, { transaction: t });
        if (!adjustment) throw new Error('Stock Adjustment not found');
        if (adjustment.status !== 'Pending') throw new Error('Only Pending adjustments can be edited');

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        const { reason, notes, items } = req.body;

        await adjustment.update({ reason, notes, updatedBy: currentUserId }, { transaction: t });

        if (Array.isArray(items)) {
            await StockAdjustmentItem.destroy({ where: { adjustmentId: adjustment.id }, transaction: t });
            for (const item of items) {
                await StockAdjustmentItem.create({
                    adjustmentId: adjustment.id,
                    itemId: item.itemId,
                    batchId: item.batchId || null,
                    systemQty: item.systemQty || 0,
                    adjustedQty: item.adjustedQty,
                    newQty: (parseFloat(item.systemQty) || 0) + (parseFloat(item.adjustedQty) || 0),
                    remark: item.remark,
                    createdBy: currentUserId,
                    updatedBy: currentUserId
                }, { transaction: t });
            }
        }

        await t.commit();
        res.json(adjustment);
    } catch (error) {
        if (t && !t.finished) await t.rollback();
        res.status(400).json({ error: error.message });
    }
};

exports.approveStockAdjustment = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const adjustment = await StockAdjustment.findByPk(req.params.id, {
            include: [{ model: StockAdjustmentItem, as: 'Items' }],
            transaction: t
        });
        if (!adjustment) throw new Error('Stock Adjustment not found');
        if (adjustment.status !== 'Pending') throw new Error('Adjustment is not in Pending status');

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        const { status } = req.body; // 'Approved' or 'Rejected'

        if (status === 'Approved') {
            for (const item of adjustment.Items) {
                // Update Stock
                let stock = await Stock.findOne({
                    where: { itemId: item.itemId, storeId: adjustment.storeId, locationId: adjustment.locationId },
                    transaction: t
                });

                if (!stock) {
                    stock = await Stock.create({
                        itemId: item.itemId, storeId: adjustment.storeId, locationId: adjustment.locationId,
                        availableQty: item.adjustedQty, weight: 0, status: 'Active',
                        createdBy: currentUserId, updatedBy: currentUserId
                    }, { transaction: t });
                } else {
                    await stock.update({
                        availableQty: parseFloat(stock.availableQty) + parseFloat(item.adjustedQty),
                        updatedBy: currentUserId
                    }, { transaction: t });
                }

                // Update BatchItem
                if (item.batchId) {
                    let batchItem = await BatchItem.findOne({
                        where: { batchId: item.batchId, itemId: item.itemId, storeId: adjustment.storeId, locationId: adjustment.locationId },
                        transaction: t
                    });
                    if (batchItem) {
                        await batchItem.update({
                            availableQuantity: parseFloat(batchItem.availableQuantity) + parseFloat(item.adjustedQty),
                            batchQuantity: parseFloat(batchItem.batchQuantity) + parseFloat(item.adjustedQty),
                            updatedBy: currentUserId
                        }, { transaction: t });
                    }
                }

                // Log Detail
                await StockDetail.create({
                    stockId: stock.id,
                    documentType: 'STOCK_ADJUSTMENT',
                    documentId: adjustment.id,
                    inOut: item.adjustedQty >= 0 ? 'IN' : 'OUT',
                    qty: Math.abs(item.adjustedQty),
                    date: new Date(),
                    remark: item.remark || `Adjustment: ${adjustment.adjustmentNumber}`,
                    createdBy: currentUserId,
                    updatedBy: currentUserId
                }, { transaction: t });
            }
        }

        await adjustment.update({
            status,
            approvedBy: currentUserId,
            approvedDate: new Date(),
            updatedBy: currentUserId
        }, { transaction: t });

        await t.commit();
        res.json({ message: `Stock Adjustment ${status} successfully` });
    } catch (error) {
        if (t && !t.finished) await t.rollback();
        res.status(400).json({ error: error.message });
    }
};

exports.getAllStockAdjustments = async (req, res) => {
    try {
        const { locationId, storeId, status } = req.query;
        const where = {};
        if (locationId) where.locationId = locationId;
        if (storeId) where.storeId = storeId;
        if (status) where.status = status;

        const docs = await StockAdjustment.findAll({
            where,
            include: [
                { model: Location, as: 'Location', attributes: ['name'] },
                { model: Store, as: 'Store', attributes: ['name'] },
                {
                    model: StockAdjustmentItem, as: 'Items', include: [
                        { model: Item, as: 'Item' },
                        { model: Batch, as: 'Batch' }
                    ]
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        const result = await Promise.all(docs.map(doc => addNamesToDoc(doc)));
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getStockAdjustmentById = async (req, res) => {
    try {
        const doc = await StockAdjustment.findByPk(req.params.id, {
            include: [
                { model: Location, as: 'Location', attributes: ['name'] },
                { model: Store, as: 'Store', attributes: ['name'] },
                {
                    model: StockAdjustmentItem, as: 'Items', include: [
                        { model: Item, as: 'Item' },
                        { model: Batch, as: 'Batch' }
                    ]
                }
            ]
        });
        if (!doc) return res.status(404).json({ error: 'Stock Adjustment not found' });
        res.json(await addNamesToDoc(doc));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- STOCK RECONCILIATION ---

exports.createStockReconciliation = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { locationId, storeId, reconciliationDate, notes, items } = req.body;
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) throw new Error('Unauthorized: missing user context');

        const reconciliationNumber = await generateDocumentNumber('SREC', locationId);

        const reconciliation = await StockReconciliation.create({
            reconciliationNumber, locationId, storeId, reconciliationDate, notes,
            status: 'Pending', createdBy: currentUserId, updatedBy: currentUserId
        }, { transaction: t });

        if (Array.isArray(items)) {
            for (const item of items) {
                const diffQty = (parseFloat(item.physicalQty) || 0) - (parseFloat(item.systemQty) || 0);
                await StockReconciliationItem.create({
                    reconciliationId: reconciliation.id,
                    itemId: item.itemId,
                    batchId: item.batchId || null,
                    systemQty: item.systemQty || 0,
                    physicalQty: item.physicalQty,
                    diffQty: diffQty,
                    remark: item.remark,
                    createdBy: currentUserId,
                    updatedBy: currentUserId
                }, { transaction: t });
            }
        }

        await t.commit();
        res.status(201).json(reconciliation);
    } catch (error) {
        if (t && !t.finished) await t.rollback();
        res.status(400).json({ error: error.message });
    }
};

exports.updateStockReconciliation = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const reconciliation = await StockReconciliation.findByPk(req.params.id, { transaction: t });
        if (!reconciliation) throw new Error('Stock Reconciliation not found');
        if (reconciliation.status !== 'Pending') throw new Error('Only Pending reconciliations can be edited');

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        const { notes, items } = req.body;

        await reconciliation.update({ notes, updatedBy: currentUserId }, { transaction: t });

        if (Array.isArray(items)) {
            await StockReconciliationItem.destroy({ where: { reconciliationId: reconciliation.id }, transaction: t });
            for (const item of items) {
                const diffQty = (parseFloat(item.physicalQty) || 0) - (parseFloat(item.systemQty) || 0);
                await StockReconciliationItem.create({
                    reconciliationId: reconciliation.id,
                    itemId: item.itemId,
                    batchId: item.batchId || null,
                    systemQty: item.systemQty || 0,
                    physicalQty: item.physicalQty,
                    diffQty: diffQty,
                    remark: item.remark,
                    createdBy: currentUserId,
                    updatedBy: currentUserId
                }, { transaction: t });
            }
        }

        await t.commit();
        res.json(reconciliation);
    } catch (error) {
        if (t && !t.finished) await t.rollback();
        res.status(400).json({ error: error.message });
    }
};

exports.approveStockReconciliation = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const reconciliation = await StockReconciliation.findByPk(req.params.id, {
            include: [{ model: StockReconciliationItem, as: 'Items' }],
            transaction: t
        });
        if (!reconciliation) throw new Error('Stock Reconciliation not found');
        if (reconciliation.status !== 'Pending') throw new Error('Reconciliation is not in Pending status');

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        const { status } = req.body; // 'Approved' or 'Rejected'

        if (status === 'Approved') {
            for (const item of reconciliation.Items) {
                // Update Stock
                let stock = await Stock.findOne({
                    where: { itemId: item.itemId, storeId: reconciliation.storeId, locationId: reconciliation.locationId },
                    transaction: t
                });

                if (!stock) {
                    stock = await Stock.create({
                        itemId: item.itemId, storeId: reconciliation.storeId, locationId: reconciliation.locationId,
                        availableQty: item.physicalQty, weight: 0, status: 'Active',
                        createdBy: currentUserId, updatedBy: currentUserId
                    }, { transaction: t });
                } else {
                    await stock.update({
                        availableQty: item.physicalQty, // Set to physical volume
                        updatedBy: currentUserId
                    }, { transaction: t });
                }

                // Update BatchItem
                if (item.batchId) {
                    let batchItem = await BatchItem.findOne({
                        where: { batchId: item.batchId, itemId: item.itemId, storeId: reconciliation.storeId, locationId: reconciliation.locationId },
                        transaction: t
                    });
                    if (batchItem) {
                        await batchItem.update({
                            availableQuantity: item.physicalQty,
                            batchQuantity: parseFloat(batchItem.batchQuantity) + parseFloat(item.diffQty),
                            updatedBy: currentUserId
                        }, { transaction: t });
                    }
                }

                // Log Detail (only if diff exists)
                if (parseFloat(item.diffQty) !== 0) {
                    await StockDetail.create({
                        stockId: stock.id,
                        documentType: 'STOCK_RECONCILIATION',
                        documentId: reconciliation.id,
                        inOut: item.diffQty > 0 ? 'IN' : 'OUT',
                        qty: Math.abs(item.diffQty),
                        date: new Date(),
                        remark: item.remark || `Reconciliation: ${reconciliation.reconciliationNumber}`,
                        createdBy: currentUserId,
                        updatedBy: currentUserId
                    }, { transaction: t });
                }
            }
        }

        await reconciliation.update({
            status,
            approvedBy: currentUserId,
            approvedDate: new Date(),
            updatedBy: currentUserId
        }, { transaction: t });

        await t.commit();
        res.json({ message: `Stock Reconciliation ${status} successfully` });
    } catch (error) {
        if (t && !t.finished) await t.rollback();
        res.status(400).json({ error: error.message });
    }
};

exports.getAllStockReconciliations = async (req, res) => {
    try {
        const { locationId, storeId, status } = req.query;
        const where = {};
        if (locationId) where.locationId = locationId;
        if (storeId) where.storeId = storeId;
        if (status) where.status = status;

        const docs = await StockReconciliation.findAll({
            where,
            include: [
                { model: Location, as: 'Location', attributes: ['name'] },
                { model: Store, as: 'Store', attributes: ['name'] },
                {
                    model: StockReconciliationItem, as: 'Items', include: [
                        { model: Item, as: 'Item' },
                        { model: Batch, as: 'Batch' }
                    ]
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        const result = await Promise.all(docs.map(doc => addNamesToDoc(doc)));
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getStockReconciliationById = async (req, res) => {
    try {
        const doc = await StockReconciliation.findByPk(req.params.id, {
            include: [
                { model: Location, as: 'Location', attributes: ['name'] },
                { model: Store, as: 'Store', attributes: ['name'] },
                {
                    model: StockReconciliationItem, as: 'Items', include: [
                        { model: Item, as: 'Item' },
                        { model: Batch, as: 'Batch' }
                    ]
                }
            ]
        });
        if (!doc) return res.status(404).json({ error: 'Stock Reconciliation not found' });
        res.json(await addNamesToDoc(doc));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- BASE STOCK METHODS ---

// List all stock, filterable by item or store
exports.getAllStock = async (req, res) => {
    try {
        const { itemId, storeId, locationId } = req.query;
        const where = {};
        if (itemId) where.itemId = itemId;
        if (storeId) where.storeId = storeId;
        if (locationId) where.locationId = locationId;
        const stock = await Stock.findAll({
            where, include: [
                { model: Item }, {
                    model: Store,
                    required: false // Left join since storeId can be null for lorry stock
                },
                {
                    model: Vehicle,
                    as: 'Lorry', // Assuming this association exists
                    required: false // Left join since lorryId can be null for store stock
                }]
        });
        res.json(stock);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get stock for a specific item in all stores
exports.getStockByItem = async (req, res) => {
    try {
        const { itemId } = req.params;
        const stock = await Stock.findAll({ where: { itemId }, include: [Store] });
        res.json(stock);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get stock for all items in a specific store
exports.getStockByStore = async (req, res) => {
    try {
        const { storeId } = req.params;
        const stock = await Stock.findAll({ where: { storeId }, include: [Item] });
        res.json(stock);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get stock details for an item (optionally filter by store)
exports.getStockDetailsForItem = async (req, res) => {
    try {
        const { itemId } = req.params;
        const { storeId } = req.query;
        let stockWhere = { itemId };
        if (storeId) stockWhere.storeId = storeId;
        const stocks = await Stock.findAll({ where: stockWhere });
        const stockIds = stocks.map(s => s.id);
        const details = await StockDetail.findAll({ where: { stockId: stockIds }, order: [['date', 'DESC']] });
        res.json(details);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// When creating stock, set createdBy/updatedBy from req.user.id
exports.createStock = async (req, res) => {
    try {
        const data = req.body;
        const currentUserId = req.user && req.user.id ? req.user.id : null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }
        const stock = await Stock.create({ ...data, createdBy: currentUserId, updatedBy: currentUserId });
        res.status(201).json(stock);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// When updating stock, set updatedBy from req.user.id
exports.updateStock = async (req, res) => {
    try {
        const data = req.body;
        const stock = await Stock.findByPk(req.params.id);
        if (!stock) return res.status(404).json({ error: 'Stock not found' });
        const currentUserId = req.user && req.user.id ? req.user.id : null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }
        await stock.update({ ...data, updatedBy: currentUserId });
        res.json(stock);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Deprecated or direct methods (optional to keep)
exports.adjustStock = async (req, res) => res.status(405).json({ error: 'Use /adjust/create and approval flow' });
exports.reconcileStock = async (req, res) => res.status(405).json({ error: 'Use /reconcile/create and approval flow' });
