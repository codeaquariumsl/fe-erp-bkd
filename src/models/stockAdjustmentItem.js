const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const StockAdjustmentItem = sequelize.define('StockAdjustmentItem', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    adjustmentId: { type: DataTypes.INTEGER, allowNull: false },
    itemId: { type: DataTypes.INTEGER, allowNull: false },
    batchId: { type: DataTypes.INTEGER, allowNull: true },
    systemQty: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    adjustedQty: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    newQty: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    remark: { type: DataTypes.STRING, allowNull: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: false },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true }
}, {
    timestamps: true,
    tableName: 'stock_adjustment_items',
});

module.exports = StockAdjustmentItem;
