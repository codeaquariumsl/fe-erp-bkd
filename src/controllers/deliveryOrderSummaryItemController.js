const DeliveryOrderSummaryItem = require('../models/deliveryOrderSummaryItem');
const DeliveryOrderSummary = require('../models/deliveryOrderSummary');
const DeliveryOrder = require('../models/deliveryOrder');
const DeliveryOrderItem = require('../models/deliveryOrderItem');
const Item = require('../models/item');
const Route = require('../models/route');
const Store = require('../models/store');
const Stock = require('../models/stock');
const StockDetail = require('../models/stockDetail');
const SalesOrder = require('../models/salesOrder');
const { sequelize, Customer, Batch, BatchItem } = require('../models');
const { Op } = require('sequelize');
const { generateDocumentNumber } = require('./documentControllerClient');

// ===============================
// HELPER FUNCTIONS FOR BATCH MANAGEMENT
// ===============================

/**
 * Check availability of batches for a customer and item
 * @param {number} customerId - Customer ID
 * @param {number} itemId - Item ID
 * @param {number} requiredQty - Required quantity
 * @param {object} transaction - Sequelize transaction
 * @returns {object} Availability information
 */
const checkBatchAvailability = async (customerId, itemId, requiredQty, transaction) => {
    try {
        // Find all active batches for the item
        const batches = await Batch.findAll({
            include: [{
                model: BatchItem,
                as: 'BatchItems',
                where: { itemId: itemId },
                required: true
            }],
            where: { isActive: true },
            transaction: transaction
        });

        let totalQuantity = 0;
        const batchDetails = [];

        for (const batch of batches) {
            for (const batchItem of batch.BatchItems) {
                const availableQty = (batchItem.availableQuantity || 0) - (batchItem.reservedQuantity || 0);
                if (availableQty > 0) {
                    totalQuantity += availableQty;
                    batchDetails.push({
                        batchId: batch.id,
                        batchNumber: batch.batchNumber,
                        availableQty: availableQty,
                        reservedQty: batchItem.reservedQuantity || 0,
                        batchItemId: batchItem.id
                    });
                }
            }
        }

        return {
            canFulfill: totalQuantity >= requiredQty,
            totalQuantity: totalQuantity,
            requiredQty: requiredQty,
            batches: batchDetails,
            batchCount: batchDetails.length
        };
    } catch (error) {
        console.error('Error checking batch availability:', error);
        throw new Error(`Failed to check batch availability: ${error.message}`);
    }
};

/**
 * Find and reserve a batch for a delivery order item
 * @param {number} customerId - Customer ID
 * @param {number} itemId - Item ID
 * @param {number} requiredQty - Required quantity
 * @param {object} transaction - Sequelize transaction
 * @param {boolean} allowFallback - Allow partial fulfillment
 * @returns {object} Reservation result
 */
const findAndReserveBatch = async (customerId, itemId, requiredQty, transaction, allowFallback = false) => {
    try {
        // Check availability
        const availability = await checkBatchAvailability(customerId, itemId, requiredQty, transaction);

        if (!availability.batches || availability.batches.length === 0) {
            throw new Error(`No batches available for item ${itemId}`);
        }

        // Sort batches by available quantity (descending) to prefer fuller batches
        const sortedBatches = availability.batches.sort((a, b) => b.availableQty - a.availableQty);

        let selectedBatchId = null;
        let reservedQty = 0;
        let remainingQty = requiredQty;
        const reservationUpdates = [];
        let isPartial = false;

        // Try to fulfill from single batch first
        for (const batch of sortedBatches) {
            if (batch.availableQty >= requiredQty) {
                selectedBatchId = batch.batchId;
                reservedQty = requiredQty;
                remainingQty = 0;

                // Update batch item with reservation
                await BatchItem.update(
                    { reservedQuantity: (batch.reservedQty || 0) + reservedQty },
                    { where: { id: batch.batchItemId }, transaction: transaction }
                );

                reservationUpdates.push({
                    batchItemId: batch.batchItemId,
                    batchId: selectedBatchId,
                    previousReserved: batch.reservedQty || 0,
                    newReserved: (batch.reservedQty || 0) + reservedQty
                });

                console.log(`Successfully fulfilled from single batch ${selectedBatchId}`);
                break;
            }
        }

        // If no single batch can fulfill and fallback is enabled, use partial fulfillment
        if (remainingQty > 0 && allowFallback) {
            console.log(`No single batch can fulfill ${requiredQty}. Attempting partial fulfillment...`);
            isPartial = true;
            selectedBatchId = sortedBatches[0].batchId;
            reservedQty = 0;

            for (const batch of sortedBatches) {
                if (remainingQty <= 0) break;

                const reserveFromThisBatch = Math.min(remainingQty, batch.availableQty);
                if (reserveFromThisBatch > 0) {
                    reservedQty += reserveFromThisBatch;
                    remainingQty -= reserveFromThisBatch;

                    // Update batch item with reservation
                    await BatchItem.update(
                        { reservedQuantity: (batch.reservedQty || 0) + reserveFromThisBatch },
                        { where: { id: batch.batchItemId }, transaction: transaction }
                    );

                    reservationUpdates.push({
                        batchItemId: batch.batchItemId,
                        batchId: batch.batchId,
                        previousReserved: batch.reservedQty || 0,
                        newReserved: (batch.reservedQty || 0) + reserveFromThisBatch,
                        reservedQty: reserveFromThisBatch
                    });

                    console.log(`Reserved ${reserveFromThisBatch} from batch ${batch.batchId}, remaining: ${remainingQty}`);
                }
            }
        } else if (remainingQty > 0) {
            throw new Error(`Insufficient stock: Required ${requiredQty}, available ${requiredQty - remainingQty}, remaining ${remainingQty}`);
        }

        return {
            selectedBatchId: selectedBatchId,
            reservedQty: reservedQty,
            remainingQty: remainingQty,
            isPartial: isPartial,
            reservationUpdates: reservationUpdates
        };
    } catch (error) {
        console.error('Error finding and reserving batch:', error);
        throw error;
    }
};

// Create Delivery Order Summary with Items
exports.createDeliveryOrderSummary = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        console.log('Request body:', JSON.stringify(req.body, null, 2));

        const { orderIds, items, locationId } = req.body;
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;

        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        console.log('Current user ID:', currentUserId);

        if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
            await t.rollback();
            return res.status(400).json({ error: 'orderIds array is required' });
        }

        // First, find all delivery orders to get their route IDs and locationId
        const deliveryOrders = await DeliveryOrder.findAll({
            where: { id: { [Op.in]: orderIds } },
            attributes: ['id', 'routeId', 'locationId'],
            transaction: t
        });

        if (deliveryOrders.length === 0) {
            await t.rollback();
            return res.status(404).json({ error: 'No delivery orders found for the provided orderIds' });
        }

        const routeIds = [...new Set(deliveryOrders.map(order => order.routeId))].filter(Boolean);
        console.log('Route IDs from orders:', routeIds);

        // Get locationId from request body or from the first delivery order
        let finalLocationId = locationId;
        if (!finalLocationId) {
            finalLocationId = deliveryOrders[0].locationId;
            console.log('LocationId not provided in request, using from delivery order:', finalLocationId);
        }

        if (!finalLocationId) {
            await t.rollback();
            return res.status(400).json({ error: 'locationId is required either in request body or delivery orders must have locationId' });
        }

        // Look for existing active summary from today that isn't dispatched
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        let deliveryOrderSummary = await DeliveryOrderSummary.findOne({
            where: {
                dateTime: {
                    [Op.gte]: today,
                    [Op.lt]: tomorrow
                },
                isDispatched: false,
                isActive: true
            },
            include: [{
                model: DeliveryOrderSummaryItem,
                as: 'SummaryItems',
                where: {
                    routeId: { [Op.in]: routeIds }
                },
                attributes: ['id', 'deliveryOrderSummaryId', 'routeId', 'deliveryOrderId', 'deliveryOrderItemId', 'itemId', 'batchId', 'releaseStoreId', 'qty', 'isReady', 'isReleased', 'isActive', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy'],
                required: true
            }],
            transaction: t
        });

        console.log('Found existing summary:', deliveryOrderSummary ? deliveryOrderSummary.id : 'none');

        // If no existing summary found, create a new one
        let summaryCode;
        if (!deliveryOrderSummary) {
            // Generate summary code
            try {
                summaryCode = await generateDocumentNumber('DOS', finalLocationId);
                console.log('Generated new summary code:', summaryCode);
            } catch (error) {
                console.error('Error generating document number:', error);
                await t.rollback();
                return res.status(500).json({
                    error: 'Failed to generate summary code',
                    details: error.message
                });
            }


            // Create new Delivery Order Summary
            try {
                deliveryOrderSummary = await DeliveryOrderSummary.create({
                    code: summaryCode,
                    dateTime: new Date(),
                    isDispatched: false,
                    isActive: true,
                    locationId: finalLocationId,
                    createdBy: currentUserId,
                    updatedBy: currentUserId
                }, { transaction: t });
                console.log('Created new delivery order summary:', deliveryOrderSummary.id);
            } catch (error) {
                console.error('Error creating delivery order summary:', error);
                await t.rollback();
                return res.status(500).json({
                    error: 'Failed to create delivery order summary',
                    details: error.message
                });
            }
        } else {
            console.log('Using existing summary:', deliveryOrderSummary.id, 'for new orders');
        }

        // Find all delivery order items for the given orderIds - simplified query first
        console.log('Searching for delivery order items with orderIds:', orderIds);

        const deliveryOrderItems = await DeliveryOrderItem.findAll({
            where: {
                deliveryOrderId: { [Op.in]: orderIds }
            },
            // Remove includes temporarily to avoid association issues
            transaction: t
        });

        console.log('Found delivery order items:', deliveryOrderItems.length);

        if (deliveryOrderItems.length === 0) {
            // Let's also check if the delivery orders exist at all
            const deliveryOrders = await DeliveryOrder.findAll({
                where: { id: { [Op.in]: orderIds } },
                transaction: t
            });

            console.log('Found delivery orders:', deliveryOrders.length);

            await t.rollback();
            return res.status(400).json({
                error: 'No delivery order items found for the provided orderIds',
                orderIds: orderIds,
                deliveryOrdersFound: deliveryOrders.length,
                debug: 'Check if delivery orders exist and have items'
            });
        }

        // Create delivery order summary items with Batch assignment
        const summaryItemsToCreate = [];
        const batchReservationResults = [];

        for (const doItem of deliveryOrderItems) {
            console.log('Processing delivery order item:', doItem.id, 'for delivery order:', doItem.deliveryOrderId);

            // Get delivery order with customer info and route info
            const deliveryOrder = await DeliveryOrder.findByPk(doItem.deliveryOrderId, {
                attributes: ['routeId', 'customerId'],
                transaction: t
            });

            if (!deliveryOrder) {
                await t.rollback();
                return res.status(400).json({
                    error: `Delivery order not found for item ${doItem.id}`,
                    deliveryOrderId: doItem.deliveryOrderId
                });
            }

            const routeId = deliveryOrder.routeId;
            const customerId = deliveryOrder.customerId;

            console.log('Route ID:', routeId, 'Customer ID:', customerId, 'for delivery order:', doItem.deliveryOrderId);

            // Find and reserve batch for this item and customer
            let selectedBatchId = null;
            let reservationResult = null;
            let releaseStoreId = null;  // Will be set from DeliveryOrderItem.storeId or batch's storeId

            try {
                // Check if DeliveryOrderItem already has a batchId assigned
                if (doItem.batchId) {
                    console.log(`DeliveryOrderItem ${doItem.id} already has batchId ${doItem.batchId} assigned. Using it.`);
                    selectedBatchId = doItem.batchId;

                    // Find the batch item to reserve quantity and get storeId
                    const batchItem = await BatchItem.findOne({
                        where: {
                            batchId: doItem.batchId,
                            itemId: doItem.itemId,
                            isActive: true
                        },
                        include: [{
                            model: Batch,
                            as: 'Batch',
                            attributes: ['id', 'storeId']
                        }],
                        transaction: t
                    });

                    if (!batchItem) {
                        throw new Error(`Batch item not found for batchId ${doItem.batchId} and itemId ${doItem.itemId}`);
                    }

                    // Prioritize storeId from DeliveryOrderItem, fall back to batch's storeId
                    releaseStoreId = doItem.storeId || batchItem.Batch?.storeId;
                    if (!releaseStoreId) {
                        throw new Error(`Neither DeliveryOrderItem nor Batch ${doItem.batchId} has a storeId`);
                    }

                    console.log(`Using releaseStoreId: ${releaseStoreId} (from ${doItem.storeId ? 'DeliveryOrderItem' : 'Batch'})`);

                    // Check if there's sufficient available quantity
                    const effectiveAvailable = (batchItem.availableQuantity || 0) - (batchItem.reservedQuantity || 0);
                    if (effectiveAvailable < doItem.qty) {
                        throw new Error(`Insufficient quantity in assigned batch ${doItem.batchId}. Available: ${effectiveAvailable}, Required: ${doItem.qty}`);
                    }

                    // Reserve the quantity
                    await BatchItem.update(
                        { reservedQuantity: (batchItem.reservedQuantity || 0) + doItem.qty },
                        { where: { id: batchItem.id }, transaction: t }
                    );

                    console.log(`Reserved ${doItem.qty} from pre-assigned batch ${doItem.batchId}, storeId: ${releaseStoreId}`);

                    reservationResult = {
                        selectedBatchId: doItem.batchId,
                        reservedQty: doItem.qty,
                        remainingQty: 0,
                        isPartial: false,
                        releaseStoreId: releaseStoreId,
                        reservationUpdates: [{
                            batchItemId: batchItem.id,
                            batchId: doItem.batchId,
                            previousReserved: batchItem.reservedQuantity || 0,
                            newReserved: (batchItem.reservedQuantity || 0) + doItem.qty,
                            reservedQty: doItem.qty
                        }]
                    };

                    batchReservationResults.push({
                        deliveryOrderItemId: doItem.id,
                        customerId: customerId,
                        itemId: doItem.itemId,
                        requiredQty: doItem.qty,
                        selectedBatchId: selectedBatchId,
                        reservedQty: doItem.qty,
                        remainingQty: 0,
                        isPartial: false,
                        preAssigned: true,
                        releaseStoreId: releaseStoreId,
                        reservationUpdates: reservationResult.reservationUpdates
                    });

                } else {
                    // No batchId assigned, find and reserve a batch automatically
                    console.log(`Finding Batch for customer ${customerId}, item ${doItem.itemId}, quantity ${doItem.qty}`);

                    // First check availability for diagnostics
                    const availability = await checkBatchAvailability(customerId, doItem.itemId, doItem.qty, t);

                    if (availability && !availability.canFulfill) {
                        console.log(`WARNING: Not enough total stock available. Available: ${availability.totalQuantity}, Required: ${doItem.qty}`);
                    }

                    // Try to reserve with fallback enabled
                    reservationResult = await findAndReserveBatch(customerId, doItem.itemId, doItem.qty, t, true);
                    selectedBatchId = reservationResult.selectedBatchId;

                    // Prioritize storeId from DeliveryOrderItem, fall back to batch's storeId
                    if (doItem.storeId) {
                        releaseStoreId = doItem.storeId;
                        console.log(`Using releaseStoreId from DeliveryOrderItem: ${releaseStoreId}`);
                    } else if (selectedBatchId) {
                        const selectedBatch = await Batch.findByPk(selectedBatchId, {
                            attributes: ['id', 'storeId'],
                            transaction: t
                        });
                        releaseStoreId = selectedBatch?.storeId;
                        console.log(`Using releaseStoreId from Batch: ${releaseStoreId}`);
                    }

                    console.log(`Successfully reserved Batch ${selectedBatchId} for delivery order item ${doItem.id}${reservationResult.isPartial ? ' (PARTIAL)' : ''}, storeId: ${releaseStoreId}`);

                    batchReservationResults.push({
                        deliveryOrderItemId: doItem.id,
                        customerId: customerId,
                        itemId: doItem.itemId,
                        requiredQty: doItem.qty,
                        selectedBatchId: selectedBatchId,
                        reservedQty: reservationResult.reservedQty,
                        remainingQty: reservationResult.remainingQty,
                        isPartial: reservationResult.isPartial,
                        preAssigned: false,
                        releaseStoreId: releaseStoreId,
                        reservationUpdates: reservationResult.reservationUpdates,
                        availability: availability
                    });
                }

            } catch (error) {
                console.error(`Error finding/reserving Batch for delivery order item ${doItem.id}:`, error);

                // Get availability info for the error report (only if not pre-assigned)
                let availability = null;
                if (!doItem.batchId) {
                    try {
                        availability = await checkBatchAvailability(customerId, doItem.itemId, doItem.qty, t);
                    } catch (availError) {
                        console.error('Error checking availability:', availError);
                    }
                }

                // Log the error but continue without Batch assignment
                // This allows the summary to be created even if some items don't have available Batches
                console.log(`Continuing without Batch assignment for delivery order item ${doItem.id}`);

                batchReservationResults.push({
                    deliveryOrderItemId: doItem.id,
                    customerId: customerId,
                    itemId: doItem.itemId,
                    requiredQty: doItem.qty,
                    selectedBatchId: null,
                    reservedQty: 0,
                    remainingQty: doItem.qty,
                    isPartial: false,
                    preAssigned: doItem.batchId ? true : false,
                    releaseStoreId: null,
                    error: error.message,
                    reservationUpdates: [],
                    availability: availability
                });
            }


            summaryItemsToCreate.push({
                deliveryOrderSummaryId: deliveryOrderSummary.id,
                routeId: routeId,
                deliveryOrderId: doItem.deliveryOrderId,
                deliveryOrderItemId: doItem.id,
                itemId: doItem.itemId,
                batchId: selectedBatchId,
                releaseStoreId: releaseStoreId,  // Now using storeId from batch
                qty: doItem.qty,
                isReady: false,
                isReleased: false,
                isActive: true,
                createdBy: currentUserId,
                updatedBy: currentUserId
            });
        }

        console.log('Summary items to create:', summaryItemsToCreate.length);
        console.log('Batch reservations made:', batchReservationResults.length);

        // Bulk create summary items
        try {
            await DeliveryOrderSummaryItem.bulkCreate(summaryItemsToCreate, { transaction: t });
            console.log('Successfully created summary items');
        } catch (error) {
            console.error('Error creating summary items:', error);
            await t.rollback();
            return res.status(500).json({
                error: 'Failed to create delivery order summary items',
                details: error.message,
                itemsToCreate: summaryItemsToCreate
            });
        }

        // Update DeliveryOrder status to "Scheduled" for all orderIds
        try {
            const updateResult = await DeliveryOrder.update(
                { status: 'Scheduled' },
                {
                    where: { id: { [Op.in]: orderIds } },
                    transaction: t
                }
            );
            console.log('Updated delivery orders to Scheduled status:', updateResult[0]);
        } catch (error) {
            console.error('Error updating delivery order status:', error);
            await t.rollback();
            return res.status(500).json({
                error: 'Failed to update delivery order status to Scheduled',
                details: error.message
            });
        }

        // Fetch complete summary with items for response (BEFORE committing transaction)
        let createdSummary;
        try {
            createdSummary = await DeliveryOrderSummary.findByPk(deliveryOrderSummary.id, {
                include: [
                    {
                        model: DeliveryOrderSummaryItem,
                        as: 'SummaryItems',
                        attributes: ['id', 'deliveryOrderSummaryId', 'routeId', 'deliveryOrderId', 'deliveryOrderItemId', 'itemId', 'batchId', 'releaseStoreId', 'qty', 'isReady', 'isReleased', 'isActive', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy'],
                        include: [
                            { model: DeliveryOrder, as: 'DeliveryOrder', attributes: ['id', 'doNumber'] },
                            { model: Item, as: 'Item', attributes: ['id', 'name', 'sku'] },
                            { model: Route, as: 'Route', attributes: ['id', 'routeName'] },
                            { model: Batch, as: 'Batch', attributes: ['id', 'batchNumber'] }
                        ]
                    }
                ],
                transaction: t
            });
        } catch (error) {
            console.error('Error fetching created summary:', error);
            await t.rollback();
            return res.status(500).json({
                error: 'Failed to fetch created delivery order summary',
                details: error.message,
                summaryId: deliveryOrderSummary.id
            });
        }

        await t.commit();

        // Enhanced response to include Batch assignment results and availability info
        const successfulBatchAssignments = batchReservationResults.filter(result => result.selectedBatchId !== null).length;
        const failedBatchAssignments = batchReservationResults.filter(result => result.selectedBatchId === null).length;
        const partialBatchAssignments = batchReservationResults.filter(result => result.isPartial === true).length;

        res.status(201).json({
            message: 'Delivery Order Summary created successfully',
            summary: createdSummary,
            code: summaryCode,
            itemsCreated: summaryItemsToCreate.length,
            deliveryOrdersUpdated: orderIds.length,
            deliveryOrderStatus: 'Scheduled',
            batchAssignments: {
                total: batchReservationResults.length,
                successful: successfulBatchAssignments,
                failed: failedBatchAssignments,
                partial: partialBatchAssignments,
                details: batchReservationResults
            }
        });

    } catch (error) {
        // Only rollback if transaction is still active
        try {
            if (t && !t.finished) {
                await t.rollback();
            }
        } catch (rollbackError) {
            console.error('Error rolling back transaction:', rollbackError);
        }
        console.error('Error creating delivery order summary:', error);
        res.status(500).json({
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            requestBody: req.body
        });
    }
};

// Manual Batch assignment for delivery order summary items
exports.assignBatchToSummaryItem = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { summaryItemId, batchId, qty } = req.body;
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;

        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        if (!summaryItemId || !batchId) {
            await t.rollback();
            return res.status(400).json({ error: 'summaryItemId and batchId are required' });
        }

        console.log(`Manual Batch assignment: Summary Item ${summaryItemId}, Batch ${batchId}, Qty: ${qty || 'original'}`);

        // Get the summary item
        const summaryItem = await DeliveryOrderSummaryItem.findByPk(summaryItemId, {
            include: [
                { model: Item, as: 'Item', attributes: ['id', 'name', 'sku'] }
            ],
            transaction: t
        });

        if (!summaryItem) {
            await t.rollback();
            return res.status(404).json({ error: 'Delivery Order Summary Item not found' });
        }

        const reserveQty = qty || summaryItem.qty;

        // Check if the Batch item exists and has sufficient quantity
        const batchItem = await BatchItem.findOne({
            where: {
                batchId: batchId,
                itemId: summaryItem.itemId
            },
            include: [{ model: Batch, as: 'Batch', attributes: ['id', 'batchNumber', 'status'] }],
            transaction: t
        });

        if (!batchItem) {
            await t.rollback();
            return res.status(404).json({
                error: `Batch item not found for Batch ${batchId} and item ${summaryItem.itemId}`
            });
        }

        if (batchItem.Batch.status !== 'Approved' && batchItem.Batch.status !== 'QC Checked') {
            await t.rollback();
            return res.status(400).json({
                error: `Batch ${batchId} is not approved (status: ${batchItem.Batch.status})`
            });
        }

        const effectiveAvailable = batchItem.availableQty - (batchItem.reservedQty || 0);
        if (effectiveAvailable < reserveQty) {
            await t.rollback();
            return res.status(400).json({
                error: `Insufficient quantity in Batch ${batchId}. Available: ${effectiveAvailable}, Required: ${reserveQty}`
            });
        }

        // If there was a previous Batch assignment, release that reservation first
        if (summaryItem.batchId && summaryItem.batchId !== batchId) {
            const previousBatchItem = await BatchItem.findOne({
                where: {
                    batchId: summaryItem.batchId,
                    itemId: summaryItem.itemId
                },
                transaction: t
            });

            if (previousBatchItem) {
                const releaseQty = summaryItem.qty; // Release the original quantity
                await BatchItem.update(
                    {
                        reservedQty: Math.max(0, (previousBatchItem.reservedQty || 0) - releaseQty)
                    },
                    {
                        where: { id: previousBatchItem.id },
                        transaction: t
                    }
                );
                console.log(`Released ${releaseQty} from previous Batch ${summaryItem.batchId}`);
            }
        }

        // Reserve the new quantity
        await BatchItem.update(
            {
                reservedQty: (batchItem.reservedQty || 0) + reserveQty
            },
            {
                where: { id: batchItem.id },
                transaction: t
            }
        );

        // Update the summary item
        await summaryItem.update({
            batchId: batchId,
            qty: reserveQty,
            updatedBy: currentUserId
        }, { transaction: t });

        await t.commit();

        // Fetch updated summary item
        const updatedSummaryItem = await DeliveryOrderSummaryItem.findByPk(summaryItemId, {
            include: [
                { model: Item, as: 'Item', attributes: ['id', 'name', 'sku'] },
                { model: Batch, as: 'Batch', attributes: ['id', 'batchNumber'] }
            ]
        });

        res.json({
            message: 'Batch assigned successfully',
            summaryItem: updatedSummaryItem,
            assignment: {
                previousBatchId: summaryItem.batchId,
                newBatchId: batchId,
                reservedQty: reserveQty,
                batchItemAvailableAfter: effectiveAvailable - reserveQty
            }
        });

    } catch (error) {
        await t.rollback();
        console.error('Error in manual Batch assignment:', error);
        res.status(500).json({
            error: 'Failed to assign Batch to summary item',
            details: error.message
        });
    }
};

// Get All Delivery Order Summaries
exports.getAllDeliveryOrderSummaries = async (req, res) => {
    try {
        const { page = 1, limit = 10, isActive = true, isDispatched, dateFrom, dateTo, locationId, releaseStoreId } = req.query;
        const offset = (page - 1) * limit;

        // Build where clause
        const whereClause = {};
        if (isActive !== undefined) whereClause.isActive = isActive;
        if (isDispatched !== undefined) whereClause.isDispatched = isDispatched == 'true' ? true : false;

        if (dateFrom || dateTo) {
            whereClause.dateTime = {};
            if (dateFrom) whereClause.dateTime[Op.gte] = new Date(dateFrom);
            if (dateTo) whereClause.dateTime[Op.lte] = new Date(dateTo);
        }

        if (locationId) whereClause.locationId = locationId;

        if (req.query.search) {
            const searchTerm = req.query.search;

            // Find summary IDs where the associated customer name matches
            const matchingSummaryIds = (await DeliveryOrderSummaryItem.findAll({
                include: [{
                    model: DeliveryOrder,
                    as: 'DeliveryOrder',
                    required: true,
                    include: [{
                        model: SalesOrder,
                        required: true,
                        include: [{
                            model: Customer,
                            where: { name: { [Op.like]: `%${searchTerm}%` } },
                            required: true
                        }]
                    }]
                }],
                attributes: ['deliveryOrderSummaryId'],
                raw: true
            })).map(si => si.deliveryOrderSummaryId);

            whereClause[Op.or] = [
                { code: { [Op.like]: `%${searchTerm}%` } },
                { id: { [Op.in]: matchingSummaryIds } }
            ];
        }

        const { count, rows: summaries } = await DeliveryOrderSummary.findAndCountAll({
            where: whereClause,
            distinct: true,
            include: [
                {
                    model: DeliveryOrderSummaryItem,
                    as: 'SummaryItems',
                    where: { isActive: true },
                    required: false,
                    include: [
                        {
                            model: DeliveryOrder,
                            as: 'DeliveryOrder',
                            attributes: ['id', 'doNumber', 'status'],
                            include: [{
                                model: SalesOrder,
                                attributes: ['id', 'orderNumber', 'isDelivery', 'dispatchDate', 'timeslot'],
                                include: [Customer]
                            }]
                        },
                        { model: Item, as: 'Item', attributes: ['id', 'name', 'sku', 'barcode', 'unit'] },
                        { model: Route, as: 'Route', attributes: ['id', 'routeName'] },
                        { model: Batch, as: 'Batch', attributes: ['id', 'batchNumber'] },
                        { model: Store, as: 'ReleaseStore', attributes: ['id', 'name'] }
                    ]
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        // Find active batches with items for matching
        const approvedBatches = await Batch.findAll({
            include: [{
                model: BatchItem,
                as: 'BatchItems',
                required: true
            }],
            where: { isActive: true }
        });

        // Group batches by itemId for easy lookup
        const batchesByItemId = {};
        approvedBatches.forEach(batch => {
            for (const batchItem of batch.BatchItems) {
                const itemId = batchItem.itemId;
                if (!batchesByItemId[itemId]) {
                    batchesByItemId[itemId] = [];
                }
                batchesByItemId[itemId].push({
                    batchId: batch.id,
                    batchNumber: batch.batchNumber,
                    batchQty: (batchItem.availableQuantity || 0) - (batchItem.reservedQuantity || 0),
                });
            }
        });

        // Enhance summaries with Batch lists for each summary item and merge same items
        const enhancedSummaries = summaries.map(summary => {
            if (summary.SummaryItems && summary.SummaryItems.length > 0) {
                // First, group summary items by itemId and merge quantities
                const itemGroups = {};
                summary.SummaryItems.forEach(summaryItem => {
                    const itemId = summaryItem.itemId;

                    if (!itemGroups[itemId]) {
                        const summaryItemJson = summaryItem.toJSON();
                        // Extract delivery info including isDelivery status
                        const deliveryOrder = summaryItem.DeliveryOrder || {};
                        const salesOrder = deliveryOrder.SalesOrder || {};
                        const customer = salesOrder.Customer || {};

                        itemGroups[itemId] = {
                            ...summaryItemJson,
                            totalQty: 0,
                            summaryItemIds: [],
                            deliveryOrderIds: new Set(),
                            deliveryOrders: new Map(), // Store delivery order details
                            isReadyCount: 0,
                            isReleasedCount: 0,
                            totalItems: 0,
                            delivery: {
                                isDelivery: salesOrder.isDelivery || false,
                                timeslot: salesOrder.timeslot,
                                dispatchDate: salesOrder.dispatchDate,
                                customer: {
                                    id: customer.id,
                                    name: customer.name
                                }
                            }
                        };
                    }

                    // Merge quantities and track related data
                    itemGroups[itemId].totalQty += summaryItem.qty || 0;
                    itemGroups[itemId].summaryItemIds.push(summaryItem.id);
                    itemGroups[itemId].deliveryOrderIds.add(summaryItem.deliveryOrderId);

                    // Store delivery order details
                    if (summaryItem.DeliveryOrder) {
                        itemGroups[itemId].deliveryOrders.set(summaryItem.deliveryOrderId, {
                            id: summaryItem.DeliveryOrder.id,
                            doNumber: summaryItem.DeliveryOrder.doNumber
                        });
                    }

                    itemGroups[itemId].totalItems++;

                    if (summaryItem.isReady) itemGroups[itemId].isReadyCount++;
                    if (summaryItem.isReleased) itemGroups[itemId].isReleasedCount++;

                    // Keep the latest/most relevant data for other fields
                    if (summaryItem.batchId) itemGroups[itemId].batchId = summaryItem.batchId;
                    if (summaryItem.releaseStoreId) itemGroups[itemId].releaseStoreId = summaryItem.releaseStoreId;
                });

                // Convert grouped items back to array and enhance with Batch data
                const enhancedSummaryItems = Object.values(itemGroups).map(mergedItem => {
                    const itemId = mergedItem.itemId;
                    console.log(`Item ${itemId}: merged qty = ${mergedItem.totalQty} from ${mergedItem.totalItems} summary items`);

                    // Find all Batches available for this item from bay store
                    const availableBatches = batchesByItemId[itemId] || [];

                    // Group Batches by batchId to avoid duplicates and sum quantities
                    const batchSummary = {};
                    availableBatches.forEach(batch => {
                        if (!batchSummary[batch.batchId]) {
                            batchSummary[batch.batchId] = {
                                batchId: batch.batchId,
                                batchNumber: batch.batchNumber,
                                totalAvailableQty: 0,
                            };
                        }
                        batchSummary[batch.batchId].totalAvailableQty += batch.batchQty;
                    });

                    // Filter Batches to only include those that can fulfill the merged quantity
                    const canFulfillBatches = Object.values(batchSummary).filter(batch =>
                        batch.totalAvailableQty >= mergedItem.totalQty
                    );

                    return {
                        ...mergedItem,
                        qty: mergedItem.totalQty, // Use merged quantity
                        deliveryOrderIds: Array.from(mergedItem.deliveryOrderIds),
                        deliveryOrders: Array.from(mergedItem.deliveryOrders.values()), // Convert Map to Array
                        allItemsReady: mergedItem.isReadyCount === mergedItem.totalItems,
                        allItemsReleased: mergedItem.isReleasedCount === mergedItem.totalItems,
                        partiallyReady: mergedItem.isReadyCount > 0 && mergedItem.isReadyCount < mergedItem.totalItems,
                        partiallyReleased: mergedItem.isReleasedCount > 0 && mergedItem.isReleasedCount < mergedItem.totalItems,
                        readyPercentage: Math.round((mergedItem.isReadyCount / mergedItem.totalItems) * 100),
                        releasedPercentage: Math.round((mergedItem.isReleasedCount / mergedItem.totalItems) * 100),
                        bayStoreBatchList: canFulfillBatches,
                        totalAvailableFromBay: canFulfillBatches.reduce((sum, batch) => sum + batch.totalAvailableQty, 0),
                        canFulfillFromBay: true, //canFulfillBatches.length > 0,
                        mergeInfo: {
                            originalItemsCount: mergedItem.totalItems,
                            mergedQty: mergedItem.totalQty,
                            summaryItemIds: mergedItem.summaryItemIds,
                            deliveryOrdersCount: mergedItem.deliveryOrders.size
                        }
                    };
                });

                return {
                    ...summary.toJSON(),
                    SummaryItems: enhancedSummaryItems,
                    mergeStats: {
                        originalItemsCount: summary.SummaryItems.length,
                        mergedItemsCount: enhancedSummaryItems.length,
                        itemsMerged: summary.SummaryItems.length - enhancedSummaryItems.length
                    }
                };
            }
            return summary.toJSON();
        });

        // Add status counts for summary
        const statusCounts = await DeliveryOrderSummary.findAll({
            where: { isActive: true, ...(locationId && { locationId }) },
            attributes: [
                'isDispatched',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            group: ['isDispatched']
        });

        const summaryStats = {
            total: 0,
            dispatched: 0,
            pending: 0
        };

        statusCounts.forEach(sc => {
            const isDispatched = sc.get('isDispatched');
            const c = parseInt(sc.get('count'));
            if (isDispatched) summaryStats.dispatched = c;
            else summaryStats.pending = c;
            summaryStats.total += c;
        });

        res.json({
            summaries: enhancedSummaries,
            // bayStoreInfo: {
            statusCounts: summaryStats,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(count / limit),
                totalItems: count,
                itemsPerPage: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('Error in getAllDeliveryOrderSummaries:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get Delivery Order Summary by ID
exports.getDeliveryOrderSummaryById = async (req, res) => {
    try {
        const { id } = req.params;

        const summary = await DeliveryOrderSummary.findByPk(id, {
            include: [
                {
                    model: DeliveryOrderSummaryItem,
                    as: 'SummaryItems',
                    where: { isActive: true },
                    required: false,
                    include: [
                        {
                            model: DeliveryOrder,
                            as: 'DeliveryOrder',
                            attributes: ['id', 'doNumber', 'status'],
                            include: [
                                { model: SalesOrder, attributes: ['id', 'orderNumber'] }
                            ]
                        },
                        { model: DeliveryOrderItem, as: 'DeliveryOrderItem', attributes: ['id', 'qty'] },
                        { model: Item, as: 'Item', attributes: ['id', 'name', 'sku', 'color', 'country'] },
                        { model: Route, as: 'Route', attributes: ['id', 'routeName'] },
                        { model: Batch, as: 'Batch', attributes: ['id', 'batchNumber'] },
                        { model: Store, as: 'ReleaseStore', attributes: ['id', 'name'] }
                    ]
                }
            ]
        });

        if (!summary) {
            return res.status(404).json({ error: 'Delivery Order Summary not found' });
        }

        res.json(summary);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update Delivery Order Summary
exports.updateDeliveryOrderSummary = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { dateTime, isDispatched, isActive } = req.body;
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;

        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const summary = await DeliveryOrderSummary.findByPk(id, { transaction: t });
        if (!summary) {
            await t.rollback();
            return res.status(404).json({ error: 'Delivery Order Summary not found' });
        }

        // Update summary
        const updateData = { updatedBy: currentUserId };
        if (dateTime !== undefined) updateData.dateTime = dateTime;
        if (isDispatched !== undefined) updateData.isDispatched = isDispatched;
        if (isActive !== undefined) updateData.isActive = isActive;

        await summary.update(updateData, { transaction: t });

        await t.commit();

        // Fetch updated summary with items
        const updatedSummary = await DeliveryOrderSummary.findByPk(id, {
            include: [
                {
                    model: DeliveryOrderSummaryItem,
                    as: 'SummaryItems',
                    where: { isActive: true },
                    required: false,
                    include: [
                        { model: DeliveryOrder, as: 'DeliveryOrder', attributes: ['id', 'doNumber'] },
                        { model: Item, as: 'Item', attributes: ['id', 'name', 'sku'] },
                        { model: Route, as: 'Route', attributes: ['id', 'routeName'] }
                    ]
                }
            ]
        });

        res.json({
            message: 'Delivery Order Summary updated successfully',
            summary: updatedSummary
        });

    } catch (error) {
        await t.rollback();
        res.status(500).json({ error: error.message });
    }
};

// Delete Delivery Order Summary
exports.deleteDeliveryOrderSummary = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;

        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const summary = await DeliveryOrderSummary.findByPk(id, { transaction: t });
        if (!summary) {
            await t.rollback();
            return res.status(404).json({ error: 'Delivery Order Summary not found' });
        }

        // Soft delete - mark as inactive
        await summary.update({
            isActive: false,
            updatedBy: currentUserId
        }, { transaction: t });

        // Also mark related summary items as inactive
        await DeliveryOrderSummaryItem.update(
            { isActive: false, updatedBy: currentUserId },
            {
                where: { deliveryOrderSummaryId: id },
                transaction: t
            }
        );

        await t.commit();

        res.json({
            message: 'Delivery Order Summary deleted successfully',
            deletedSummaryId: id
        });

    } catch (error) {
        await t.rollback();
        res.status(500).json({ error: error.message });
    }
};

// ===============================
// DELIVERY ORDER SUMMARY ITEM CRUD OPERATIONS
// ===============================

// Get Delivery Order Summary Item by ID
exports.getDeliveryOrderSummaryItemById = async (req, res) => {
    try {
        const { id } = req.params;

        const summaryItem = await DeliveryOrderSummaryItem.findByPk(id, {
            include: [
                { model: DeliveryOrderSummary, as: 'DeliveryOrderSummary' },
                {
                    model: DeliveryOrder,
                    as: 'DeliveryOrder',
                    attributes: ['id', 'doNumber', 'status'],
                    include: [
                        { model: SalesOrder, attributes: ['id', 'orderNumber'] }
                    ]
                },
                { model: DeliveryOrderItem, as: 'DeliveryOrderItem', attributes: ['id', 'qty'] },
                { model: Item, as: 'Item', attributes: ['id', 'name', 'sku', 'color', 'country'] },
                { model: Route, as: 'Route', attributes: ['id', 'routeName'] },
                { model: Batch, as: 'Batch', attributes: ['id', 'batchNumber'] },
                { model: Store, as: 'ReleaseStore', attributes: ['id', 'name'] }
            ]
        });

        if (!summaryItem) {
            return res.status(404).json({ error: 'Delivery Order Summary Item not found' });
        }

        res.json(summaryItem);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update Delivery Order Summary Item
exports.updateDeliveryOrderSummaryItem = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const {
            batchId,
            releaseStoreId,
            palletRackId,
            qty,
            isReady,
            isReleased,
            isActive
        } = req.body;
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;

        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const summaryItem = await DeliveryOrderSummaryItem.findByPk(id, { transaction: t });
        if (!summaryItem) {
            await t.rollback();
            return res.status(404).json({ error: 'Delivery Order Summary Item not found' });
        }

        // Update summary item
        const updateData = { updatedBy: currentUserId };
        if (batchId !== undefined) updateData.batchId = batchId;
        if (releaseStoreId !== undefined) updateData.releaseStoreId = releaseStoreId;
        if (palletRackId !== undefined) updateData.palletRackId = palletRackId;
        if (qty !== undefined) updateData.qty = qty;
        if (isReady !== undefined) updateData.isReady = isReady;
        if (isReleased !== undefined) updateData.isReleased = isReleased;
        if (isActive !== undefined) updateData.isActive = isActive;

        await summaryItem.update(updateData, { transaction: t });

        await t.commit();

        // Fetch updated summary item with relations
        const updatedSummaryItem = await DeliveryOrderSummaryItem.findByPk(id, {
            include: [
                { model: DeliveryOrderSummary, as: 'DeliveryOrderSummary' },
                { model: DeliveryOrder, as: 'DeliveryOrder', attributes: ['id', 'doNumber'] },
                { model: Item, as: 'Item', attributes: ['id', 'name', 'sku'] },
                { model: Route, as: 'Route', attributes: ['id', 'routeName'] },
                { model: Batch, as: 'Batch', attributes: ['id', 'batchNumber'] },
                { model: Store, as: 'ReleaseStore', attributes: ['id', 'name'] }
            ]
        });

        res.json({
            message: 'Delivery Order Summary Item updated successfully',
            summaryItem: updatedSummaryItem
        });

    } catch (error) {
        await t.rollback();
        res.status(500).json({ error: error.message });
    }
};

// Delete Delivery Order Summary Item
exports.deleteDeliveryOrderSummaryItem = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;

        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const summaryItem = await DeliveryOrderSummaryItem.findByPk(id, { transaction: t });
        if (!summaryItem) {
            await t.rollback();
            return res.status(404).json({ error: 'Delivery Order Summary Item not found' });
        }

        // Soft delete - mark as inactive
        await summaryItem.update({
            isActive: false,
            updatedBy: currentUserId
        }, { transaction: t });

        await t.commit();

        res.json({
            message: 'Delivery Order Summary Item deleted successfully',
            deletedItemId: id
        });

    } catch (error) {
        await t.rollback();
        res.status(500).json({ error: error.message });
    }
};

// ===============================
// ADDITIONAL UTILITY METHODS
// ===============================

// Get Summary Items by Route and Date
exports.getDeliveryOrderSummaryByRoute = async (req, res) => {
    try {
        const { routeId, date, status } = req.query;

        // Build where clause
        const whereClause = { isActive: true };
        if (routeId) whereClause.routeId = routeId;

        // Handle date filtering
        if (date) {
            const startDate = new Date(date);
            const endDate = new Date(date);
            endDate.setDate(endDate.getDate() + 1);

            whereClause.createdAt = {
                [Op.gte]: startDate,
                [Op.lt]: endDate
            };
        }

        const summaryItems = await DeliveryOrderSummaryItem.findAll({
            where: whereClause,
            include: [
                { model: DeliveryOrderSummary, as: 'DeliveryOrderSummary' },
                {
                    model: DeliveryOrder,
                    as: 'DeliveryOrder',
                    where: status ? { status } : {},
                    include: [
                        { model: SalesOrder, attributes: ['id', 'orderNumber'] }
                    ]
                },
                { model: Item, as: 'Item', attributes: ['id', 'name', 'sku', 'color', 'country'] },
                { model: Route, as: 'Route', attributes: ['id', 'routeName'] },
                { model: Batch, as: 'Batch', attributes: ['id', 'batchNumber'] },
                { model: Store, as: 'ReleaseStore', attributes: ['id', 'name'] }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Group by route for better organization
        const routeGroups = {};
        for (const item of summaryItems) {
            const routeKey = item.routeId || 'unassigned';
            if (!routeGroups[routeKey]) {
                routeGroups[routeKey] = {
                    routeId: item.routeId,
                    routeName: item.Route ? item.Route.routeName : 'Unassigned',
                    items: [],
                    totalItems: 0,
                    readyItems: 0,
                    releasedItems: 0
                };
            }

            routeGroups[routeKey].items.push(item);
            routeGroups[routeKey].totalItems++;
            if (item.isReady) routeGroups[routeKey].readyItems++;
            if (item.isReleased) routeGroups[routeKey].releasedItems++;
        }

        res.json({
            filter: { routeId, date, status },
            summary: {
                totalRoutes: Object.keys(routeGroups).length,
                totalItems: summaryItems.length,
                readyItems: summaryItems.filter(item => item.isReady).length,
                releasedItems: summaryItems.filter(item => item.isReleased).length
            },
            routes: Object.values(routeGroups)
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Bulk Update Summary Items (for batch operations like marking as ready/released)
exports.bulkUpdateSummaryItems = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { itemIds, updateData } = req.body;
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;

        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
            await t.rollback();
            return res.status(400).json({ error: 'itemIds array is required' });
        }

        if (!updateData || typeof updateData !== 'object') {
            await t.rollback();
            return res.status(400).json({ error: 'updateData object is required' });
        }

        // Add updatedBy to updateData
        updateData.updatedBy = currentUserId;

        // Update multiple items
        const [updatedCount] = await DeliveryOrderSummaryItem.update(
            updateData,
            {
                where: {
                    id: { [Op.in]: itemIds },
                    isActive: true
                },
                transaction: t
            }
        );

        await t.commit();

        res.json({
            message: 'Summary items updated successfully',
            updatedCount,
            itemIds,
            updateData
        });

    } catch (error) {
        await t.rollback();
        res.status(500).json({ error: error.message });
    }
};

// Dispatch delivery order summary (mark as dispatched and update items )
exports.dispatchDeliveryOrderSummary = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        console.log('Dispatch request body:', JSON.stringify(req.body, null, 2));

        const { summaryId, items } = req.body;
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;

        // Validation
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        if (!summaryId) {
            await t.rollback();
            return res.status(400).json({ error: 'summaryId is required' });
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            await t.rollback();
            return res.status(400).json({ error: 'items array is required' });
        }

        // Check if delivery order summary exists
        const deliveryOrderSummary = await DeliveryOrderSummary.findOne({
            where: { id: summaryId, isActive: true },
            transaction: t
        });

        if (!deliveryOrderSummary) {
            await t.rollback();
            return res.status(404).json({ error: 'Delivery order summary not found' });
        }

        // Check if already dispatched
        if (deliveryOrderSummary.isDispatched) {
            await t.rollback();
            return res.status(400).json({
                error: 'Delivery order summary is already dispatched',
                summaryId,
                currentStatus: 'dispatched'
            });
        }

        // Update delivery order summary to dispatched
        await DeliveryOrderSummary.update(
            {
                isDispatched: true,
                updatedBy: currentUserId,
                dispatchedAt: new Date()
            },
            {
                where: { id: summaryId },
                transaction: t
            }
        );

        console.log('Updated delivery order summary to dispatched:', summaryId);

        // Update each delivery order summary item
        const updatePromises = items.map(async (item) => {
            // Validate that the item belongs to this summary
            const summaryItem = await DeliveryOrderSummaryItem.findOne({
                where: {
                    id: item.id,
                    deliveryOrderSummaryId: summaryId,
                    isActive: true
                },
                transaction: t
            });

            if (!summaryItem) {
                throw new Error(`Summary item with id ${item.id} not found or doesn't belong to summary ${summaryId}`);
            }
            console.log('Summary item releaseStoreId:', summaryItem.releaseStoreId);
            if (!summaryItem.releaseStoreId) {
                summaryItem.releaseStoreId = 1;
            }
            // Check stock availability at the release store
            const releaseStoreStock = await Stock.findOne({
                where: {
                    itemId: summaryItem.itemId,
                    storeId: summaryItem.releaseStoreId
                },
                transaction: t
            });

            const availableStockQty = releaseStoreStock ? (releaseStoreStock.availableQty || 0) : 0;
            console.log(`Checking stock for item ${summaryItem.itemId} at store ${summaryItem.releaseStoreId}: available ${availableStockQty}, required ${summaryItem.qty}`);

            if (availableStockQty < summaryItem.qty) {
                throw new Error(`Insufficient stock at release store: Available: ${availableStockQty}, Required: ${summaryItem.qty} for item ${summaryItem.itemId}`);
            }

            // Deduct stock from release store and create StockDetail record
            await Stock.update(
                {
                    availableQty: availableStockQty - summaryItem.qty,
                    updatedBy: currentUserId
                },
                {
                    where: { id: releaseStoreStock.id },
                    transaction: t
                }
            );

            console.log(`Deducted ${summaryItem.qty} stock from store ${summaryItem.releaseStoreId} for item ${summaryItem.itemId}`);

            // Create StockDetail record for the stock deduction
            await StockDetail.create(
                {
                    stockId: releaseStoreStock.id,
                    documentType: 'Delivery-Dispatch',
                    documentId: summaryItem.deliveryOrderId,
                    inOut: 'OUT',
                    qty: summaryItem.qty,
                    date: new Date(),
                    remark: `Dispatched for Delivery Order ${summaryItem.deliveryOrderId} (Summary ${summaryId})`,
                    createdBy: currentUserId,
                    updatedBy: currentUserId
                },
                { transaction: t }
            );

            console.log(`Created StockDetail record for stock deduction: stockId ${releaseStoreStock.id}, qty ${summaryItem.qty}`);

            // Update the summary item
            const [updatedCount] = await DeliveryOrderSummaryItem.update(
                {
                    batchId: item.batchId,
                    isReady: true,
                    updatedBy: currentUserId
                },
                {
                    where: { id: item.id },
                    transaction: t
                }
            );

            console.log(`Updated summary item ${item.id}, updatedCount: ${updatedCount}`);

            // Transfer dispatched qty to vehicle stock if delivery order has vehicleId
            const deliveryOrder = await DeliveryOrder.findByPk(summaryItem.deliveryOrderId, { transaction: t });
            if (deliveryOrder && deliveryOrder.vehicleId) {
                // Find or create stock for vehicle
                // let vehicleStock = await Stock.findOne({
                //     where: {
                //         itemId: summaryItem.itemId,
                //         lorryId: deliveryOrder.vehicleId
                //     },
                //     transaction: t
                // });

                // if (vehicleStock) {
                //     await vehicleStock.update({
                //         availableQty: (vehicleStock.availableQty || 0) + summaryItem.qty,
                //         updatedBy: currentUserId
                //     }, { transaction: t });
                // } else {
                //     vehicleStock = await Stock.create({
                //         itemId: summaryItem.itemId,
                //         lorryId: deliveryOrder.vehicleId,
                //         availableQty: summaryItem.qty,
                //         locationId: deliveryOrder.locationId,
                //         createdBy: currentUserId,
                //         updatedBy: currentUserId
                //     }, { transaction: t });
                // }

                // Create StockDetail record for vehicle stock IN
                // await StockDetail.create(
                //     {
                //         stockId: vehicleStock.id,
                //         documentType: 'Delivery-Dispatch',
                //         documentId: summaryItem.deliveryOrderId,
                //         inOut: 'IN',
                //         qty: summaryItem.qty,
                //         date: new Date(),
                //         remark: `Loaded to vehicle ${deliveryOrder.vehicleId} for Delivery Order ${summaryItem.deliveryOrderId} (Summary ${summaryId})`,
                //         createdBy: currentUserId,
                //         updatedBy: currentUserId
                //     },
                //     { transaction: t }
                // );

                console.log(`Transferred ${summaryItem.qty} of item ${summaryItem.itemId} to vehicle stock for vehicleId ${deliveryOrder.vehicleId}`);
            }

            return {
                itemId: item.id,
                batchId: item.batchId,
                summaryItemQty: summaryItem.qty,
                releaseStoreId: summaryItem.releaseStoreId,
                stockDeducted: summaryItem.qty,
                updated: updatedCount > 0
            };
        });

        const updateResults = await Promise.all(updatePromises);

        // Check if all delivery orders in this summary have all their items ready
        // and update delivery order status to 'Dispatched' if so
        const deliveryOrderIds = [...new Set(items.map(item => {
            const summaryItem = updateResults.find(result => result.itemId === item.id);
            return summaryItem ? summaryItem.deliveryOrderId : null;
        }).filter(Boolean))];

        // Get all delivery order IDs from summary items in this summary
        const allSummaryItems = await DeliveryOrderSummaryItem.findAll({
            where: {
                deliveryOrderSummaryId: summaryId,
                isActive: true
            },
            attributes: ['deliveryOrderId'],
            transaction: t
        });

        const allDeliveryOrderIds = [...new Set(allSummaryItems.map(item => item.deliveryOrderId))];

        console.log('Checking delivery orders for dispatch status:', allDeliveryOrderIds);

        const deliveryOrderStatusUpdates = [];

        for (const deliveryOrderId of allDeliveryOrderIds) {
            // Get delivery order with sales order information to check isDelivery flag
            const deliveryOrderWithSalesOrder = await DeliveryOrder.findByPk(deliveryOrderId, {
                include: [{
                    model: SalesOrder,
                    attributes: ['id', 'orderNumber', 'isDelivery']
                }],
                transaction: t
            });

            // Check if all delivery order items for this delivery order are ready
            const allItemsForDeliveryOrder = await DeliveryOrderSummaryItem.findAll({
                where: {
                    deliveryOrderId: deliveryOrderId,
                    isActive: true
                },
                transaction: t
            });

            const allItemsReady = allItemsForDeliveryOrder.every(item => item.isReady === true);
            const isPickupOrder = deliveryOrderWithSalesOrder &&
                deliveryOrderWithSalesOrder.SalesOrder &&
                deliveryOrderWithSalesOrder.SalesOrder.isDelivery === false;

            console.log(`Delivery Order ${deliveryOrderId}: ${allItemsForDeliveryOrder.length} items, all ready: ${allItemsReady}, isPickupOrder: ${isPickupOrder}`);

            if (allItemsReady && allItemsForDeliveryOrder.length > 0) {
                let finalStatus = 'Dispatched'; // In Transit , Finalized , Delivered
                let statusMessage = 'All items ready for dispatch';

                // For pickup orders (isDelivery=false), automatically set isReleased=true and status to 'Delivered'
                if (isPickupOrder) {
                    // Update all summary items to released for pickup orders
                    await DeliveryOrderSummaryItem.update(
                        {
                            isReleased: true,
                            updatedBy: currentUserId
                        },
                        {
                            where: {
                                deliveryOrderId: deliveryOrderId,
                                isActive: true
                            },
                            transaction: t
                        }
                    );

                    finalStatus = 'Delivered';
                    statusMessage = 'Pickup order - automatically released and Delivered';
                    console.log(`Pickup order ${deliveryOrderId}: Set all items to released and status to Delivered`);
                }

                // Update delivery order status
                const [updatedDeliveryOrderCount] = await DeliveryOrder.update(
                    {
                        status: finalStatus,
                        deliveryDate: finalStatus == "Delivered" ? new Date() : null,
                        updatedBy: currentUserId
                    },
                    {
                        where: { id: deliveryOrderId },
                        transaction: t
                    }
                );

                console.log(`Updated delivery order ${deliveryOrderId} status to '${finalStatus}'`);

                deliveryOrderStatusUpdates.push({
                    deliveryOrderId,
                    previousStatus: 'Scheduled',
                    newStatus: finalStatus,
                    totalItems: allItemsForDeliveryOrder.length,
                    updated: updatedDeliveryOrderCount > 0,
                    isPickupOrder: isPickupOrder,
                    statusMessage: statusMessage,
                    autoReleased: isPickupOrder
                });
            }
        }

        await t.commit();

        console.log('Dispatch completed successfully for summary:', summaryId);

        res.json({
            message: 'Delivery order summary dispatched successfully',
            summaryId,
            isDispatched: true,
            dispatchedAt: new Date(),
            itemsUpdated: updateResults,
            deliveryOrdersUpdated: deliveryOrderStatusUpdates,
            totalItemsProcessed: items.length,
            totalDeliveryOrdersChecked: allDeliveryOrderIds.length
        });

    } catch (error) {
        await t.rollback();
        console.error('Dispatch error:', error);
        res.status(500).json({
            error: 'Failed to dispatch delivery order summary',
            message: error.message
        });
    }
};

// Get Delivery Order Summary Items by Driver ID
exports.getDeliveryOrderSummaryItemsByDriverId = async (req, res) => {
    try {
        const { driverId } = req.params;
        console.log('Getting delivery order summary items for driver ID:', driverId);

        // Validate driver exists
        const Driver = require('../models/driver');
        const driver = await Driver.findByPk(driverId, {
            attributes: ['id', 'name', 'mobile', 'status']
        });

        if (!driver) {
            return res.status(404).json({
                error: 'Driver not found',
                driverId: driverId
            });
        }

        console.log('Found driver:', driver.name);

        // Find all dispatched delivery orders for this driver
        const dispatchedDeliveryOrders = await DeliveryOrder.findAll({
            where: {
                driverId: driverId,
                status: 'Dispatched'
            },
            attributes: ['id', 'doNumber', 'orderDate', 'deliveryDate', 'deliveryAddress', 'status'],
            include: [
                {
                    model: SalesOrder,
                    attributes: ['id', 'orderNumber'],
                    // include: [
                    //     { 
                    //         model: require('../models/customer'), 
                    //         attributes: ['id', 'name', 'email', 'mobile'] 
                    //     }
                    // ]
                },
                {
                    model: Route,
                    attributes: ['id', 'routeName', 'city', 'startPoint', 'endPoint']
                },
                {
                    model: require('../models/vehicle'),
                    attributes: ['id', 'vehicleNumber', 'vehicleType']
                }
            ]
        });

        console.log('Found dispatched delivery orders:', dispatchedDeliveryOrders.length);

        if (dispatchedDeliveryOrders.length === 0) {
            return res.json({
                message: 'No dispatched delivery orders found for this driver',
                driver: driver,
                dispatchedDeliveryOrders: [],
                groupedSummaryItems: []
            });
        }

        // Extract delivery order IDs
        const deliveryOrderIds = dispatchedDeliveryOrders.map(order => order.id);
        console.log('Delivery order IDs:', deliveryOrderIds);

        // Find all delivery order summary items that are ready for these delivery orders
        const summaryItems = await DeliveryOrderSummaryItem.findAll({
            where: {
                deliveryOrderId: { [Op.in]: deliveryOrderIds },
                isReady: true,
                isActive: true
            },
            include: [
                {
                    model: DeliveryOrderSummary,
                    as: 'DeliveryOrderSummary',
                    attributes: ['id', 'code', 'dateTime', 'isDispatched']
                },
                {
                    model: DeliveryOrder,
                    as: 'DeliveryOrder',
                    attributes: ['id', 'doNumber', 'orderDate', 'deliveryDate', 'deliveryAddress', 'status'],
                    include: [
                        {
                            model: SalesOrder,
                            attributes: ['id', 'orderNumber'],
                            // include: [
                            //     { 
                            //         model: require('../models/customer'), 
                            //         attributes: ['id', 'name', 'email', 'mobile'] 
                            //     }
                            // ]
                        }
                    ]
                },
                {
                    model: DeliveryOrderItem,
                    as: 'DeliveryOrderItem',
                    attributes: ['id', 'qty']
                },
                {
                    model: Item,
                    as: 'Item',
                    attributes: ['id', 'name', 'sku', 'color', 'country', 'unit'],
                    include: [
                        {
                            model: require('../models/category'),
                            attributes: ['id', 'name']
                        }
                    ]
                },
                {
                    model: Route,
                    as: 'Route',
                    attributes: ['id', 'routeName', 'city', 'startPoint', 'endPoint']
                },
                {
                    model: Batch,
                    as: 'Batch',
                    attributes: ['id', 'batchNumber', 'batchDate']
                },
                {
                    model: Store,
                    as: 'ReleaseStore',
                    attributes: ['id', 'name']
                }
            ],
            order: [
                ['deliveryOrderId', 'ASC'],
                ['itemId', 'ASC'],
                ['id', 'ASC']
            ]
        });

        console.log('Found ready summary items:', summaryItems.length);

        // Group summary items by delivery order for better organization
        const groupedSummaryItems = {};
        const itemsSummary = {
            totalItems: summaryItems.length,
            totalDeliveryOrders: 0,
            totalQuantity: 0,
            uniqueItems: new Set(),
            readyItemsByOrder: {}
        };

        for (const summaryItem of summaryItems) {
            const deliveryOrderId = summaryItem.deliveryOrderId;
            const itemData = summaryItem.toJSON();

            // Initialize group for this delivery order if not exists
            if (!groupedSummaryItems[deliveryOrderId]) {
                groupedSummaryItems[deliveryOrderId] = {
                    deliveryOrder: itemData.DeliveryOrder,
                    items: [],
                    summary: {
                        totalItems: 0,
                        totalQuantity: 0,
                        readyItems: 0,
                        uniqueItems: new Set()
                    }
                };
                itemsSummary.totalDeliveryOrders++;
                itemsSummary.readyItemsByOrder[deliveryOrderId] = 0;
            }

            // Add item to group
            groupedSummaryItems[deliveryOrderId].items.push(itemData);
            groupedSummaryItems[deliveryOrderId].summary.totalItems++;
            groupedSummaryItems[deliveryOrderId].summary.totalQuantity += itemData.qty || 0;
            groupedSummaryItems[deliveryOrderId].summary.readyItems++;
            groupedSummaryItems[deliveryOrderId].summary.uniqueItems.add(itemData.itemId);

            // Update overall summary
            itemsSummary.totalQuantity += itemData.qty || 0;
            itemsSummary.uniqueItems.add(itemData.itemId);
            itemsSummary.readyItemsByOrder[deliveryOrderId]++;
        }

        // Convert grouped data to array format and clean up Sets
        const groupedSummaryItemsArray = Object.values(groupedSummaryItems).map(group => ({
            ...group,
            summary: {
                ...group.summary,
                uniqueItems: group.summary.uniqueItems.size
            }
        }));

        // Clean up sets in overall summary
        itemsSummary.uniqueItems = itemsSummary.uniqueItems.size;

        console.log('Grouped summary items by delivery order:', Object.keys(groupedSummaryItems).length);

        res.json({
            message: 'Delivery order summary items retrieved successfully',
            // driver: driver,
            // dispatchedDeliveryOrders: dispatchedDeliveryOrders,
            groupedSummaryItems: groupedSummaryItemsArray,
            summary: {
                driverId: parseInt(driverId),
                driverName: driver.name,
                totalDispatchedOrders: dispatchedDeliveryOrders.length,
                totalReadySummaryItems: summaryItems.length,
                totalDeliveryOrdersWithReadyItems: itemsSummary.totalDeliveryOrders,
                totalQuantityReady: itemsSummary.totalQuantity,
                uniqueItemsReady: itemsSummary.uniqueItems,
                readyItemsPerOrder: itemsSummary.readyItemsByOrder
            }
        });

    } catch (error) {
        console.error('Error getting delivery order summary items by driver ID:', error);
        res.status(500).json({
            error: 'Failed to get delivery order summary items by driver ID',
            details: error.message,
            driverId: req.params.driverId
        });
    }
};

// Get Delivery Order Summaries grouped by timeslot for current dispatch
exports.getDeliveryOrderSummariesByTimeslot = async (req, res) => {
    const bayStoreId = 2;// this is already defined bay store id.
    try {
        // Helper function to convert time string (HH:MM) to minutes
        const timeToMinutes = (timeStr) => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + minutes;
        };

        const { date, routeId, currentTime } = req.body;
        const currentDate = date || new Date().toISOString().split('T')[0];
        const checkTime = currentTime || new Date().toTimeString().slice(0, 5); // HH:MM format

        console.log('Getting delivery order summaries by timeslot for date:', currentDate, 'time:', checkTime);

        // Build date range for filtering
        const startDate = new Date(currentDate);
        const endDate = new Date(currentDate);
        endDate.setDate(endDate.getDate() + 1);

        console.log('Date filter range:', {
            searchDate: currentDate,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
        });

        // Build where clause for DeliveryOrderSummaryItem
        const summaryItemWhere = {
            isActive: true,
            isReady: false,
            isReleased: false
        };

        if (routeId) {
            summaryItemWhere.routeId = routeId;
        }

        // First, find delivery orders that match our criteria
        console.log('Searching for delivery orders with criteria:', {
            isDelivery: true,
            dispatchDateRange: `${startDate.toISOString()} to ${endDate.toISOString()}`,
            hasTimeslot: true
        });

        const validDeliveryOrders = await DeliveryOrder.findAll({
            attributes: ['id'],
            include: [
                {
                    model: SalesOrder,
                    attributes: ['id', 'dispatchDate', 'timeslot'],
                    where: {
                        // isDelivery: true, // Only delivery orders (not pickup)
                        dispatchDate: {
                            [Op.gte]: startDate,
                            [Op.lt]: endDate
                        },
                        timeslot: { [Op.ne]: null } // Must have timeslot
                    }, include: [Customer]
                }
            ]
        });

        const validDeliveryOrderIds = validDeliveryOrders.map(order => order.id);
        console.log('Valid delivery order IDs found:', validDeliveryOrderIds.length);

        // Log some sample sales orders that were found
        if (validDeliveryOrders.length > 0) {
            console.log('Sample valid delivery orders:', validDeliveryOrders.slice(0, 3).map(order => ({
                id: order.id,
                salesOrder: {
                    id: order.SalesOrder.id,
                    dispatchDate: order.SalesOrder.dispatchDate,
                    timeslot: order.SalesOrder.timeslot
                }
            })));
        }

        if (validDeliveryOrderIds.length === 0) {
            // Let's also check what sales orders exist without the date filter to debug
            console.log('No valid delivery orders found. Checking all sales orders with timeslots...');

            const allSalesOrdersWithTimeslots = await SalesOrder.findAll({
                attributes: ['id', 'dispatchDate', 'timeslot', 'isDelivery'],
                where: {
                    // isDelivery: true,
                    timeslot: { [Op.ne]: null }
                },
                limit: 5
            });

            console.log('Sample sales orders with timeslots:', allSalesOrdersWithTimeslots.map(so => ({
                id: so.id,
                dispatchDate: so.dispatchDate,
                timeslot: so.timeslot,
                isDelivery: so.isDelivery
            })));

            return res.json({
                message: 'No delivery orders found matching the criteria (isDelivery=true, valid date, has timeslot)',
                filter: { date: currentDate, routeId, currentTime: checkTime },
                // debug: {
                //     searchDateRange: `${startDate.toISOString()} to ${endDate.toISOString()}`,
                //     sampleSalesOrders: allSalesOrdersWithTimeslots.map(so => ({
                //         id: so.id,
                //         dispatchDate: so.dispatchDate,
                //         timeslot: so.timeslot,
                //         isDelivery: so.isDelivery
                //     }))
                // },
                timeslotGroups: [],
                summary: {
                    totalTimeslots: 0,
                    totalDeliveryOrders: 0,
                    totalItems: 0,
                    currentTimeslot: null
                }
            });
        }

        // Add delivery order filter to summary items
        summaryItemWhere.deliveryOrderId = { [Op.in]: validDeliveryOrderIds };

        // Find all delivery order summary items with related data
        const summaryItems = await DeliveryOrderSummaryItem.findAll({
            where: summaryItemWhere,
            include: [
                {
                    model: DeliveryOrderSummary,
                    as: 'DeliveryOrderSummary',
                    where: {
                        isActive: true,
                        isDispatched: false
                    },
                    attributes: ['id', 'code', 'dateTime', 'isDispatched', 'createdAt']
                },
                {
                    model: DeliveryOrder,
                    as: 'DeliveryOrder',
                    attributes: ['id', 'doNumber', 'status', 'deliveryDate', 'deliveryAddress', 'routeId', 'driverId', 'vehicleId'],
                    include: [
                        {
                            model: SalesOrder,
                            attributes: ['id', 'orderNumber', 'isDelivery', 'dispatchDate', 'timeslot'],
                            required: false, // Left join to ensure we get the sales order
                            include: [Customer]
                        },
                        {
                            model: Route,
                            attributes: ['id', 'routeName', 'city', 'startPoint', 'endPoint'],
                            required: false
                        },
                        {
                            model: require('../models/driver'),
                            attributes: ['id', 'name', 'mobile'],
                            required: false
                        },
                        {
                            model: require('../models/vehicle'),
                            attributes: ['id', 'vehicleNumber', 'vehicleType'],
                            required: false
                        }
                    ]
                },
                {
                    model: Item,
                    as: 'Item',
                    attributes: ['id', 'name', 'color', 'country', 'sku', 'unit', 'weight'],
                    include: [
                        {
                            model: require('../models/category'),
                            attributes: ['id', 'name'],
                            required: false
                        }
                    ],
                    required: false
                },
                {
                    model: Batch,
                    as: 'Batch',
                    attributes: ['id', 'batchNumber', 'batchDate'],
                    required: false
                }
            ],
            order: [
                ['deliveryOrderId', 'ASC'],
                ['itemId', 'ASC']
            ]
        });

        console.log('Found summary items:', summaryItems.length);

        if (summaryItems.length === 0) {
            return res.json({
                message: 'No delivery order summary items found for the given criteria',
                filter: { date: currentDate, routeId, currentTime: checkTime },
                timeslotGroups: [],
                summary: {
                    totalTimeslots: 0,
                    totalDeliveryOrders: 0,
                    totalItems: 0,
                    currentTimeslot: null
                }
            });
        }

        // Group by timeslot
        const timeslotGroups = {};
        const deliveryOrdersMap = new Map();
        let currentTimeslotKey = null;

        for (const summaryItem of summaryItems) {
            console.log(`Processing summary item ${summaryItem.id} for delivery order ${summaryItem.deliveryOrderId}`);

            // Validate that we have the required data
            if (!summaryItem.DeliveryOrder) {
                console.warn(`DeliveryOrder is null for summary item ${summaryItem.id} (deliveryOrderId: ${summaryItem.deliveryOrderId}), skipping...`);
                continue;
            }

            if (!summaryItem.DeliveryOrder.SalesOrder) {
                console.warn(`SalesOrder is null for delivery order ${summaryItem.DeliveryOrder.id} in summary item ${summaryItem.id}, skipping...`);
                continue;
            }

            const salesOrder = summaryItem.DeliveryOrder.SalesOrder;
            const timeslot = salesOrder.timeslot;
            const deliveryOrderId = summaryItem.deliveryOrderId;

            console.log(`Summary item ${summaryItem.id}: Sales order ${salesOrder.id}, timeslot: ${timeslot}`);

            // Skip if timeslot is null
            if (!timeslot) {
                console.warn(`Timeslot is null for sales order ${salesOrder.id}, skipping...`);
                continue;
            }

            // Initialize timeslot group
            if (!timeslotGroups[timeslot]) {
                timeslotGroups[timeslot] = {
                    timeslot: timeslot,
                    isCurrentTimeslot: false,
                    isPastTimeslot: false,
                    isFutureTimeslot: false,
                    deliveryOrders: [],
                    items: [],
                    summary: {
                        totalDeliveryOrders: 0,
                        totalItems: 0,
                        totalQuantity: 0,
                        uniqueItems: new Set(),
                        routes: new Set(),
                        drivers: new Set(),
                        vehicles: new Set(),
                        customers: new Set()
                    }
                };
            }

            // Determine if this is current, past, or future timeslot
            if (timeslot && checkTime) {
                // Handle different timeslot formats:
                // Format 1: "08:00-09:00" (range)
                // Format 2: "08:00" (single time)
                let timeslotTime;
                if (timeslot.includes('-')) {
                    timeslotTime = timeslot.split('-')[0]; // Get start time from "HH:MM-HH:MM"
                } else {
                    timeslotTime = timeslot; // Single time format "HH:MM"
                }

                console.log(`Processing timeslot: "${timeslot}" -> extracted time: "${timeslotTime}"`);

                // Handle 24:00 as 00:00 (convert to 00:00 for comparison)
                const normalizedTimeslotTime = timeslotTime === '24:00' ? '00:00' : timeslotTime;
                const normalizedCheckTime = checkTime;

                // Convert times to minutes for proper comparison
                const timeslotMinutes = timeToMinutes(normalizedTimeslotTime);
                const checkTimeMinutes = timeToMinutes(normalizedCheckTime);

                console.log(`Time comparison: timeslot "${timeslotTime}" (${timeslotMinutes} min) vs current "${checkTime}" (${checkTimeMinutes} min)`);

                // Special handling for 24:00 timeslot - treat as next day (past if we're close to midnight)
                if (timeslotTime === '24:00') {
                    // If current time is after 22:00, consider 24:00 as a current/past timeslot
                    if (checkTimeMinutes >= timeToMinutes('22:00')) {
                        timeslotGroups[timeslot].isPastTimeslot = true;
                        if (!currentTimeslotKey || timeslotTime === '24:00') {
                            currentTimeslotKey = timeslot;
                        }
                        console.log(`24:00 timeslot marked as PAST (current time after 22:00)`);
                    } else {
                        timeslotGroups[timeslot].isFutureTimeslot = true;
                        console.log(`24:00 timeslot marked as FUTURE (current time before 22:00)`);
                    }
                } else {
                    // Normal timeslot comparison
                    // Only show timeslots that are current or future (not past)
                    if (timeslotMinutes > checkTimeMinutes) {
                        // Future timeslot - show it
                        timeslotGroups[timeslot].isFutureTimeslot = true;
                        console.log(`Timeslot "${timeslot}" marked as FUTURE (${timeslotMinutes} > ${checkTimeMinutes})`);
                    } else if (timeslotMinutes === checkTimeMinutes) {
                        // Current timeslot - show it
                        timeslotGroups[timeslot].isCurrentTimeslot = true;
                        currentTimeslotKey = timeslot;
                        console.log(`Timeslot "${timeslot}" marked as CURRENT (${timeslotMinutes} === ${checkTimeMinutes})`);
                    } else {
                        // Past timeslot - don't show it based on user requirement
                        timeslotGroups[timeslot].isPastTimeslot = true;
                        console.log(`Timeslot "${timeslot}" marked as PAST (${timeslotMinutes} < ${checkTimeMinutes}) - will be filtered out`);
                    }
                }
            }

            // Track delivery order details
            if (!deliveryOrdersMap.has(deliveryOrderId)) {
                const deliveryOrder = summaryItem.DeliveryOrder;
                const deliveryOrderData = {
                    id: deliveryOrderId,
                    doNumber: deliveryOrder ? deliveryOrder.doNumber : null,
                    status: deliveryOrder ? deliveryOrder.status : null,
                    deliveryDate: deliveryOrder ? deliveryOrder.deliveryDate : null,
                    deliveryAddress: deliveryOrder ? deliveryOrder.deliveryAddress : null,
                    salesOrder: {
                        id: salesOrder.id,
                        orderNumber: salesOrder.orderNumber,
                        isDelivery: salesOrder.isDelivery,
                        dispatchDate: salesOrder.dispatchDate,
                        timeslot: salesOrder.timeslot
                    },
                    customer: salesOrder.Customer ? {
                        id: salesOrder.Customer.id,
                        name: salesOrder.Customer.name,
                        email: salesOrder.Customer.email,
                        mobile: salesOrder.Customer.mobile,
                        address: salesOrder.Customer.address
                    } : null,
                    route: deliveryOrder && deliveryOrder.Route ? {
                        id: deliveryOrder.Route.id,
                        routeName: deliveryOrder.Route.routeName,
                        city: deliveryOrder.Route.city
                    } : null,
                    driver: deliveryOrder && deliveryOrder.Driver ? {
                        id: deliveryOrder.Driver.id,
                        name: deliveryOrder.Driver.name,
                        mobile: deliveryOrder.Driver.mobile
                    } : null,
                    vehicle: deliveryOrder && deliveryOrder.Vehicle ? {
                        id: deliveryOrder.Vehicle.id,
                        vehicleNumber: deliveryOrder.Vehicle.vehicleNumber,
                        vehicleType: deliveryOrder.Vehicle.vehicleType
                    } : null,
                    items: [],
                    totalQuantity: 0
                };

                deliveryOrdersMap.set(deliveryOrderId, deliveryOrderData);
                timeslotGroups[timeslot].deliveryOrders.push(deliveryOrderData);
                timeslotGroups[timeslot].summary.totalDeliveryOrders++;

                // Update summary tracking
                if (deliveryOrderData.route) {
                    timeslotGroups[timeslot].summary.routes.add(deliveryOrderData.route.id);
                }
                if (deliveryOrderData.driver) {
                    timeslotGroups[timeslot].summary.drivers.add(deliveryOrderData.driver.id);
                }
                if (deliveryOrderData.vehicle) {
                    timeslotGroups[timeslot].summary.vehicles.add(deliveryOrderData.vehicle.id);
                }
                if (deliveryOrderData.customer) {
                    timeslotGroups[timeslot].summary.customers.add(deliveryOrderData.customer.id);
                }
            }

            // Find approved GINs from bay store
            const approvedGins = await sequelize.query(`
            SELECT DISTINCT 
                gi.id as ginId,
                gi.issueNumber,
                gi.status,
                gi.fromStoreId,
                gi.toStoreId,
                gi.createdAt as ginCreatedAt,
                git.id as ginItemId,
                git.itemId,
                git.issuedQuantity as ginQty,
                git.actualIssuedQuantity as ginDispatchedQty
            FROM issue_notes gi
            JOIN issue_note_items git ON gi.id = git.issueNoteId
            WHERE (gi.status = 'Approved' OR gi.status = 'QC Checked')
            AND gi.toStoreId = :bayStoreId
            ORDER BY gi.createdAt DESC
        `, {
                replacements: { bayStoreId },
                type: sequelize.QueryTypes.SELECT
            });

            console.log('Found approved GINs:', approvedGins.length);

            // Add item to delivery order and timeslot
            // Check if this item can be fulfilled from bay store GINs
            let canFulfill = false;
            let availableGinQty = 0;

            // Get GINs for this item
            const availableGins = approvedGins.filter(gin =>
                gin.itemId === summaryItem.itemId
            );

            // Calculate total available quantity from matching GINs
            availableGinQty = availableGins.reduce((total, gin) => total + (gin.ginQty - gin.ginDispatchedQty), 0);
            canFulfill = availableGinQty >= summaryItem.qty;

            const itemData = {
                id: summaryItem.id,
                itemId: summaryItem.itemId,
                qty: summaryItem.qty,
                isReady: summaryItem.isReady,
                isReleased: summaryItem.isReleased,
                canFulfill: canFulfill,
                availableQty: availableGinQty,
                ginMatches: availableGins.map(gin => ({
                    ginId: gin.ginId,
                    ginNumber: gin.issueNumber,
                    availableQty: (gin.ginQty || 0) - (gin.ginDispatchedQty || 0)
                })),
                item: summaryItem.Item ? {
                    id: summaryItem.Item.id,
                    name: summaryItem.Item.name,
                    color: summaryItem.Item.color,
                    country: summaryItem.Item.country,
                    sku: summaryItem.Item.sku,
                    unit: summaryItem.Item.unit,
                    weight: summaryItem.Item.weight,
                    category: summaryItem.Item.Category ? {
                        id: summaryItem.Item.Category.id,
                        name: summaryItem.Item.Category.name
                    } : null
                } : null,
                batch: summaryItem.Batch ? {
                    id: summaryItem.Batch.id,
                    batchNumber: summaryItem.Batch.batchNumber,
                    batchDate: summaryItem.Batch.batchDate
                } : null,
                deliveryOrderSummary: summaryItem.DeliveryOrderSummary ? {
                    id: summaryItem.DeliveryOrderSummary.id,
                    code: summaryItem.DeliveryOrderSummary.code,
                    dateTime: summaryItem.DeliveryOrderSummary.dateTime
                } : null
            };

            deliveryOrdersMap.get(deliveryOrderId).items.push(itemData);
            deliveryOrdersMap.get(deliveryOrderId).totalQuantity += summaryItem.qty;
            timeslotGroups[timeslot].items.push(itemData);
            timeslotGroups[timeslot].summary.totalItems++;
            timeslotGroups[timeslot].summary.totalQuantity += summaryItem.qty;
            timeslotGroups[timeslot].summary.uniqueItems.add(summaryItem.itemId);
        }

        // Mark current timeslot
        if (currentTimeslotKey) {
            timeslotGroups[currentTimeslotKey].isCurrentTimeslot = true;
        }

        // Convert to array and clean up Sets
        const allTimeslotGroupsArray = Object.values(timeslotGroups).map(group => ({
            ...group,
            summary: {
                ...group.summary,
                uniqueItems: group.summary.uniqueItems.size,
                routes: group.summary.routes.size,
                drivers: group.summary.drivers.size,
                vehicles: group.summary.vehicles.size
            }
        }));

        // Filter to only show current and future timeslots (not past ones)
        const timeslotGroupsArray = allTimeslotGroupsArray.filter(group => {
            const shouldInclude = group.isCurrentTimeslot || group.isFutureTimeslot;
            if (!shouldInclude) {
                console.log(`Filtering out past timeslot: ${group.timeslot}`);
            }
            return shouldInclude;
        });

        console.log(`Filtered timeslots: ${allTimeslotGroupsArray.length} -> ${timeslotGroupsArray.length} (removed ${allTimeslotGroupsArray.length - timeslotGroupsArray.length} past timeslots)`);

        // Sort by timeslot (handle 24:00 as latest time)
        timeslotGroupsArray.sort((a, b) => {
            // Handle different timeslot formats for sorting
            let timeA, timeB;
            if (a.timeslot.includes('-')) {
                timeA = a.timeslot.split('-')[0];
            } else {
                timeA = a.timeslot;
            }
            if (b.timeslot.includes('-')) {
                timeB = b.timeslot.split('-')[0];
            } else {
                timeB = b.timeslot;
            }

            // Handle 24:00 as the latest time slot
            if (timeA === '24:00' && timeB !== '24:00') return 1;
            if (timeB === '24:00' && timeA !== '24:00') return -1;
            if (timeA === '24:00' && timeB === '24:00') return 0;

            return timeA.localeCompare(timeB);
        });

        // Calculate overall summary based on filtered timeslots
        const filteredDeliveryOrders = new Set();
        const filteredTotalItems = timeslotGroupsArray.reduce((sum, group) => {
            group.deliveryOrders.forEach(order => filteredDeliveryOrders.add(order.id));
            return sum + group.summary.totalItems;
        }, 0);
        const filteredTotalQuantity = timeslotGroupsArray.reduce((sum, group) => sum + group.summary.totalQuantity, 0);

        // Calculate overall summary
        const overallSummary = {
            totalTimeslots: timeslotGroupsArray.length,
            totalDeliveryOrders: filteredDeliveryOrders.size,
            totalItems: filteredTotalItems,
            totalQuantity: filteredTotalQuantity,
            totalFulfillableItems: timeslotGroupsArray.reduce((sum, group) =>
                sum + group.items.filter(item => item.canFulfill).length, 0),
            totalUnfulfillableItems: timeslotGroupsArray.reduce((sum, group) =>
                sum + group.items.filter(item => !item.canFulfill).length, 0),
            currentTimeslot: currentTimeslotKey,
            currentTime: checkTime,
            date: currentDate,
            timeslotBreakdown: timeslotGroupsArray.map(group => ({
                timeslot: group.timeslot,
                isCurrentTimeslot: group.isCurrentTimeslot,
                isPastTimeslot: group.isPastTimeslot,
                isFutureTimeslot: group.isFutureTimeslot,
                deliveryOrdersCount: group.summary.totalDeliveryOrders,
                itemsCount: group.summary.totalItems,
                fulfillableItemsCount: group.items.filter(item => item.canFulfill).length,
                unfulfillableItemsCount: group.items.filter(item => !item.canFulfill).length,
                quantity: group.summary.totalQuantity
            }))
        };

        res.json({
            filter: { date: currentDate, routeId, currentTime: checkTime },
            summary: overallSummary,
            timeslotGroups: timeslotGroupsArray
        });

    } catch (error) {
        console.error('Error in getDeliveryOrderSummariesByTimeslot:', error);
        res.status(500).json({
            error: 'Failed to get delivery order summaries by timeslot',
            details: error.message
        });
    }
};

// Release Delivery Order Summary Item
exports.releaseDeliveryOrderSummaryItem = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { itemId } = req.params;
        const { isReleased } = req.body;
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;

        console.log('Release request for item ID:', itemId, 'isReleased:', isReleased);

        // Validation
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        if (isReleased === undefined || typeof isReleased !== 'boolean') {
            await t.rollback();
            return res.status(400).json({ error: 'isReleased must be a boolean value' });
        }

        // Find the delivery order summary item
        const summaryItem = await DeliveryOrderSummaryItem.findOne({
            where: {
                id: itemId,
                isReady: true,
                isActive: true
            },
            transaction: t
        });

        console.log('Found summary item:', summaryItem.id, 'for delivery order:', summaryItem.deliveryOrderId);

        if (!summaryItem) {
            await t.rollback();
            return res.status(404).json({
                error: 'Delivery order summary item not found or not ready for release',
                itemId: itemId,
                requirements: 'Item must be ready (isReady=true) and active (isActive=true)'
            });
        }

        console.log('Found summary item:', summaryItem.id, 'for delivery order:', summaryItem.deliveryOrderId);

        // Update the summary item with isReleased status
        await summaryItem.update({
            isReleased: isReleased,
            updatedBy: currentUserId
        }, { transaction: t });

        console.log('Updated summary item isReleased to:', isReleased);

        // If setting to released, check if all items in the delivery order are now released
        if (isReleased) {
            // Find all delivery order summary items for this delivery order
            const allSummaryItemsForOrder = await DeliveryOrderSummaryItem.findAll({
                where: {
                    deliveryOrderId: summaryItem.deliveryOrderId,
                    isActive: true
                },
                transaction: t
            });

            console.log(`Found ${allSummaryItemsForOrder.length} total summary items for delivery order ${summaryItem.deliveryOrderId}`);

            // Check if all items are ready and released
            const allItemsReady = allSummaryItemsForOrder.every(item => item.isReady === true);
            const allItemsReleased = allSummaryItemsForOrder.every(item => item.isReleased === true);

            console.log('All items ready:', allItemsReady, 'All items released:', allItemsReleased);

            if (allItemsReady && allItemsReleased && allSummaryItemsForOrder.length > 0) {
                // Update delivery order status to "In Transit"
                const [updatedDeliveryOrderCount] = await DeliveryOrder.update(
                    {
                        status: 'In Transit',
                        updatedBy: currentUserId
                    },
                    {
                        where: { id: summaryItem.deliveryOrderId },
                        transaction: t
                    }
                );

                console.log(`Updated delivery order ${summaryItem.deliveryOrderId} status to 'In Transit'`);

                await t.commit();

                // Get the updated summary item with relations for response
                // const updatedSummaryItem = await DeliveryOrderSummaryItem.findByPk(summaryItem.id, {
                //     include: [
                //         {
                //             model: DeliveryOrderSummary,
                //             as: 'DeliveryOrderSummary',
                //             attributes: ['id', 'code', 'dateTime', 'isDispatched']
                //         },
                //         {
                //             model: DeliveryOrder,
                //             as: 'DeliveryOrder',
                //             attributes: ['id', 'doNumber', 'status', 'orderDate', 'deliveryDate']
                //         },
                //         {
                //             model: Item,
                //             as: 'Item',
                //             attributes: ['id', 'name', 'sku', 'color', 'country', 'unit']
                //         },
                //         {
                //             model: Batch,
                //             as: 'Batch',
                //             attributes: ['id', 'batchNumber', 'batchDate']
                //         }
                //     ]
                // });

                return res.json({
                    message: 'Delivery order summary item released successfully and delivery order status updated to In Transit',
                    // summaryItem: updatedSummaryItem,
                    deliveryOrderStatusUpdate: {
                        deliveryOrderId: summaryItem.deliveryOrderId,
                        previousStatus: 'Dispatched',
                        newStatus: 'In Transit',
                        updated: updatedDeliveryOrderCount > 0,
                        reason: 'All items in delivery order are ready and released'
                    },
                    releaseSummary: {
                        itemId: itemId,
                        isReleased: isReleased,
                        totalItemsInOrder: allSummaryItemsForOrder.length,
                        readyItems: allSummaryItemsForOrder.filter(item => item.isReady).length,
                        releasedItems: allSummaryItemsForOrder.filter(item => item.isReleased).length
                    }
                });
            } else {
                await t.commit();

                // Get the updated summary item with relations for response
                const updatedSummaryItem = await DeliveryOrderSummaryItem.findByPk(summaryItem.id, {
                    include: [
                        {
                            model: DeliveryOrderSummary,
                            as: 'DeliveryOrderSummary',
                            attributes: ['id', 'code', 'dateTime', 'isDispatched']
                        },
                        {
                            model: DeliveryOrder,
                            as: 'DeliveryOrder',
                            attributes: ['id', 'doNumber', 'status', 'orderDate', 'deliveryDate']
                        },
                        {
                            model: Item,
                            as: 'Item',
                            attributes: ['id', 'name', 'sku', 'color', 'country', 'unit']
                        },
                        {
                            model: Batch,
                            as: 'Batch',
                            attributes: ['id', 'batchNumber', 'batchDate']
                        }
                    ]
                });

                return res.json({
                    message: 'Delivery order summary item released successfully',
                    summaryItem: updatedSummaryItem,
                    deliveryOrderStatusUpdate: {
                        deliveryOrderId: summaryItem.deliveryOrderId,
                        statusChanged: false,
                        currentStatus: 'Dispatched',
                        reason: 'Not all items in delivery order are ready and released yet'
                    },
                    releaseSummary: {
                        itemId: itemId,
                        isReleased: isReleased,
                        totalItemsInOrder: allSummaryItemsForOrder.length,
                        readyItems: allSummaryItemsForOrder.filter(item => item.isReady).length,
                        releasedItems: allSummaryItemsForOrder.filter(item => item.isReleased).length,
                        pendingForTransit: !allItemsReady || !allItemsReleased
                    }
                });
            }
        } else {
            // If setting to not released, just update the item
            await t.commit();

            // Get the updated summary item with relations for response
            const updatedSummaryItem = await DeliveryOrderSummaryItem.findByPk(summaryItem.id, {
                include: [
                    {
                        model: DeliveryOrderSummary,
                        as: 'DeliveryOrderSummary',
                        attributes: ['id', 'code', 'dateTime', 'isDispatched']
                    },
                    {
                        model: DeliveryOrder,
                        as: 'DeliveryOrder',
                        attributes: ['id', 'doNumber', 'status', 'orderDate', 'deliveryDate']
                    },
                    {
                        model: Item,
                        as: 'Item',
                        attributes: ['id', 'name', 'sku', 'color', 'country', 'unit']
                    },
                    {
                        model: Batch,
                        as: 'Batch',
                        attributes: ['id', 'batchNumber', 'batchDate']
                    }
                ]
            });

            return res.json({
                message: 'Delivery order summary item release status updated successfully',
                summaryItem: updatedSummaryItem,
                deliveryOrderStatusUpdate: {
                    deliveryOrderId: summaryItem.deliveryOrderId,
                    statusChanged: false,
                    currentStatus: 'Dispatched',
                    reason: 'Item set to not released'
                },
                releaseSummary: {
                    itemId: itemId,
                    isReleased: isReleased
                }
            });
        }

    } catch (error) {
        await t.rollback();
        console.error('Error releasing delivery order summary item:', error);
        res.status(500).json({
            error: 'Failed to release delivery order summary item',
            details: error.message,
            itemId: req.params.itemId
        });
    }
};
