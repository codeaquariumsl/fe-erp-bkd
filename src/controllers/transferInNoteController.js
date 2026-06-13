const { 
    TransferInNote, 
    TransferInNoteItem, 
    IssueNote, 
    IssueNoteItem,
    GoodRequestNote, 
    Item, 
    Location, 
    Store, 
    User, 
    Unit, 
    Category,
    Batch,
    BatchItem,
    Stock,
    StockDetail,
    Vehicle,
    Driver,
    sequelize 
} = require('../models');
const { Op } = require('sequelize');

// Get all Transfer In Notes
exports.getAllTransferInNotes = async (req, res) => {
    try {
        const { 
            status, 
            fromLocationId, 
            toLocationId, 
            page = 1, 
            limit = 50,
            startDate,
            endDate
        } = req.query;

        const whereConditions = {};
        if (status) whereConditions.status = status;
        if (fromLocationId) whereConditions.fromLocationId = fromLocationId;
        if (toLocationId) whereConditions.toLocationId = toLocationId;
        
        if (startDate && endDate) {
            whereConditions.transferDate = {
                [Op.between]: [new Date(startDate), new Date(endDate)]
            };
        }

        const offset = (page - 1) * limit;

        const { count, rows: transferInNotes } = await TransferInNote.findAndCountAll({
            where: whereConditions,
            include: [
                { 
                    model: IssueNote, 
                    as: 'IssueNote',
                    attributes: ['id', 'issueNumber']
                },
                { 
                    model: GoodRequestNote, 
                    as: 'GoodRequestNote',
                    attributes: ['id', 'requestNumber', 'priority']
                },
                { model: Location, as: 'FromLocation', attributes: ['id', 'name'] },
                { model: Store, as: 'FromStore', attributes: ['id', 'name'] },
                { model: Location, as: 'ToLocation', attributes: ['id', 'name'] },
                { model: Store, as: 'ToStore', attributes: ['id', 'name'] },
                { model: User, as: 'TransferredByUser', attributes: ['id', 'username'] },
                { model: User, as: 'ReceivedByUser', attributes: ['id', 'username'] },
                { model: User, as: 'ApprovedByUser', attributes: ['id', 'username'] },
                { model: Vehicle, as: 'Vehicle', attributes: ['id', 'vehicleNumber'] },
                { model: Driver, as: 'Driver', attributes: ['id', 'name'] },
                {
                    model: TransferInNoteItem,
                    as: 'Items',
                    include: [
                        { 
                            model: Item, 
                            as: 'Item', 
                            attributes: ['id', 'name', 'sku'],
                            include: [
                                { model: Category, attributes: ['id', 'name'] }
                            ]
                        },
                        { model: Unit, as: 'Unit', attributes: ['id', 'name'] },
                        { model: Batch, as: 'SourceBatch', attributes: ['id', 'batchNumber', 'expireDate'] },
                        { model: Batch, as: 'TargetBatch', attributes: ['id', 'batchNumber', 'expireDate'] }
                    ]
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            transferInNotes,
            totalCount: count,
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / limit),
            hasNextPage: (parseInt(page) * parseInt(limit)) < count,
            hasPrevPage: parseInt(page) > 1
        });
    } catch (error) {
        console.error('Error fetching transfer in notes:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get Transfer In Note by ID
exports.getTransferInNoteById = async (req, res) => {
    try {
        const { id } = req.params;

        const transferInNote = await TransferInNote.findByPk(id, {
            include: [
                { 
                    model: IssueNote, 
                    as: 'IssueNote',
                    include: [
                        { model: User, as: 'IssuedByUser', attributes: ['id', 'username'] }
                    ]
                },
                { 
                    model: GoodRequestNote, 
                    as: 'GoodRequestNote',
                    include: [
                        { model: User, as: 'RequestedByUser', attributes: ['id', 'username'] }
                    ]
                },
                { model: Location, as: 'FromLocation', attributes: ['id', 'name'] },
                { model: Store, as: 'FromStore', attributes: ['id', 'name'] },
                { model: Location, as: 'ToLocation', attributes: ['id', 'name'] },
                { model: Store, as: 'ToStore', attributes: ['id', 'name'] },
                { model: User, as: 'TransferredByUser', attributes: ['id', 'username'] },
                { model: User, as: 'ReceivedByUser', attributes: ['id', 'username'] },
                { model: User, as: 'ApprovedByUser', attributes: ['id', 'username'] },
                { model: Vehicle, as: 'Vehicle' },
                { model: Driver, as: 'Driver' },
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] },
                {
                    model: TransferInNoteItem,
                    as: 'Items',
                    include: [
                        { 
                            model: Item, 
                            as: 'Item',
                            include: [
                                { model: Category, attributes: ['id', 'name'] }
                            ]
                        },
                        { model: Unit, as: 'Unit', attributes: ['id', 'name'] },
                        { model: Batch, as: 'SourceBatch', attributes: ['id', 'batchNumber', 'expireDate'] },
                        { model: Batch, as: 'TargetBatch', attributes: ['id', 'batchNumber', 'expireDate'] },
                        { model: Location, as: 'StorageLocation', attributes: ['id', 'name'] },
                        { 
                            model: IssueNoteItem, 
                            as: 'IssueNoteItem',
                            attributes: ['id', 'requestedQuantity', 'issuedQuantity']
                        }
                    ]
                }
            ]
        });

        if (!transferInNote) {
            return res.status(404).json({ error: 'Transfer In Note not found' });
        }

        res.json(transferInNote);
    } catch (error) {
        console.error('Error fetching transfer in note:', error);
        res.status(500).json({ error: error.message });
    }
};

// Update Transfer In Note (for dispatch and receiving details)
exports.updateTransferInNote = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const {
            vehicleId,
            driverId,
            dispatchDate,
            expectedDeliveryDate,
            remarks,
            items
        } = req.body;

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const transferInNote = await TransferInNote.findByPk(id, { transaction: t });
        if (!transferInNote) {
            await t.rollback();
            return res.status(404).json({ error: 'Transfer In Note not found' });
        }

        // Allow updates for Pending, In_Transit, or Received status
        if (!['Pending', 'In_Transit', 'Received'].includes(transferInNote.status)) {
            await t.rollback();
            return res.status(400).json({ 
                error: 'Transfer In Note cannot be updated in current status' 
            });
        }

        // Update main record
        await transferInNote.update({
            vehicleId: vehicleId || transferInNote.vehicleId,
            driverId: driverId || transferInNote.driverId,
            dispatchDate: dispatchDate || transferInNote.dispatchDate,
            expectedDeliveryDate: expectedDeliveryDate || transferInNote.expectedDeliveryDate,
            remarks: remarks || transferInNote.remarks,
            updatedBy: currentUserId
        }, { transaction: t });

        // Update items with receiving details if provided
        if (items && Array.isArray(items)) {
            let totalWeight = 0;
            let totalValue = 0;

            for (const item of items) {
                const transferInNoteItem = await TransferInNoteItem.findOne({
                    where: {
                        transferInNoteId: transferInNote.id,
                        itemId: item.itemId
                    },
                    transaction: t
                });

                if (transferInNoteItem) {
                    await transferInNoteItem.update({
                        receivedQuantity: item.receivedQuantity ?? transferInNoteItem.receivedQuantity,
                        acceptedQuantity: item.acceptedQuantity ?? transferInNoteItem.acceptedQuantity,
                        rejectedQuantity: item.rejectedQuantity ?? transferInNoteItem.rejectedQuantity,
                        damagedQuantity: item.damagedQuantity ?? transferInNoteItem.damagedQuantity,
                        receivedWeight: item.receivedWeight ?? transferInNoteItem.receivedWeight,
                        qualityGrade: item.qualityGrade || transferInNoteItem.qualityGrade,
                        inspectionNotes: item.inspectionNotes || transferInNoteItem.inspectionNotes,
                        storageLocationId: item.storageLocationId || transferInNoteItem.storageLocationId,
                        remarks: item.remarks || transferInNoteItem.remarks,
                        updatedBy: currentUserId
                    }, { transaction: t });

                    totalWeight += transferInNoteItem.receivedWeight || 0;
                    totalValue += transferInNoteItem.totalCost || 0;
                }
            }

            // Update totals
            await transferInNote.update({
                totalWeight,
                totalValue
            }, { transaction: t });
        }

        await t.commit();

        // Return updated record
        const updatedTransferInNote = await TransferInNote.findByPk(id, {
            include: [
                { model: Location, as: 'FromLocation', attributes: ['id', 'name'] },
                { model: Store, as: 'FromStore', attributes: ['id', 'name'] },
                { model: Location, as: 'ToLocation', attributes: ['id', 'name'] },
                { model: Store, as: 'ToStore', attributes: ['id', 'name'] },
                { model: Vehicle, as: 'Vehicle' },
                { model: Driver, as: 'Driver' },
                {
                    model: TransferInNoteItem,
                    as: 'Items',
                    include: [
                        { 
                            model: Item, 
                            as: 'Item',
                            include: [
                                { model: Category, attributes: ['id', 'name'] }
                            ]
                        },
                        { model: Unit, as: 'Unit', attributes: ['id', 'name'] },
                        { model: Batch, as: 'SourceBatch', attributes: ['id', 'batchNumber', 'expireDate'] },
                        { model: Batch, as: 'TargetBatch', attributes: ['id', 'batchNumber', 'expireDate'] }
                    ]
                }
            ]
        });

        res.json(updatedTransferInNote);
    } catch (error) {
        await t.rollback();
        console.error('Error updating transfer in note:', error);
        res.status(400).json({ error: error.message });
    }
};

// Dispatch Transfer In Note (change status to In_Transit)
exports.dispatchTransferInNote = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { vehicleId, driverId, remarks } = req.body;

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const transferInNote = await TransferInNote.findByPk(id, { transaction: t });
        if (!transferInNote) {
            await t.rollback();
            return res.status(404).json({ error: 'Transfer In Note not found' });
        }

        if (transferInNote.status !== 'Pending') {
            await t.rollback();
            return res.status(400).json({ 
                error: 'Only pending transfer notes can be dispatched' 
            });
        }

        // Update status and dispatch details
        await transferInNote.update({
            status: 'In_Transit',
            vehicleId: vehicleId || transferInNote.vehicleId,
            driverId: driverId || transferInNote.driverId,
            dispatchDate: new Date(),
            remarks: remarks || transferInNote.remarks,
            updatedBy: currentUserId
        }, { transaction: t });

        await t.commit();

        const result = await TransferInNote.findByPk(id, {
            include: [
                { model: Vehicle, as: 'Vehicle' },
                { model: Driver, as: 'Driver' },
                { model: Location, as: 'FromLocation', attributes: ['id', 'name'] },
                { model: Store, as: 'FromStore', attributes: ['id', 'name'] },
                { model: Location, as: 'ToLocation', attributes: ['id', 'name'] },
                { model: Store, as: 'ToStore', attributes: ['id', 'name'] }
            ]
        });

        res.json({ 
            message: 'Transfer In Note dispatched successfully', 
            transferInNote: result
        });
    } catch (error) {
        await t.rollback();
        console.error('Error dispatching transfer in note:', error);
        res.status(400).json({ error: error.message });
    }
};

// Receive Transfer In Note (change status to Received)
exports.receiveTransferInNote = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { items, remarks } = req.body;

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const transferInNote = await TransferInNote.findByPk(id, {
            include: [{ model: TransferInNoteItem, as: 'Items' }],
            transaction: t
        });

        if (!transferInNote) {
            await t.rollback();
            return res.status(404).json({ error: 'Transfer In Note not found' });
        }

        if (transferInNote.status !== 'In_Transit') {
            await t.rollback();
            return res.status(400).json({ 
                error: 'Only in-transit transfer notes can be received' 
            });
        }

        // Update receiving details for items
        if (items && Array.isArray(items)) {
            for (const item of items) {
                const transferItem = await TransferInNoteItem.findOne({
                    where: {
                        transferInNoteId: transferInNote.id,
                        itemId: item.itemId
                    },
                    transaction: t
                });

                if (transferItem) {
                    await transferItem.update({
                        receivedQuantity: item.receivedQuantity,
                        acceptedQuantity: item.acceptedQuantity || item.receivedQuantity,
                        rejectedQuantity: item.rejectedQuantity || 0,
                        damagedQuantity: item.damagedQuantity || 0,
                        receivedWeight: item.receivedWeight,
                        qualityGrade: item.qualityGrade || 'A',
                        inspectionNotes: item.inspectionNotes,
                        storageLocationId: item.storageLocationId,
                        remarks: item.remarks,
                        updatedBy: currentUserId
                    }, { transaction: t });
                }
            }
        }

        // Update main record
        await transferInNote.update({
            status: 'Received',
            receivedBy: currentUserId,
            receivedDate: new Date(),
            actualDeliveryDate: new Date(),
            remarks: remarks || transferInNote.remarks,
            updatedBy: currentUserId
        }, { transaction: t });

        await t.commit();

        const result = await TransferInNote.findByPk(id, {
            include: [
                { model: User, as: 'ReceivedByUser', attributes: ['id', 'username'] },
                { model: Location, as: 'FromLocation', attributes: ['id', 'name'] },
                { model: Store, as: 'FromStore', attributes: ['id', 'name'] },
                { model: Location, as: 'ToLocation', attributes: ['id', 'name'] },
                { model: Store, as: 'ToStore', attributes: ['id', 'name'] },
                {
                    model: TransferInNoteItem,
                    as: 'Items',
                    include: [
                        { model: Item, as: 'Item', attributes: ['id', 'name', 'sku'] }
                    ]
                }
            ]
        });

        res.json({ 
            message: 'Transfer In Note received successfully', 
            transferInNote: result
        });
    } catch (error) {
        await t.rollback();
        console.error('Error receiving transfer in note:', error);
        res.status(400).json({ error: error.message });
    }
};

// Approve Transfer In Note (finalize and update stock)
exports.approveTransferInNote = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { remarks } = req.body;

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const transferInNote = await TransferInNote.findByPk(id, {
            include: [{ 
                model: TransferInNoteItem, 
                as: 'Items',
                include: [{ model: Batch, as: 'SourceBatch' }]
            }],
            transaction: t
        });

        if (!transferInNote) {
            await t.rollback();
            return res.status(404).json({ error: 'Transfer In Note not found' });
        }

        if (transferInNote.status !== 'Received') {
            await t.rollback();
            return res.status(400).json({ 
                error: 'Only received transfer notes can be approved' 
            });
        }

        // Process stock transfers for each item
        for (const transferItem of transferInNote.Items) {
            const acceptedQty = transferItem.acceptedQuantity || 0;
            
            if (acceptedQty > 0) {
                // 1. Reduce stock from source location/store/batch
                await this.reduceSourceStock(transferItem, acceptedQty, currentUserId, t);

                // 2. Add stock to destination location/store (create new batch if needed)
                await this.addDestinationStock(transferInNote, transferItem, acceptedQty, currentUserId, t);

                // 3. Create stock detail records
                await this.createStockDetailRecords(transferInNote, transferItem, acceptedQty, currentUserId, t);
            }

            // Update actual issued quantity in the issue note item
            if (transferItem.issueNoteItemId) {
                const issueNoteItem = await IssueNoteItem.findByPk(transferItem.issueNoteItemId, { transaction: t });
                if (issueNoteItem) {
                    await issueNoteItem.update({
                        actualIssuedQuantity: acceptedQty,
                        actualWeight: transferItem.receivedWeight,
                        updatedBy: currentUserId
                    }, { transaction: t });
                }
            }
        }

        // Update main record
        await transferInNote.update({
            status: 'Approved',
            approvedBy: currentUserId,
            approvedDate: new Date(),
            remarks: remarks || transferInNote.remarks,
            updatedBy: currentUserId
        }, { transaction: t });

        await t.commit();

        const result = await TransferInNote.findByPk(id, {
            include: [
                { model: User, as: 'ApprovedByUser', attributes: ['id', 'username'] },
                { model: Location, as: 'FromLocation', attributes: ['id', 'name'] },
                { model: Store, as: 'FromStore', attributes: ['id', 'name'] },
                { model: Location, as: 'ToLocation', attributes: ['id', 'name'] },
                { model: Store, as: 'ToStore', attributes: ['id', 'name'] },
                {
                    model: TransferInNoteItem,
                    as: 'Items',
                    include: [
                        { model: Item, as: 'Item', attributes: ['id', 'name', 'sku'] },
                        { model: Batch, as: 'SourceBatch', attributes: ['id', 'batchNumber'] },
                        { model: Batch, as: 'TargetBatch', attributes: ['id', 'batchNumber'] }
                    ]
                }
            ]
        });

        res.json({ 
            message: 'Transfer In Note approved successfully - Stock updated', 
            transferInNote: result
        });
    } catch (error) {
        await t.rollback();
        console.error('Error approving transfer in note:', error);
        res.status(400).json({ error: error.message });
    }
};

// Helper function to reduce stock from source
async function reduceSourceStock(transferItem, quantity, currentUserId, transaction) {
    // Reduce from source batch
    if (transferItem.sourceBatchId) {
        const sourceBatchItem = await BatchItem.findOne({
            where: {
                batchId: transferItem.sourceBatchId,
                itemId: transferItem.itemId,
                isActive: true
            },
            transaction
        });

        if (sourceBatchItem) {
            await sourceBatchItem.update({
                availableQuantity: sourceBatchItem.availableQuantity - quantity,
                updatedBy: currentUserId
            }, { transaction });
        }
    }

    // Reduce from source stock
    const sourceStock = await Stock.findOne({
        where: {
            itemId: transferItem.itemId,
            storeId: transferItem.TransferInNote?.fromStoreId,
            locationId: transferItem.TransferInNote?.fromLocationId
        },
        transaction
    });

    if (sourceStock) {
        await sourceStock.update({
            availableQty: sourceStock.availableQty - quantity,
            weight: (sourceStock.weight || 0) - (transferItem.issuedWeight || 0),
            updatedBy: currentUserId
        }, { transaction });
    }
}

// Helper function to add stock to destination
async function addDestinationStock(transferInNote, transferItem, quantity, currentUserId, transaction) {
    // Find or create destination stock
    let destinationStock = await Stock.findOne({
        where: {
            itemId: transferItem.itemId,
            storeId: transferInNote.toStoreId,
            locationId: transferInNote.toLocationId
        },
        transaction
    });

    if (destinationStock) {
        await destinationStock.update({
            availableQty: destinationStock.availableQty + quantity,
            weight: (destinationStock.weight || 0) + (transferItem.receivedWeight || 0),
            updatedBy: currentUserId
        }, { transaction });
    } else {
        destinationStock = await Stock.create({
            itemId: transferItem.itemId,
            storeId: transferInNote.toStoreId,
            locationId: transferInNote.toLocationId,
            availableQty: quantity,
            weight: transferItem.receivedWeight || 0,
            status: 'Active',
            createdBy: currentUserId,
            updatedBy: currentUserId
        }, { transaction });
    }

    // Create or update destination batch if needed
    if (transferItem.sourceBatchId) {
        const sourceBatch = await Batch.findByPk(transferItem.sourceBatchId, { transaction });
        
        // Create new batch at destination with same properties
        const targetBatch = await Batch.create({
            batchNumber: `${sourceBatch.batchNumber}-TIN-${transferInNote.id}`,
            batchDate: transferInNote.transferDate,
            expireDate: sourceBatch.expireDate,
            reference: `Transfer from ${sourceBatch.batchNumber}`,
            grnId: sourceBatch.grnId,
            isActive: true,
            locationId: transferInNote.toLocationId,
            storeId: transferInNote.toStoreId,
            createdBy: currentUserId,
            updatedBy: currentUserId
        }, { transaction });

        // Create batch item for the new batch
        await BatchItem.create({
            batchId: targetBatch.id,
            itemId: transferItem.itemId,
            batchQuantity: quantity,
            availableQuantity: quantity,
            isActive: true,
            locationId: transferInNote.toLocationId,
            storeId: transferInNote.toStoreId,
            createdBy: currentUserId,
            updatedBy: currentUserId
        }, { transaction });

        // Update transfer item with target batch reference
        await transferItem.update({
            targetBatchId: targetBatch.id,
            updatedBy: currentUserId
        }, { transaction });
    }
}

// Helper function to create stock detail records
async function createStockDetailRecords(transferInNote, transferItem, quantity, currentUserId, transaction) {
    // Create OUT record for source stock
    const sourceStock = await Stock.findOne({
        where: {
            itemId: transferItem.itemId,
            storeId: transferInNote.fromStoreId,
            locationId: transferInNote.fromLocationId
        },
        transaction
    });

    if (sourceStock) {
        await StockDetail.create({
            stockId: sourceStock.id,
            documentType: 'TRANSFER_OUT',
            documentId: transferInNote.id,
            inOut: 'OUT',
            qty: quantity,
            weight: transferItem.issuedWeight || 0,
            date: transferInNote.approvedDate,
            remark: `Transfer Out via TIN: ${transferInNote.transferNumber}`,
            createdBy: currentUserId,
            updatedBy: currentUserId
        }, { transaction });
    }

    // Create IN record for destination stock
    const destinationStock = await Stock.findOne({
        where: {
            itemId: transferItem.itemId,
            storeId: transferInNote.toStoreId,
            locationId: transferInNote.toLocationId
        },
        transaction
    });

    if (destinationStock) {
        await StockDetail.create({
            stockId: destinationStock.id,
            documentType: 'TRANSFER_IN',
            documentId: transferInNote.id,
            inOut: 'IN',
            qty: quantity,
            weight: transferItem.receivedWeight || 0,
            date: transferInNote.approvedDate,
            remark: `Transfer In via TIN: ${transferInNote.transferNumber}`,
            createdBy: currentUserId,
            updatedBy: currentUserId
        }, { transaction });
    }
}

// Assign these helper functions to exports so they can be accessed
exports.reduceSourceStock = reduceSourceStock;
exports.addDestinationStock = addDestinationStock;
exports.createStockDetailRecords = createStockDetailRecords;

// Get statistics for Transfer In Notes
exports.getTransferInNoteStats = async (req, res) => {
    try {
        const { locationId } = req.query;

        const whereCondition = locationId ? 
            { [Op.or]: [{ fromLocationId: locationId }, { toLocationId: locationId }] } : 
            {};

        const [totalTransfers, pendingTransfers, inTransitTransfers, receivedTransfers, approvedTransfers] = await Promise.all([
            TransferInNote.count({ where: whereCondition }),
            TransferInNote.count({ where: { ...whereCondition, status: 'Pending' } }),
            TransferInNote.count({ where: { ...whereCondition, status: 'In_Transit' } }),
            TransferInNote.count({ where: { ...whereCondition, status: 'Received' } }),
            TransferInNote.count({ where: { ...whereCondition, status: 'Approved' } })
        ]);

        res.json({
            totalTransfers,
            pendingTransfers,
            inTransitTransfers,
            receivedTransfers,
            approvedTransfers,
            completionRate: totalTransfers > 0 ? (approvedTransfers / totalTransfers * 100).toFixed(2) : 0
        });
    } catch (error) {
        console.error('Error fetching transfer in note stats:', error);
        res.status(500).json({ error: error.message });
    }
};