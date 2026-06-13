const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const StockAdjustment = sequelize.define('StockAdjustment', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    adjustmentNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
    locationId: { type: DataTypes.INTEGER, allowNull: false },
    storeId: { type: DataTypes.INTEGER, allowNull: false },
    adjustmentDate: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    reason: { type: DataTypes.STRING, allowNull: true },
    status: { type: DataTypes.ENUM('Pending', 'Approved', 'Rejected'), allowNull: false, defaultValue: 'Pending' },
    notes: { type: DataTypes.TEXT, allowNull: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: false },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true },
    approvedBy: { type: DataTypes.INTEGER, allowNull: true },
    approvedDate: { type: DataTypes.DATE, allowNull: true }
}, {
    timestamps: true,
    tableName: 'stock_adjustments',
});

module.exports = StockAdjustment;
