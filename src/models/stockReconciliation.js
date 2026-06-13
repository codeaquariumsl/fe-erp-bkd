const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const StockReconciliation = sequelize.define('StockReconciliation', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    reconciliationNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
    locationId: { type: DataTypes.INTEGER, allowNull: false },
    storeId: { type: DataTypes.INTEGER, allowNull: false },
    reconciliationDate: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    status: { type: DataTypes.ENUM('Pending', 'Approved', 'Rejected'), allowNull: false, defaultValue: 'Pending' },
    notes: { type: DataTypes.TEXT, allowNull: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: false },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true },
    approvedBy: { type: DataTypes.INTEGER, allowNull: true },
    approvedDate: { type: DataTypes.DATE, allowNull: true }
}, {
    timestamps: true,
    tableName: 'stock_reconciliations',
});

module.exports = StockReconciliation;
