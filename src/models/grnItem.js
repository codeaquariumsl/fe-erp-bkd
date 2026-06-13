const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const GRNItem = sequelize.define('GRNItem', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    grnId: { type: DataTypes.INTEGER, allowNull: false },
    itemId: { type: DataTypes.INTEGER, allowNull: false },
    grnQty: { type: DataTypes.INTEGER, allowNull: false },
    availableQty: { type: DataTypes.INTEGER, allowNull: false },
    reservedQty: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    rejectedQty: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
    weight: { type: DataTypes.FLOAT, allowNull: true },
    costPrice: { type: DataTypes.FLOAT, allowNull: false },
    expireDate: { type: DataTypes.DATE, allowNull: true },
    coldRoomId: { type: DataTypes.INTEGER, allowNull: true },
    palletRackId: { type: DataTypes.INTEGER, allowNull: true },
    damageReason: { type: DataTypes.STRING, allowNull: true },
    remarks: { type: DataTypes.STRING, allowNull: true },
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
    tableName: 'grn_items',
});

module.exports = GRNItem;
