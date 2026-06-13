const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const InvoiceItem = sequelize.define('InvoiceItem', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    invoiceId: { type: DataTypes.INTEGER, allowNull: false },
    itemId: { type: DataTypes.INTEGER, allowNull: false },
    code: {
        type: DataTypes.STRING, allowNull: true,
        comment: 'Customer specific code for the item'
    },
    qty: { type: DataTypes.INTEGER, allowNull: false },
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
    price: { type: DataTypes.FLOAT, allowNull: false },
    isTaxItem: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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
    tableName: 'invoice_items',
});

module.exports = InvoiceItem;
