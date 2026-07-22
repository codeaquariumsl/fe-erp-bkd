const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const SalesOrderItem = sequelize.define('SalesOrderItem', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    salesOrderId: { type: DataTypes.INTEGER, allowNull: false },
    itemId: { type: DataTypes.INTEGER, allowNull: false },
    code: {
        type: DataTypes.STRING, allowNull: true,
        comment: 'Customer specific code for the item'
    },
    qty: { type: DataTypes.INTEGER, allowNull: false },
    price: { type: DataTypes.FLOAT, allowNull: false },
    discount: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: 0,
            max: 100,
            isFloat: true
        }
    },
    isTaxItem: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    freeIssueQty: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Free issue quantity given for this item'
    },
    discountedAmount: {
        type: DataTypes.FLOAT, allowNull: false,
        defaultValue: 0.0,
    },
    excludingTaxAmount: {
        type: DataTypes.FLOAT, allowNull: false,
        defaultValue: 0.0,
    },
    total: { type: DataTypes.FLOAT, allowNull: false },
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
    tableName: 'sales_order_items',
});

module.exports = SalesOrderItem;
