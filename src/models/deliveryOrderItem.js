const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const DeliveryOrderItem = sequelize.define('DeliveryOrderItem', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    deliveryOrderId: { type: DataTypes.INTEGER, allowNull: false },
    itemId: { type: DataTypes.INTEGER, allowNull: false },
    qty: { type: DataTypes.INTEGER, allowNull: false },
    batchId: { type: DataTypes.INTEGER, allowNull: true },
    storeId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'stores',
            key: 'id',
        },
    },
    acceptedQty: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
    rejectedQty: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
    damagedQty: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
    weightDiffQty: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 }
}, {
    timestamps: true,
    tableName: 'delivery_order_items',
});

module.exports = DeliveryOrderItem;
