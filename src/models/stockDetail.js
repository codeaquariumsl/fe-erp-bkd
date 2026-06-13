const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const StockDetail = sequelize.define('StockDetail', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    stockId: { type: DataTypes.INTEGER, allowNull: false },
    documentType: { type: DataTypes.STRING, allowNull: false }, // e.g. 'GRN', 'SALE', etc.
    documentId: { type: DataTypes.INTEGER, allowNull: false },
    inOut: { type: DataTypes.ENUM('IN', 'OUT'), allowNull: false },
    qty: { type: DataTypes.INTEGER, allowNull: false },
    weight: { type: DataTypes.FLOAT, allowNull: true },
    date: { type: DataTypes.DATE, allowNull: false },
    remark: { type: DataTypes.STRING, allowNull: true },
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
    tableName: 'stock_details',
});

module.exports = StockDetail;
