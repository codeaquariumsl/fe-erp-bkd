const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const SalesOrder = sequelize.define('SalesOrder', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    orderNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
    customerId: { type: DataTypes.INTEGER, allowNull: false },
    isDelivery: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    routeId: { type: DataTypes.INTEGER, allowNull: true },
    orderDate: { type: DataTypes.DATE, allowNull: false },
    deliveryDate: { type: DataTypes.DATE, allowNull: true },
    dispatchDate: { type: DataTypes.DATE, allowNull: true },
    timeslot: { type: DataTypes.STRING(10), allowNull: true },
    deliveryAddress: { type: DataTypes.STRING, allowNull: true },
    poNumber: { type: DataTypes.STRING, allowNull: true },
    totalWeight: { type: DataTypes.FLOAT, allowNull: true },
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
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0.0,
    },
    taxAmount: {
        type: DataTypes.FLOAT, allowNull: false,
        defaultValue: 0.0,
    },
    totalAmount: {
        type: DataTypes.FLOAT, allowNull: false,
        defaultValue: 0.0,
    },
    idSalesPerson: { type: DataTypes.INTEGER, allowNull: true },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Pending' },
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
    tableName: 'sales_orders',
});

module.exports = SalesOrder;
