const { sequelize } = require('../models');
const { Op } = require('sequelize');

/**
 * Utility functions for managing GRN Item available quantities considering reservations
 */

/**
 * Calculate effective available quantity (availableQty - reservedQty)
 * @param {Object} grnItem - GRN Item object with availableQty and reservedQty
 * @returns {number} - Effective available quantity
 */
function calculateEffectiveAvailableQty(grnItem) {
    return grnItem.availableQty - (grnItem.reservedQty || 0);
}

/**
 * Get Sequelize where condition for GRN items with effective available quantity > 0
 * @returns {Object} - Sequelize where condition
 */
function getEffectiveAvailableQtyCondition() {
    return sequelize.where(
        sequelize.literal('availableQty - COALESCE(reservedQty, 0)'),
        Op.gt,
        0
    );
}

/**
 * Get Sequelize where condition for GRN items with effective available quantity >= minQty
 * @param {number} minQty - Minimum quantity required
 * @returns {Object} - Sequelize where condition
 */
function getEffectiveAvailableQtyConditionGte(minQty = 0) {
    return sequelize.where(
        sequelize.literal('availableQty - COALESCE(reservedQty, 0)'),
        Op.gte,
        minQty
    );
}

/**
 * Add effective available quantity to GRN item objects
 * @param {Array} grnItems - Array of GRN item objects
 * @returns {Array} - GRN items with effectiveAvailableQty property
 */
function addEffectiveAvailableQty(grnItems) {
    return grnItems.map(item => ({
        ...item.toJSON ? item.toJSON() : item,
        effectiveAvailableQty: calculateEffectiveAvailableQty(item)
    }));
}

/**
 * Filter GRN items by effective available quantity
 * @param {Array} grnItems - Array of GRN item objects
 * @param {number} minQty - Minimum effective available quantity (default: 0)
 * @returns {Array} - Filtered GRN items
 */
function filterByEffectiveAvailableQty(grnItems, minQty = 0) {
    return grnItems.filter(item => calculateEffectiveAvailableQty(item) > minQty);
}

/**
 * Reserve quantity in GRN item (increase reservedQty)
 * @param {Object} grnItem - GRN Item model instance
 * @param {number} qtyToReserve - Quantity to reserve
 * @param {Object} transaction - Sequelize transaction
 * @returns {Promise<Object>} - Updated GRN item
 */
async function reserveGrnItemQty(grnItem, qtyToReserve, transaction = null) {
    const currentReserved = grnItem.reservedQty || 0;
    const effectiveAvailable = calculateEffectiveAvailableQty(grnItem);
    
    if (qtyToReserve > effectiveAvailable) {
        throw new Error(`Cannot reserve ${qtyToReserve} units. Only ${effectiveAvailable} units available for reservation.`);
    }
    
    return await grnItem.update({
        reservedQty: currentReserved + qtyToReserve
    }, { transaction });
}

/**
 * Release reserved quantity in GRN item (decrease reservedQty)
 * @param {Object} grnItem - GRN Item model instance
 * @param {number} qtyToRelease - Quantity to release
 * @param {Object} transaction - Sequelize transaction
 * @returns {Promise<Object>} - Updated GRN item
 */
async function releaseGrnItemQty(grnItem, qtyToRelease, transaction = null) {
    const currentReserved = grnItem.reservedQty || 0;
    
    if (qtyToRelease > currentReserved) {
        throw new Error(`Cannot release ${qtyToRelease} units. Only ${currentReserved} units are reserved.`);
    }
    
    return await grnItem.update({
        reservedQty: Math.max(0, currentReserved - qtyToRelease)
    }, { transaction });
}

/**
 * Bulk reserve quantities across multiple GRN items
 * @param {Array} reservations - Array of {grnItem, qtyToReserve}
 * @param {Object} transaction - Sequelize transaction
 * @returns {Promise<Array>} - Array of updated GRN items
 */
async function bulkReserveGrnItemQty(reservations, transaction = null) {
    const updatedItems = [];
    
    for (const { grnItem, qtyToReserve } of reservations) {
        const updated = await reserveGrnItemQty(grnItem, qtyToReserve, transaction);
        updatedItems.push(updated);
    }
    
    return updatedItems;
}

/**
 * Bulk release quantities across multiple GRN items
 * @param {Array} releases - Array of {grnItem, qtyToRelease}
 * @param {Object} transaction - Sequelize transaction
 * @returns {Promise<Array>} - Array of updated GRN items
 */
async function bulkReleaseGrnItemQty(releases, transaction = null) {
    const updatedItems = [];
    
    for (const { grnItem, qtyToRelease } of releases) {
        const updated = await releaseGrnItemQty(grnItem, qtyToRelease, transaction);
        updatedItems.push(updated);
    }
    
    return updatedItems;
}

module.exports = {
    calculateEffectiveAvailableQty,
    getEffectiveAvailableQtyCondition,
    getEffectiveAvailableQtyConditionGte,
    addEffectiveAvailableQty,
    filterByEffectiveAvailableQty,
    reserveGrnItemQty,
    releaseGrnItemQty,
    bulkReserveGrnItemQty,
    bulkReleaseGrnItemQty
};
