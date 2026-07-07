const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Invoice = sequelize.define('Invoice', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    invoiceNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
    customerId: { type: DataTypes.INTEGER, allowNull: false },
    salesOrderId: { type: DataTypes.INTEGER, allowNull: true },
    deliveryOrderId: { type: DataTypes.INTEGER, allowNull: true },
    invoiceDate: { type: DataTypes.DATE, allowNull: false },
    subTotal: {
        type: DataTypes.FLOAT, allowNull: false,
        defaultValue: 0.0,
    },
    isTaxInvoice: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    taxRate: {
        type: DataTypes.DECIMAL,
        allowNull: false,
        defaultValue: 0.0,
    },
    taxAmount: {
        type: DataTypes.DECIMAL, allowNull: false,
        defaultValue: 0.0,
    },
    total: { type: DataTypes.DECIMAL, allowNull: false },
    paidAmount: { type: DataTypes.DECIMAL, allowNull: false, defaultValue: 0.0 },
    setoffAmount: { type: DataTypes.DECIMAL, allowNull: false, defaultValue: 0.0 },
    idSalesPerson: { type: DataTypes.INTEGER, allowNull: true },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Pending' },
    cancelReason: { type: DataTypes.TEXT, allowNull: true },
    locationId: {
        type: DataTypes.INTEGER, allowNull: false,
        references: { model: 'locations', key: 'id', },
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
    }
}, {
    timestamps: true,
    tableName: 'invoices',
});

module.exports = Invoice;
