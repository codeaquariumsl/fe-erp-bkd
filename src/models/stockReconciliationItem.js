const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const StockReconciliationItem = sequelize.define('StockReconciliationItem', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    reconciliationId: { type: DataTypes.INTEGER, allowNull: false },
    itemId: { type: DataTypes.INTEGER, allowNull: false },
    batchId: { type: DataTypes.INTEGER, allowNull: true },
    systemQty: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    physicalQty: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    diffQty: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    remark: { type: DataTypes.STRING, allowNull: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: false },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true }
}, {
    timestamps: true,
    tableName: 'stock_reconciliation_items',
});

module.exports = StockReconciliationItem;
