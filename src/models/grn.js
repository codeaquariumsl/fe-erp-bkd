const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const GRN = sequelize.define('GRN', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    grnNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
    purchaseOrderId: { type: DataTypes.INTEGER, allowNull: true },
    supplierId: { type: DataTypes.INTEGER, allowNull: false },
    storeId: { type: DataTypes.INTEGER, allowNull: false },
    grnDate: { type: DataTypes.DATE, allowNull: false },
    totalAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
    },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Pending' },
    remarks: { type: DataTypes.STRING, allowNull: true },
    locationId: {
        type: DataTypes.INTEGER, allowNull: false,
        references: { model: 'locations', key: 'id', },
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Flag to indicate if the grn is active'
    },
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
    },
    approvedAt: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    approvedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    qcCheckedAt: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    qcCheckedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
    }
}, {
    timestamps: true,
    tableName: 'grns',
});

module.exports = GRN;
