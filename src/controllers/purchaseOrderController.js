const PurchaseOrder = require('../models/purchaseOrder');
const PurchaseOrderItem = require('../models/purchaseOrderItem');
const Supplier = require('../models/supplier');
const Item = require('../models/item');
const { generateDocumentNumber } = require('./documentControllerClient');
const { Op } = require('sequelize');

// Create a new purchase order with items
exports.createPurchaseOrder = async (req, res) => {
    const t = await PurchaseOrder.sequelize.transaction();
    try {
        // Generate order number
        const { supplierId, orderDate, deliveryDate, status, totalAmount, items, locationId } = req.body;
        const orderNumber = await generateDocumentNumber('PO', locationId);
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }
        // Check if supplier exists
        const supplier = await Supplier.findByPk(supplierId, { transaction: t });
        if (!supplier) {
            await t.rollback();
            return res.status(400).json({ error: 'Supplier not found' });
        }
        // Create purchase order
        const po = await PurchaseOrder.create({
            orderNumber,
            supplierId,
            orderDate,
            deliveryDate,
            status,
            totalAmount,
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
                await PurchaseOrderItem.create({
                    purchaseOrderId: po.id,
                    itemId: item.itemId,
                    quantity: item.quantity,
                    availableQty: item.quantity,
                    unitPrice: item.unitPrice,
                    totalPrice: item.totalPrice,
                    createdBy: currentUserId,
                    updatedBy: currentUserId
                }, { transaction: t });
            }
        }
        await t.commit();
        const result = await PurchaseOrder.findByPk(po.id, {
            include: [
                { model: Supplier },
                { model: PurchaseOrderItem, include: [Item] }
            ]
        });
        res.status(201).json(result);
    } catch (error) {
        await t.rollback();
        res.status(400).json({ error: error.message });
    }
};

// Get all purchase orders with items
exports.getPurchaseOrders = async (req, res) => {
    try {
        const pos = await PurchaseOrder.findAll({
            where: { locationId: req.query.locationId || { [Op.ne]: null } },
            include: [
                { model: Supplier },
                { model: PurchaseOrderItem, include: [Item] }
            ],
            order: [['createdAt', 'DESC']]
        });
        res.json(pos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get a single purchase order by ID with items
exports.getPurchaseOrderById = async (req, res) => {
    try {
        const po = await PurchaseOrder.findByPk(req.params.id, {
            include: [
                { model: Supplier },
                { model: PurchaseOrderItem, include: [Item] }
            ]
        });
        if (!po) return res.status(404).json({ error: 'Purchase order not found' });
        res.json(po);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update a purchase order and its items
exports.updatePurchaseOrder = async (req, res) => {
    const t = await PurchaseOrder.sequelize.transaction();
    try {
        const { items, ...data } = req.body;
        const po = await PurchaseOrder.findByPk(req.params.id, {
            include: [{ model: PurchaseOrderItem }],
            transaction: t
        });

        if (!po) {
            await t.rollback();
            return res.status(404).json({ error: 'Purchase order not found' });
        }

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        // Update the main purchase order
        await po.update({
            ...data,
            updatedBy: currentUserId
        }, { transaction: t });

        if (Array.isArray(items)) {
            // Remove existing items
            await PurchaseOrderItem.destroy({
                where: { purchaseOrderId: po.id },
                transaction: t
            });

            // Add all items as new
            for (const item of items) {
                // Verify item exists
                const itemExists = await Item.findByPk(item.itemId, { transaction: t });
                if (!itemExists) {
                    await t.rollback();
                    return res.status(400).json({ error: `Item not found: ${item.itemId}` });
                }

                await PurchaseOrderItem.create({
                    purchaseOrderId: po.id,
                    itemId: item.itemId,
                    quantity: item.quantity,
                    availableQty: item.quantity,
                    unitPrice: item.unitPrice,
                    totalPrice: item.totalPrice,
                    createdBy: currentUserId,
                    updatedBy: currentUserId
                }, { transaction: t });
            }
        }

        await t.commit();

        // Fetch the updated purchase order with all relations
        const updatedPo = await PurchaseOrder.findByPk(po.id, {
            include: [
                { model: Supplier },
                { model: PurchaseOrderItem, include: [Item] }
            ]
        });

        res.json(updatedPo);
    } catch (error) {
        await t.rollback();
        res.status(400).json({ error: error.message });
    }
};

// Delete a purchase order and its items
exports.deletePurchaseOrder = async (req, res) => {
    try {
        const po = await PurchaseOrder.findByPk(req.params.id);
        if (!po) return res.status(404).json({ error: 'Purchase order not found' });
        await PurchaseOrderItem.destroy({ where: { purchaseOrderId: po.id } });
        await po.destroy();
        res.json({ message: 'Purchase order deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Approve or reject a purchase order
exports.approveOrRejectPurchaseOrder = async (req, res) => {
    try {
        const { status } = req.body; // status should be 'Approved' or 'Rejected'
        if (!['Approved', 'Rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Must be Approved or Rejected.' });
        }
        const po = await PurchaseOrder.findByPk(req.params.id);
        if (!po) return res.status(404).json({ error: 'Purchase order not found' });
        await po.update({ status });
        res.json({ message: `Purchase order ${status.toLowerCase()}`, purchaseOrder: po });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get purchase orders that have items with availableQty > 0
exports.getAvailablePurchaseOrders = async (req, res) => {
    try {
        const pos = await PurchaseOrder.findAll({
            where: {
                status: 'Approved' // Only consider approved purchase orders
            },
            include: [
                { model: Supplier },
                {
                    model: PurchaseOrderItem,
                    include: [Item],
                    where: {
                        availableQty: { [Op.gt]: 0 }
                    },
                    required: true // Only return POs that have at least one item with availableQty > 0
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Filter and format the response to only include items with availableQty > 0
        const result = pos.map(po => {
            const poData = po.toJSON();
            poData.PurchaseOrderItems = poData.PurchaseOrderItems.filter(item => item.availableQty > 0);
            return poData;
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
