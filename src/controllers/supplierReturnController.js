const SupplierReturn = require('../models/supplierReturn');
const SupplierReturnItem = require('../models/supplierReturnItem');
const Supplier = require('../models/supplier');
const Item = require('../models/item');
const User = require('../models/user');
const ReturnType = require('../models/returnType');
const PurchaseOrder = require('../models/purchaseOrder');
const GRN = require('../models/grn');
const Batch = require('../models/batch');
const Unit = require('../models/unit');
const Location = require('../models/location');
const Store = require('../models/store');
const ColdRoom = require('../models/coldRoom');
const PalletRack = require('../models/palletRack');
const { generateDocumentNumber } = require('./documentControllerClient');
const { Op } = require('sequelize');

// Create a new supplier return with items
exports.createSupplierReturn = async (req, res) => {
    const t = await SupplierReturn.sequelize.transaction();
    try {
        const {
            supplierId,
            purchaseOrderId,
            grnId,
            returnTypeId,
            reason,
            notes,
            locationId,
            storeId,
            items
        } = req.body;

        // Generate return number
        const returnNumber = await generateDocumentNumber('SR', locationId);

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        // Validate supplier exists
        const supplier = await Supplier.findByPk(supplierId, { transaction: t });
        if (!supplier) {
            await t.rollback();
            return res.status(400).json({ error: 'Supplier not found' });
        }

        // Validate return type exists
        const returnType = await ReturnType.findByPk(returnTypeId, { transaction: t });
        if (!returnType) {
            await t.rollback();
            return res.status(400).json({ error: 'Return type not found' });
        }

        // Calculate total amount
        let totalAmount = 0;
        if (Array.isArray(items)) {
            totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.totalPrice) || 0), 0);
        }

        // Create supplier return
        const supplierReturn = await SupplierReturn.create({
            returnNumber,
            supplierId,
            purchaseOrderId,
            grnId,
            returnTypeId,
            reason,
            totalAmount,
            notes,
            locationId,
            storeId,
            createdBy: currentUserId,
            updatedBy: currentUserId
        }, { transaction: t });

        // Add items
        if (Array.isArray(items)) {
            for (const item of items) {
                // Validate item exists
                const itemExists = await Item.findByPk(item.itemId, { transaction: t });
                if (!itemExists) {
                    await t.rollback();
                    return res.status(400).json({ error: `Item not found: ${item.itemId}` });
                }

                await SupplierReturnItem.create({
                    supplierReturnId: supplierReturn.id,
                    itemId: item.itemId,
                    batchId: item.batchId || null,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    totalPrice: item.totalPrice,
                    unitId: item.unitId || null,
                    condition: item.condition || 'Good',
                    expiryDate: item.expiryDate || null,
                    serialNumbers: item.serialNumbers || null,
                    reason: item.reason || null,
                    disposition: item.disposition || 'Return to Supplier',
                    isRefundable: item.isRefundable !== undefined ? item.isRefundable : true,
                    refundAmount: item.refundAmount || 0,
                    coldRoomId: item.coldRoomId || null,
                    palletRackId: item.palletRackId || null,
                    notes: item.notes || null,
                    createdBy: currentUserId,
                    updatedBy: currentUserId
                }, { transaction: t });
            }
        }

        await t.commit();

        // Fetch the created return with all associations (outside transaction)
        const createdReturn = await SupplierReturn.findByPk(supplierReturn.id, {
            include: [
                {
                    model: Supplier,
                    as: 'Supplier',
                    attributes: ['id', 'name', 'type']
                },
                {
                    model: ReturnType,
                    as: 'ReturnType',
                    attributes: ['id', 'name', 'code']
                },
                {
                    model: SupplierReturnItem,
                    as: 'SupplierReturnItems',
                    include: [
                        {
                            model: Item,
                            as: 'Item',
                            attributes: ['id', 'name', 'sku', 'barcode']
                        }
                    ]
                },
                {
                    model: User,
                    as: 'Creator',
                    attributes: ['id', 'username']
                }
            ]
        });

        res.status(201).json(createdReturn);
    } catch (error) {
        // Only rollback if transaction hasn't been committed yet
        if (!t.finished) {
            await t.rollback();
        }
        console.error('Error creating supplier return:', error);
        res.status(400).json({ error: error.message });
    }
};

// Get all supplier returns
exports.getSupplierReturns = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, supplierId, locationId } = req.query;
        const offset = (page - 1) * limit;

        const whereClause = {};
        if (status) whereClause.status = status;
        if (supplierId) whereClause.supplierId = supplierId;
        if (locationId) whereClause.locationId = locationId;

        const { count, rows: returns } = await SupplierReturn.findAndCountAll({
            where: whereClause,
            limit: parseInt(limit),
            offset: parseInt(offset),
            include: [
                {
                    model: Supplier,
                    as: 'Supplier',
                    attributes: ['id', 'name', 'type']
                },
                {
                    model: ReturnType,
                    as: 'ReturnType',
                    attributes: ['id', 'name', 'code']
                },
                {
                    model: SupplierReturnItem,
                    as: 'SupplierReturnItems',
                    include: [
                        {
                            model: Item,
                            as: 'Item',
                            attributes: ['id', 'name', 'sku', 'barcode']
                        }
                    ]
                },
                {
                    model: User,
                    as: 'Creator',
                    attributes: ['id', 'username']
                },
                {
                    model: User,
                    as: 'Updater',
                    attributes: ['id', 'username']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json({
            returns,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count,
                pages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching supplier returns:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get a single supplier return by ID
exports.getSupplierReturnById = async (req, res) => {
    try {
        const supplierReturn = await SupplierReturn.findByPk(req.params.id, {
            include: [
                {
                    model: Supplier,
                    as: 'Supplier',
                    attributes: ['id', 'name', 'type', 'contactPerson', 'phone', 'email']
                },
                {
                    model: ReturnType,
                    as: 'ReturnType',
                    attributes: ['id', 'name', 'code', 'description']
                },
                {
                    model: PurchaseOrder,
                    as: 'PurchaseOrder',
                    attributes: ['id', 'orderNumber', 'orderDate']
                },
                {
                    model: GRN,
                    as: 'GRN',
                    attributes: ['id', 'grnNumber', 'grnDate']
                },
                {
                    model: Location,
                    as: 'Location',
                    attributes: ['id', 'name']
                },
                {
                    model: Store,
                    as: 'Store',
                    attributes: ['id', 'name']
                },
                {
                    model: SupplierReturnItem,
                    as: 'SupplierReturnItems',
                    include: [
                        {
                            model: Item,
                            as: 'Item',
                            attributes: ['id', 'name', 'sku', 'barcode']
                        },
                        {
                            model: Batch,
                            as: 'Batch',
                            attributes: ['id', 'batchNumber', 'expireDate']
                        },
                        {
                            model: Unit,
                            as: 'Unit',
                            attributes: ['id', 'name', 'symbol']
                        },
                        {
                            model: ColdRoom,
                            as: 'ColdRoom',
                            attributes: ['id', 'name']
                        },
                        {
                            model: PalletRack,
                            as: 'PalletRack',
                            attributes: ['id', 'rackNumber']
                        }
                    ]
                },
                {
                    model: User,
                    as: 'Creator',
                    attributes: ['id', 'username']
                },
                {
                    model: User,
                    as: 'Updater',
                    attributes: ['id', 'username']
                },
                {
                    model: User,
                    as: 'ApprovedByUser',
                    attributes: ['id', 'username']
                }
            ]
        });

        if (!supplierReturn) {
            return res.status(404).json({ error: 'Supplier return not found' });
        }

        res.json(supplierReturn);
    } catch (error) {
        console.error('Error fetching supplier return:', error);
        res.status(500).json({ error: error.message });
    }
};

// Update a supplier return
exports.updateSupplierReturn = async (req, res) => {
    const t = await SupplierReturn.sequelize.transaction();
    try {
        const supplierReturn = await SupplierReturn.findByPk(req.params.id, { transaction: t });
        if (!supplierReturn) {
            await t.rollback();
            return res.status(404).json({ error: 'Supplier return not found' });
        }

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const { items, ...updateData } = req.body;

        // Update the supplier return
        await supplierReturn.update({
            ...updateData,
            updatedBy: currentUserId
        }, { transaction: t });

        // If items are provided, update them
        if (Array.isArray(items)) {
            // Delete existing items
            await SupplierReturnItem.destroy({
                where: { supplierReturnId: supplierReturn.id },
                transaction: t
            });

            // Add new items
            for (const item of items) {
                await SupplierReturnItem.create({
                    supplierReturnId: supplierReturn.id,
                    ...item,
                    updatedBy: currentUserId
                }, { transaction: t });
            }

            // Recalculate total amount
            const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.totalPrice) || 0), 0);
            await supplierReturn.update({ totalAmount }, { transaction: t });
        }

        await t.commit();

        // Fetch updated return (outside transaction)
        const updatedReturn = await SupplierReturn.findByPk(supplierReturn.id, {
            include: [
                {
                    model: Supplier,
                    as: 'Supplier',
                    attributes: ['id', 'name', 'type']
                },
                {
                    model: SupplierReturnItem,
                    as: 'SupplierReturnItems',
                    include: [
                        {
                            model: Item,
                            as: 'Item',
                            attributes: ['id', 'name', 'sku', 'barcode']
                        }
                    ]
                }
            ]
        });

        res.json(updatedReturn);
    } catch (error) {
        // Only rollback if transaction hasn't been committed yet
        if (!t.finished) {
            await t.rollback();
        }
        console.error('Error updating supplier return:', error);
        res.status(400).json({ error: error.message });
    }
};

// Approve/Reject a supplier return
exports.approveSupplierReturn = async (req, res) => {
    try {
        const { status, notes } = req.body; // 'Approved' or 'Rejected'
        const supplierReturn = await SupplierReturn.findByPk(req.params.id);

        if (!supplierReturn) {
            return res.status(404).json({ error: 'Supplier return not found' });
        }

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        await supplierReturn.update({
            status,
            approvedBy: currentUserId,
            approvedDate: new Date(),
            notes: notes || supplierReturn.notes,
            updatedBy: currentUserId
        });

        res.json({ message: `Supplier return ${status.toLowerCase()} successfully`, supplierReturn });
    } catch (error) {
        console.error('Error approving supplier return:', error);
        res.status(400).json({ error: error.message });
    }
};

// Delete a supplier return
exports.deleteSupplierReturn = async (req, res) => {
    const t = await SupplierReturn.sequelize.transaction();
    try {
        const supplierReturn = await SupplierReturn.findByPk(req.params.id, { transaction: t });
        if (!supplierReturn) {
            await t.rollback();
            return res.status(404).json({ error: 'Supplier return not found' });
        }

        // Delete associated items first (cascade delete should handle this, but being explicit)
        await SupplierReturnItem.destroy({
            where: { supplierReturnId: supplierReturn.id },
            transaction: t
        });

        // Delete the supplier return
        await supplierReturn.destroy({ transaction: t });

        await t.commit();
        res.json({ message: 'Supplier return deleted successfully' });
    } catch (error) {
        // Only rollback if transaction hasn't been committed yet
        if (!t.finished) {
            await t.rollback();
        }
        console.error('Error deleting supplier return:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get supplier return statistics
exports.getSupplierReturnStats = async (req, res) => {
    try {
        const { startDate, endDate, supplierId, locationId } = req.query;

        const whereClause = {};
        if (supplierId) whereClause.supplierId = supplierId;
        if (locationId) whereClause.locationId = locationId;
        if (startDate && endDate) {
            whereClause.returnDate = {
                [Op.between]: [new Date(startDate), new Date(endDate)]
            };
        }

        const stats = await SupplierReturn.findAll({
            where: whereClause,
            attributes: [
                'status',
                [SupplierReturn.sequelize.fn('COUNT', SupplierReturn.sequelize.col('id')), 'count'],
                [SupplierReturn.sequelize.fn('SUM', SupplierReturn.sequelize.col('totalAmount')), 'totalAmount']
            ],
            group: ['status'],
            raw: true
        });

        res.json(stats);
    } catch (error) {
        console.error('Error fetching supplier return stats:', error);
        res.status(500).json({ error: error.message });
    }
};