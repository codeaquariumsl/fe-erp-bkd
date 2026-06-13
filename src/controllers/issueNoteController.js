const { 
    IssueNote, 
    IssueNoteItem, 
    GoodRequestNote, 
    GoodRequestNoteItem,
    TransferInNote,
    TransferInNoteItem,
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
    sequelize 
} = require('../models');
const { Op } = require('sequelize');
const { generateDocumentNumber } = require('./documentControllerClient');

// Get all Issue Notes
exports.getAllIssueNotes = async (req, res) => {
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
            whereConditions.issueDate = {
                [Op.between]: [new Date(startDate), new Date(endDate)]
            };
        }

        const offset = (page - 1) * limit;

        const { count, rows: issueNotes } = await IssueNote.findAndCountAll({
            where: whereConditions,
            include: [
                { 
                    model: GoodRequestNote, 
                    as: 'GoodRequestNote',
                    attributes: ['id', 'requestNumber', 'priority']
                },
                { model: Location, as: 'FromLocation', attributes: ['id', 'name'] },
                { model: Store, as: 'FromStore', attributes: ['id', 'name'] },
                { model: Location, as: 'ToLocation', attributes: ['id', 'name'] },
                { model: Store, as: 'ToStore', attributes: ['id', 'name'] },
                { model: User, as: 'IssuedByUser', attributes: ['id', 'username'] },
                { model: User, as: 'ApprovedByUser', attributes: ['id', 'username'] },
                {
                    model: IssueNoteItem,
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
                        { model: Batch, as: 'Batch', attributes: ['id', 'batchNumber', 'expireDate'] }
                    ]
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            issueNotes,
            totalCount: count,
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / limit),
            hasNextPage: (parseInt(page) * parseInt(limit)) < count,
            hasPrevPage: parseInt(page) > 1
        });
    } catch (error) {
        console.error('Error fetching issue notes:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get Issue Note by ID
exports.getIssueNoteById = async (req, res) => {
    try {
        const { id } = req.params;

        const issueNote = await IssueNote.findByPk(id, {
            include: [
                { 
                    model: GoodRequestNote, 
                    as: 'GoodRequestNote',
                    include: [
                        { model: Location, as: 'FromLocation', attributes: ['id', 'name'] },
                        { model: Store, as: 'FromStore', attributes: ['id', 'name'] },
                        { model: User, as: 'RequestedByUser', attributes: ['id', 'username'] }
                    ]
                },
                { model: Location, as: 'FromLocation', attributes: ['id', 'name'] },
                { model: Store, as: 'FromStore', attributes: ['id', 'name'] },
                { model: Location, as: 'ToLocation', attributes: ['id', 'name'] },
                { model: Store, as: 'ToStore', attributes: ['id', 'name'] },
                { model: User, as: 'IssuedByUser', attributes: ['id', 'username'] },
                { model: User, as: 'ApprovedByUser', attributes: ['id', 'username'] },
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] },
                {
                    model: IssueNoteItem,
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
                        { model: Batch, as: 'Batch', attributes: ['id', 'batchNumber', 'expireDate'] },
                        { 
                            model: GoodRequestNoteItem, 
                            as: 'GoodRequestNoteItem',
                            attributes: ['id', 'requestedQuantity', 'urgency', 'purpose']
                        }
                    ]
                }
            ]
        });

        if (!issueNote) {
            return res.status(404).json({ error: 'Issue Note not found' });
        }

        // If converted to transfer in note, include the transfer note details
        if (issueNote.transferInNoteId) {
            const transferInNote = await TransferInNote.findByPk(issueNote.transferInNoteId, {
                attributes: ['id', 'transferNumber', 'status', 'createdAt']
            });
            issueNote.dataValues.transferInNote = transferInNote;
        }

        res.json(issueNote);
    } catch (error) {
        console.error('Error fetching issue note:', error);
        res.status(500).json({ error: error.message });
    }
};

// Update Issue Note (for assigning batches and adjusting quantities)
exports.updateIssueNote = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const {
            deliveryExpectedDate,
            remarks,
            items
        } = req.body;

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const issueNote = await IssueNote.findByPk(id, { transaction: t });
        if (!issueNote) {
            await t.rollback();
            return res.status(404).json({ error: 'Issue Note not found' });
        }

        // Only allow updates for Pending issues
        if (issueNote.status !== 'Pending') {
            await t.rollback();
            return res.status(400).json({ 
                error: 'Only pending issue notes can be updated' 
            });
        }

        // Update main record
        await issueNote.update({
            deliveryExpectedDate: deliveryExpectedDate || issueNote.deliveryExpectedDate,
            remarks: remarks || issueNote.remarks,
            updatedBy: currentUserId
        }, { transaction: t });

        // Update items with batch assignments and quantity adjustments
        if (items && Array.isArray(items)) {
            for (const item of items) {
                const issueNoteItem = await IssueNoteItem.findOne({
                    where: {
                        issueNoteId: issueNote.id,
                        itemId: item.itemId
                    },
                    transaction: t
                });

                if (issueNoteItem) {
                    // Validate batch if specified
                    if (item.batchId) {
                        const batch = await Batch.findByPk(item.batchId, {
                            include: [{
                                model: BatchItem,
                                as: 'BatchItems',
                                where: { 
                                    itemId: item.itemId,
                                    isActive: true,
                                    availableQuantity: { [Op.gt]: 0 }
                                }
                            }],
                            transaction: t
                        });

                        if (!batch || !batch.BatchItems.length) {
                            await t.rollback();
                            return res.status(400).json({ 
                                error: `Batch ${item.batchId} not found or has no available quantity for item ${item.itemId}` 
                            });
                        }

                        const batchItem = batch.BatchItems[0];
                        if (batchItem.availableQuantity < item.issuedQuantity) {
                            await t.rollback();
                            return res.status(400).json({ 
                                error: `Insufficient batch quantity. Available: ${batchItem.availableQuantity}, Required: ${item.issuedQuantity}` 
                            });
                        }

                        // Update issue note item with batch info
                        await issueNoteItem.update({
                            batchId: item.batchId,
                            issuedQuantity: item.issuedQuantity || issueNoteItem.issuedQuantity,
                            costPrice: item.costPrice || batchItem.costPrice,
                            totalCost: (item.issuedQuantity || issueNoteItem.issuedQuantity) * (item.costPrice || batchItem.costPrice || 0),
                            expiryDate: batch.expireDate,
                            actualWeight: item.actualWeight || issueNoteItem.actualWeight,
                            remarks: item.remarks || issueNoteItem.remarks,
                            updatedBy: currentUserId
                        }, { transaction: t });
                    } else {
                        // Update without batch assignment
                        await issueNoteItem.update({
                            issuedQuantity: item.issuedQuantity || issueNoteItem.issuedQuantity,
                            actualWeight: item.actualWeight || issueNoteItem.actualWeight,
                            remarks: item.remarks || issueNoteItem.remarks,
                            updatedBy: currentUserId
                        }, { transaction: t });
                    }
                }
            }
        }

        await t.commit();

        // Return updated record
        const updatedIssueNote = await IssueNote.findByPk(id, {
            include: [
                { model: Location, as: 'FromLocation', attributes: ['id', 'name'] },
                { model: Store, as: 'FromStore', attributes: ['id', 'name'] },
                { model: Location, as: 'ToLocation', attributes: ['id', 'name'] },
                { model: Store, as: 'ToStore', attributes: ['id', 'name'] },
                {
                    model: IssueNoteItem,
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
                        { model: Batch, as: 'Batch', attributes: ['id', 'batchNumber', 'expireDate'] }
                    ]
                }
            ]
        });

        res.json(updatedIssueNote);
    } catch (error) {
        await t.rollback();
        console.error('Error updating issue note:', error);
        res.status(400).json({ error: error.message });
    }
};

// Approve or Reject Issue Note
exports.approveOrRejectIssueNote = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { status, remarks } = req.body; // status: 'Approved' or 'Rejected'

        if (!['Approved', 'Rejected'].includes(status)) {
            await t.rollback();
            return res.status(400).json({ error: 'Invalid status. Must be Approved or Rejected.' });
        }

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const issueNote = await IssueNote.findByPk(id, {
            include: [{ model: IssueNoteItem, as: 'Items' }],
            transaction: t
        });

        if (!issueNote) {
            await t.rollback();
            return res.status(404).json({ error: 'Issue Note not found' });
        }

        if (issueNote.status !== 'Pending') {
            await t.rollback();
            return res.status(400).json({ 
                error: 'Only pending issue notes can be approved or rejected' 
            });
        }

        // Validate that all items have batch assignments (for approved status)
        if (status === 'Approved') {
            const itemsWithoutBatches = issueNote.Items.filter(item => !item.batchId);
            if (itemsWithoutBatches.length > 0) {
                await t.rollback();
                return res.status(400).json({ 
                    error: 'All items must have batch assignments before approval' 
                });
            }

            // Validate stock availability for each item
            for (const item of issueNote.Items) {
                const batchItem = await BatchItem.findOne({
                    where: {
                        batchId: item.batchId,
                        itemId: item.itemId,
                        isActive: true
                    },
                    transaction: t
                });

                if (!batchItem || batchItem.availableQuantity < item.issuedQuantity) {
                    await t.rollback();
                    return res.status(400).json({ 
                        error: `Insufficient stock for item ${item.itemId}. Available: ${batchItem?.availableQuantity || 0}, Required: ${item.issuedQuantity}` 
                    });
                }
            }
        }

        // Update main record
        await issueNote.update({
            status,
            approvedBy: currentUserId,
            approvedDate: new Date(),
            remarks: remarks || issueNote.remarks,
            updatedBy: currentUserId
        }, { transaction: t });

        await t.commit();

        // If approved, automatically create Transfer In Note
        let transferInNote = null;
        if (status === 'Approved') {
            try {
                transferInNote = await this.convertToTransferInNote(issueNote.id, currentUserId);
            } catch (transferError) {
                console.error('Error auto-creating transfer in note:', transferError);
                // Continue with approval even if transfer note creation fails
            }
        }

        const result = await IssueNote.findByPk(id, {
            include: [
                { 
                    model: GoodRequestNote, 
                    as: 'GoodRequestNote',
                    attributes: ['id', 'requestNumber', 'priority']
                },
                { model: Location, as: 'FromLocation', attributes: ['id', 'name'] },
                { model: Store, as: 'FromStore', attributes: ['id', 'name'] },
                { model: Location, as: 'ToLocation', attributes: ['id', 'name'] },
                { model: Store, as: 'ToStore', attributes: ['id', 'name'] },
                { model: User, as: 'IssuedByUser', attributes: ['id', 'username'] },
                { model: User, as: 'ApprovedByUser', attributes: ['id', 'username'] },
                {
                    model: IssueNoteItem,
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
                        { model: Batch, as: 'Batch', attributes: ['id', 'batchNumber', 'expireDate'] }
                    ]
                }
            ]
        });

        res.json({ 
            message: `Issue Note ${status.toLowerCase()} successfully`, 
            issueNote: result,
            transferInNote: transferInNote
        });
    } catch (error) {
        await t.rollback();
        console.error('Error approving issue note:', error);
        res.status(400).json({ error: error.message });
    }
};

// Convert Approved Issue Note to Transfer In Note (internal function)
exports.convertToTransferInNote = async (issueNoteId, currentUserId) => {
    const t = await sequelize.transaction();
    try {
        const issueNote = await IssueNote.findByPk(issueNoteId, {
            include: [{ model: IssueNoteItem, as: 'Items' }],
            transaction: t
        });

        if (!issueNote || issueNote.status !== 'Approved') {
            await t.rollback();
            throw new Error('Issue Note must be approved to convert to Transfer In Note');
        }

        // Generate transfer number
        const transferNumber = await generateDocumentNumber('TIN', issueNote.toLocationId);

        // Create Transfer In Note
        const transferInNote = await TransferInNote.create({
            transferNumber,
            transferDate: new Date(),
            issueNoteId: issueNote.id,
            goodRequestNoteId: issueNote.goodRequestNoteId,
            fromLocationId: issueNote.fromLocationId,
            fromStoreId: issueNote.fromStoreId,
            toLocationId: issueNote.toLocationId,
            toStoreId: issueNote.toStoreId,
            status: 'Pending',
            transferredBy: currentUserId,
            expectedDeliveryDate: issueNote.deliveryExpectedDate,
            remarks: `Auto-generated from Issue Note: ${issueNote.issueNumber}`,
            createdBy: currentUserId,
            updatedBy: currentUserId
        }, { transaction: t });

        let totalWeight = 0;
        let totalValue = 0;

        // Create Transfer In Note Items
        for (const issueItem of issueNote.Items) {
            await TransferInNoteItem.create({
                transferInNoteId: transferInNote.id,
                issueNoteItemId: issueItem.id,
                itemId: issueItem.itemId,
                sourceBatchId: issueItem.batchId,
                issuedQuantity: issueItem.issuedQuantity,
                receivedQuantity: 0,
                acceptedQuantity: 0,
                unitId: issueItem.unitId,
                issuedWeight: issueItem.actualWeight,
                costPrice: issueItem.costPrice,
                totalCost: issueItem.totalCost,
                expiryDate: issueItem.expiryDate,
                remarks: issueItem.remarks,
                createdBy: currentUserId,
                updatedBy: currentUserId
            }, { transaction: t });

            totalWeight += issueItem.actualWeight || 0;
            totalValue += issueItem.totalCost || 0;
        }

        // Update Transfer In Note totals
        await transferInNote.update({
            totalWeight,
            totalValue
        }, { transaction: t });

        // Update Issue Note status and link to Transfer In Note
        await issueNote.update({
            status: 'Transferred',
            transferInNoteId: transferInNote.id,
            updatedBy: currentUserId
        }, { transaction: t });

        await t.commit();

        return transferInNote;
    } catch (error) {
        await t.rollback();
        throw error;
    }
};

// Get available batches for an item and location
exports.getAvailableBatches = async (req, res) => {
    try {
        const { itemId, locationId, storeId } = req.query;

        if (!itemId || !locationId || !storeId) {
            return res.status(400).json({ 
                error: 'itemId, locationId, and storeId are required' 
            });
        }

        const batches = await Batch.findAll({
            where: {
                locationId: locationId,
                storeId: storeId,
                isActive: true
            },
            include: [{
                model: BatchItem,
                as: 'BatchItems',
                where: {
                    itemId: itemId,
                    isActive: true,
                    availableQuantity: { [Op.gt]: 0 }
                },
                include: [{
                    model: Item,
                    as: 'Item',
                    attributes: ['id', 'name', 'sku']
                }]
            }],
            order: [['expireDate', 'ASC']] // FIFO - First In, First Out
        });

        res.json(batches);
    } catch (error) {
        console.error('Error fetching available batches:', error);
        res.status(500).json({ error: error.message });
    }
};

// Delete Issue Note
exports.deleteIssueNote = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;

        const issueNote = await IssueNote.findByPk(id, { transaction: t });
        if (!issueNote) {
            await t.rollback();
            return res.status(404).json({ error: 'Issue Note not found' });
        }

        // Only allow deletion of Pending issues
        if (issueNote.status !== 'Pending') {
            await t.rollback();
            return res.status(400).json({ 
                error: 'Only pending issue notes can be deleted' 
            });
        }

        // Delete associated items first
        await IssueNoteItem.destroy({
            where: { issueNoteId: issueNote.id },
            transaction: t
        });

        // Delete the main record
        await issueNote.destroy({ transaction: t });

        await t.commit();
        res.json({ message: 'Issue Note deleted successfully' });
    } catch (error) {
        await t.rollback();
        console.error('Error deleting issue note:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get statistics for Issue Notes
exports.getIssueNoteStats = async (req, res) => {
    try {
        const { locationId } = req.query;

        const whereCondition = locationId ? 
            { [Op.or]: [{ fromLocationId: locationId }, { toLocationId: locationId }] } : 
            {};

        const [totalIssues, pendingIssues, approvedIssues, rejectedIssues, transferredIssues] = await Promise.all([
            IssueNote.count({ where: whereCondition }),
            IssueNote.count({ where: { ...whereCondition, status: 'Pending' } }),
            IssueNote.count({ where: { ...whereCondition, status: 'Approved' } }),
            IssueNote.count({ where: { ...whereCondition, status: 'Rejected' } }),
            IssueNote.count({ where: { ...whereCondition, status: 'Transferred' } })
        ]);

        res.json({
            totalIssues,
            pendingIssues,
            approvedIssues,
            rejectedIssues,
            transferredIssues,
            processingRate: totalIssues > 0 ? ((approvedIssues + rejectedIssues + transferredIssues) / totalIssues * 100).toFixed(2) : 0
        });
    } catch (error) {
        console.error('Error fetching issue note stats:', error);
        res.status(500).json({ error: error.message });
    }
};