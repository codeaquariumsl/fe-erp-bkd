const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');


const DeliveryOrderSummaryItem = sequelize.define('DeliveryOrderSummaryItem', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    deliveryOrderSummaryId: { type: DataTypes.INTEGER, allowNull: false },
    routeId: { type: DataTypes.INTEGER, allowNull: true },
    deliveryOrderId: { type: DataTypes.INTEGER, allowNull: false },
    deliveryOrderItemId: { type: DataTypes.INTEGER, allowNull: false },
    itemId: { type: DataTypes.INTEGER, allowNull: false },
    batchId: { type: DataTypes.INTEGER, allowNull: true },
    batchItemId: { type: DataTypes.INTEGER, allowNull: true },
    releaseStoreId: { type: DataTypes.INTEGER, allowNull: true },
    qty: { type: DataTypes.INTEGER, allowNull: false },
    isReady: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    isReleased: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    createdBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    updatedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
    }
}, {
    timestamps: true,
    tableName: 'delivery_order_summary_items'
});

module.exports = DeliveryOrderSummaryItem;
