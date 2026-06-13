const {
    GoodRequestNote,
    GoodRequestNoteItem,
    IssueNote,
    IssueNoteItem,
    Item,
    Location,
    Store,
    User,
    Unit,
    Category,
    sequelize
} = require('../models');
const { Op } = require('sequelize');
const { generateDocumentNumber } = require('./documentControllerClient');

// Create a new Good Request Note with items
exports.createGoodRequestNote = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const {
            requestDate,
            fromLocationId,
            fromStoreId,
            toLocationId,
            toStoreId,
            priority = 'Medium',
            expectedDeliveryDate,
            remarks,
            items
        } = req.body;

        // Validate required fields
        if (!fromLocationId || !fromStoreId || !toLocationId || !toStoreId || !items || !Array.isArray(items)) {
            await t.rollback();
            return res.status(400).json({
                error: 'From/To location, store, and items are required'
            });
        }

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        // Generate request number
        const requestNumber = await generateDocumentNumber('GRN-REQ', fromLocationId);

        // Validate locations and stores exist
        const [fromLocation, fromStore, toLocation, toStore] = await Promise.all([
            Location.findByPk(fromLocationId, { transaction: t }),
            Store.findByPk(fromStoreId, { transaction: t }),
            Location.findByPk(toLocationId, { transaction: t }),
            Store.findByPk(toStoreId, { transaction: t })
        ]);

        if (!fromLocation || !fromStore || !toLocation || !toStore) {
            await t.rollback();
            return res.status(400).json({ error: 'Invalid location or store specified' });
        }

        // Prevent self-transfer
        if (fromLocationId === toLocationId && fromStoreId === toStoreId) {
            await t.rollback();
            return res.status(400).json({ error: 'Cannot request from same location and store' });
        }

        // Create Good Request Note
        const goodRequestNote = await GoodRequestNote.create({
            requestNumber,
            requestDate: requestDate || new Date(),
            fromLocationId,
            fromStoreId,
            toLocationId,
            toStoreId,
            status: 'Pending',
            priority,
            expectedDeliveryDate,
            remarks,
            requestedBy: currentUserId,
            createdBy: currentUserId,
            updatedBy: currentUserId
        }, { transaction: t });

        // Add items
        for (const item of items) {
            if (!item.itemId || !item.requestedQuantity || item.requestedQuantity <= 0) {
                await t.rollback();
                return res.status(400).json({
                    error: 'Each item must have valid itemId and requestedQuantity > 0'
                });
            }

            // Validate item exists
            const itemExists = await Item.findByPk(item.itemId, { transaction: t });
            if (!itemExists) {
                await t.rollback();
                return res.status(400).json({ error: `Item not found: ${item.itemId}` });
            }

            await GoodRequestNoteItem.create({
                goodRequestNoteId: goodRequestNote.id,
                itemId: item.itemId,
                requestedQuantity: item.requestedQuantity,
                approvedQuantity: 0,
                unitId: item.unitId || null,
                estimatedWeight: item.estimatedWeight || null,
                urgency: item.urgency || 'Normal',
                purpose: item.purpose || null,
                remarks: item.remarks || null,
                createdBy: currentUserId,
                updatedBy: currentUserId
            }, { transaction: t });
        }

        await t.commit();

        // Fetch the created record with associations
        const result = await GoodRequestNote.findByPk(goodRequestNote.id, {
            include: [
                { model: Location, as: 'FromLocation', attributes: ['id', 'name'] },
                { model: Store, as: 'FromStore', attributes: ['id', 'name'] },
                { model: Location, as: 'ToLocation', attributes: ['id', 'name'] },
                { model: Store, as: 'ToStore', attributes: ['id', 'name'] },
                { model: User, as: 'RequestedByUser', attributes: ['id', 'username'] },
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                {
                    model: GoodRequestNoteItem,
                    as: 'Items',
                    include: [
                        {
                            model: Item,
                            as: 'Item',
                            include: [
                                { model: Category, attributes: ['id', 'name'] }
                            ]
                        },
                        { model: Unit, as: 'Unit', attributes: ['id', 'name'] }
                    ]
                }
            ]
        });

        res.status(201).json(result);
    } catch (error) {
        await t.rollback();
        console.error('Error creating good request note:', error);
        res.status(400).json({ error: error.message });
    }
};

// Get all Good Request Notes
exports.getAllGoodRequestNotes = async (req, res) => {
    try {
        const {
            status,
            fromLocationId,
            toLocationId,
            priority,
            page = 1,
            limit = 50,
            startDate,
            endDate
        } = req.query;

        const whereConditions = {};
        if (status) whereConditions.status = status;
        if (fromLocationId) whereConditions.fromLocationId = fromLocationId;
        if (toLocationId) whereConditions.toLocationId = toLocationId;
        if (priority) whereConditions.priority = priority;

        if (startDate && endDate) {
            whereConditions.requestDate = {
                [Op.between]: [new Date(startDate), new Date(endDate)]
            };
        }

        const offset = (page - 1) * limit;

        const { count, rows: goodRequestNotes } = await GoodRequestNote.findAndCountAll({
            where: whereConditions,
            include: [
                { model: Location, as: 'FromLocation', attributes: ['id', 'name'] },
                { model: Store, as: 'FromStore', attributes: ['id', 'name'] },
                { model: Location, as: 'ToLocation', attributes: ['id', 'name'] },
                { model: Store, as: 'ToStore', attributes: ['id', 'name'] },
                { model: User, as: 'RequestedByUser', attributes: ['id', 'username'] },
                { model: User, as: 'ApprovedByUser', attributes: ['id', 'username'] },
                {
                    model: GoodRequestNoteItem,
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
                        { model: Unit, as: 'Unit', attributes: ['id', 'name'] }
                    ]
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            goodRequestNotes,
            totalCount: count,
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / limit),
            hasNextPage: (parseInt(page) * parseInt(limit)) < count,
            hasPrevPage: parseInt(page) > 1
        });
    } catch (error) {
        console.error('Error fetching good request notes:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get Good Request Note by ID
exports.getGoodRequestNoteById = async (req, res) => {
    try {
        const { id } = req.params;

        const goodRequestNote = await GoodRequestNote.findByPk(id, {
            include: [
                { model: Location, as: 'FromLocation', attributes: ['id', 'name'] },
                { model: Store, as: 'FromStore', attributes: ['id', 'name'] },
                { model: Location, as: 'ToLocation', attributes: ['id', 'name'] },
                { model: Store, as: 'ToStore', attributes: ['id', 'name'] },
                { model: User, as: 'RequestedByUser', attributes: ['id', 'username'] },
                { model: User, as: 'ApprovedByUser', attributes: ['id', 'username'] },
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] },
                {
                    model: GoodRequestNoteItem,
                    as: 'Items',
                    include: [
                        {
                            model: Item,
                            as: 'Item',
                            include: [
                                { model: Category, attributes: ['id', 'name'] }
                            ]
                        },
                        { model: Unit, as: 'Unit', attributes: ['id', 'name'] }
                    ]
                }
            ]
        });

        if (!goodRequestNote) {
            return res.status(404).json({ error: 'Good Request Note not found' });
        }

        // If converted to issue note, include the issue note details
        if (goodRequestNote.issueNoteId) {
            const issueNote = await IssueNote.findByPk(goodRequestNote.issueNoteId, {
                attributes: ['id', 'issueNumber', 'status', 'createdAt']
            });
            goodRequestNote.dataValues.issueNote = issueNote;
        }

        res.json(goodRequestNote);
    } catch (error) {
        console.error('Error fetching good request note:', error);
        res.status(500).json({ error: error.message });
    }
};

// Update Good Request Note
exports.updateGoodRequestNote = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const {
            priority,
            expectedDeliveryDate,
            remarks,
            items
        } = req.body;

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const goodRequestNote = await GoodRequestNote.findByPk(id, { transaction: t });
        if (!goodRequestNote) {
            await t.rollback();
            return res.status(404).json({ error: 'Good Request Note not found' });
        }

        // Only allow updates for Pending requests
        if (goodRequestNote.status !== 'Pending') {
            await t.rollback();
            return res.status(400).json({
                error: 'Only pending requests can be updated'
            });
        }

        // Update main record
        await goodRequestNote.update({
            priority: priority || goodRequestNote.priority,
            expectedDeliveryDate: expectedDeliveryDate || goodRequestNote.expectedDeliveryDate,
            remarks: remarks || goodRequestNote.remarks,
            updatedBy: currentUserId
        }, { transaction: t });

        // Update items if provided
        if (items && Array.isArray(items)) {
            // Remove existing items
            await GoodRequestNoteItem.destroy({
                where: { goodRequestNoteId: goodRequestNote.id },
                transaction: t
            });

            // Add updated items
            for (const item of items) {
                if (!item.itemId || !item.requestedQuantity || item.requestedQuantity <= 0) {
                    await t.rollback();
                    return res.status(400).json({
                        error: 'Each item must have valid itemId and requestedQuantity > 0'
                    });
                }

                // Validate item exists
                const itemExists = await Item.findByPk(item.itemId, { transaction: t });
                if (!itemExists) {
                    await t.rollback();
                    return res.status(400).json({ error: `Item not found: ${item.itemId}` });
                }

                await GoodRequestNoteItem.create({
                    goodRequestNoteId: goodRequestNote.id,
                    itemId: item.itemId,
                    requestedQuantity: item.requestedQuantity,
                    approvedQuantity: item.approvedQuantity || 0,
                    unitId: item.unitId || null,
                    estimatedWeight: item.estimatedWeight || null,
                    urgency: item.urgency || 'Normal',
                    purpose: item.purpose || null,
                    remarks: item.remarks || null,
                    createdBy: currentUserId,
                    updatedBy: currentUserId
                }, { transaction: t });
            }
        }

        await t.commit();

        // Return updated record
        const updatedGoodRequestNote = await GoodRequestNote.findByPk(id, {
            include: [
                { model: Location, as: 'FromLocation', attributes: ['id', 'name'] },
                { model: Store, as: 'FromStore', attributes: ['id', 'name'] },
                { model: Location, as: 'ToLocation', attributes: ['id', 'name'] },
                { model: Store, as: 'ToStore', attributes: ['id', 'name'] },
                { model: User, as: 'RequestedByUser', attributes: ['id', 'username'] },
                { model: User, as: 'ApprovedByUser', attributes: ['id', 'username'] },
                {
                    model: GoodRequestNoteItem,
                    as: 'Items',
                    include: [
                        {
                            model: Item,
                            as: 'Item',
                            include: [
                                { model: Category, attributes: ['id', 'name'] }
                            ]
                        },
                        { model: Unit, as: 'Unit', attributes: ['id', 'name'] }
                    ]
                }
            ]
        });

        res.json(updatedGoodRequestNote);
    } catch (error) {
        await t.rollback();
        console.error('Error updating good request note:', error);
        res.status(400).json({ error: error.message });
    }
};

// Approve or Reject Good Request Note
exports.approveOrRejectGoodRequestNote = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { status, remarks, itemApprovals } = req.body; // status: 'Approved' or 'Rejected'

        if (!['Approved', 'Rejected'].includes(status)) {
            await t.rollback();
            return res.status(400).json({ error: 'Invalid status. Must be Approved or Rejected.' });
        }

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const goodRequestNote = await GoodRequestNote.findByPk(id, {
            include: [{ model: GoodRequestNoteItem, as: 'Items' }],
            transaction: t
        });

        if (!goodRequestNote) {
            await t.rollback();
            return res.status(404).json({ error: 'Good Request Note not found' });
        }

        if (goodRequestNote.status !== 'Pending') {
            await t.rollback();
            return res.status(400).json({
                error: 'Only pending requests can be approved or rejected'
            });
        }

        // Update main record
        await goodRequestNote.update({
            status,
            approvedBy: currentUserId,
            approvedDate: new Date(),
            remarks: remarks || goodRequestNote.remarks,
            updatedBy: currentUserId
        }, { transaction: t });

        // Update item approved quantities if status is Approved and itemApprovals provided
        if (status === 'Approved' && itemApprovals && Array.isArray(itemApprovals)) {
            for (const itemApproval of itemApprovals) {
                const requestItem = await GoodRequestNoteItem.findOne({
                    where: {
                        goodRequestNoteId: goodRequestNote.id,
                        itemId: itemApproval.itemId
                    },
                    transaction: t
                });

                if (requestItem) {
                    await requestItem.update({
                        approvedQuantity: itemApproval.approvedQuantity || requestItem.requestedQuantity,
                        updatedBy: currentUserId
                    }, { transaction: t });
                }
            }
        }

        await t.commit();

        // If approved, automatically create Issue Note (this will be handled by a separate endpoint)
        let issueNote = null;
        if (status === 'Approved') {
            // This will trigger the conversion to Issue Note
            try {
                const issueNoteResult = await this.convertToIssueNote(goodRequestNote.id, currentUserId);
                issueNote = issueNoteResult;
            } catch (issueError) {
                console.error('Error auto-creating issue note:', issueError);
                // Continue with approval even if issue note creation fails
            }
        }

        const result = await GoodRequestNote.findByPk(id, {
            include: [
                { model: Location, as: 'FromLocation', attributes: ['id', 'name'] },
                { model: Store, as: 'FromStore', attributes: ['id', 'name'] },
                { model: Location, as: 'ToLocation', attributes: ['id', 'name'] },
                { model: Store, as: 'ToStore', attributes: ['id', 'name'] },
                { model: User, as: 'RequestedByUser', attributes: ['id', 'username'] },
                { model: User, as: 'ApprovedByUser', attributes: ['id', 'username'] },
                {
                    model: GoodRequestNoteItem,
                    as: 'Items',
                    include: [
                        {
                            model: Item,
                            as: 'Item',
                            include: [
                                { model: Category, attributes: ['id', 'name'] }
                            ]
                        },
                        { model: Unit, as: 'Unit', attributes: ['id', 'name'] }
                    ]
                }
            ]
        });

        res.json({
            message: `Good Request Note ${status.toLowerCase()} successfully`,
            goodRequestNote: result,
            issueNote: issueNote
        });
    } catch (error) {
        await t.rollback();
        console.error('Error approving good request note:', error);
        res.status(400).json({ error: error.message });
    }
};

// Convert Approved Good Request Note to Issue Note (internal function)
exports.convertToIssueNote = async (goodRequestNoteId, currentUserId) => {
    const t = await sequelize.transaction();
    try {
        const goodRequestNote = await GoodRequestNote.findByPk(goodRequestNoteId, {
            include: [{ model: GoodRequestNoteItem, as: 'Items' }],
            transaction: t
        });

        if (!goodRequestNote || goodRequestNote.status !== 'Approved') {
            await t.rollback();
            throw new Error('Good Request Note must be approved to convert to Issue Note');
        }

        // Generate issue number
        const issueNumber = await generateDocumentNumber('ISSUE', goodRequestNote.toLocationId);

        // Create Issue Note
        const issueNote = await IssueNote.create({
            issueNumber,
            issueDate: new Date(),
            goodRequestNoteId: goodRequestNote.id,
            fromLocationId: goodRequestNote.toLocationId, // Reverse: issuing from the requested location
            fromStoreId: goodRequestNote.toStoreId,
            toLocationId: goodRequestNote.fromLocationId, // Reverse: issuing to the requesting location
            toStoreId: goodRequestNote.fromStoreId,
            status: 'Pending',
            issuedBy: currentUserId,
            deliveryExpectedDate: goodRequestNote.expectedDeliveryDate,
            remarks: `Auto-generated from Good Request Note: ${goodRequestNote.requestNumber}`,
            createdBy: currentUserId,
            updatedBy: currentUserId
        }, { transaction: t });

        // Create Issue Note Items
        for (const requestItem of goodRequestNote.Items) {
            await IssueNoteItem.create({
                issueNoteId: issueNote.id,
                goodRequestNoteItemId: requestItem.id,
                itemId: requestItem.itemId,
                requestedQuantity: requestItem.requestedQuantity,
                issuedQuantity: requestItem.approvedQuantity,
                actualIssuedQuantity: 0,
                unitId: requestItem.unitId,
                estimatedWeight: requestItem.estimatedWeight,
                remarks: requestItem.remarks,
                createdBy: currentUserId,
                updatedBy: currentUserId
            }, { transaction: t });
        }

        // Update Good Request Note status and link to Issue Note
        await goodRequestNote.update({
            status: 'Converted_to_Issue',
            issueNoteId: issueNote.id,
            updatedBy: currentUserId
        }, { transaction: t });

        await t.commit();

        return issueNote;
    } catch (error) {
        await t.rollback();
        throw error;
    }
};

// Delete Good Request Note
exports.deleteGoodRequestNote = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;

        const goodRequestNote = await GoodRequestNote.findByPk(id, { transaction: t });
        if (!goodRequestNote) {
            await t.rollback();
            return res.status(404).json({ error: 'Good Request Note not found' });
        }

        // Only allow deletion of Pending requests
        if (goodRequestNote.status !== 'Pending') {
            await t.rollback();
            return res.status(400).json({
                error: 'Only pending requests can be deleted'
            });
        }

        // Delete associated items first
        await GoodRequestNoteItem.destroy({
            where: { goodRequestNoteId: goodRequestNote.id },
            transaction: t
        });

        // Delete the main record
        await goodRequestNote.destroy({ transaction: t });

        await t.commit();
        res.json({ message: 'Good Request Note deleted successfully' });
    } catch (error) {
        await t.rollback();
        console.error('Error deleting good request note:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get statistics for Good Request Notes
exports.getGoodRequestNoteStats = async (req, res) => {
    try {
        const { locationId } = req.query;

        const whereCondition = locationId ?
            { [Op.or]: [{ fromLocationId: locationId }, { toLocationId: locationId }] } :
            {};

        const [totalRequests, pendingRequests, approvedRequests, rejectedRequests, convertedRequests] = await Promise.all([
            GoodRequestNote.count({ where: whereCondition }),
            GoodRequestNote.count({ where: { ...whereCondition, status: 'Pending' } }),
            GoodRequestNote.count({ where: { ...whereCondition, status: 'Approved' } }),
            GoodRequestNote.count({ where: { ...whereCondition, status: 'Rejected' } }),
            GoodRequestNote.count({ where: { ...whereCondition, status: 'Converted_to_Issue' } })
        ]);

        res.json({
            totalRequests,
            pendingRequests,
            approvedRequests,
            rejectedRequests,
            convertedRequests,
            processingRate: totalRequests > 0 ? ((approvedRequests + rejectedRequests + convertedRequests) / totalRequests * 100).toFixed(2) : 0
        });
    } catch (error) {
        console.error('Error fetching good request note stats:', error);
        res.status(500).json({ error: error.message });
    }
};