const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const DeliveryOrder = sequelize.define('DeliveryOrder', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    doNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
    salesOrderId: { type: DataTypes.INTEGER, allowNull: false },
    customerId: { type: DataTypes.INTEGER, allowNull: false },
    routeId: { type: DataTypes.INTEGER, allowNull: true },
    driverId: { type: DataTypes.INTEGER, allowNull: true },
    vehicleId: { type: DataTypes.INTEGER, allowNull: true },
    storeId: { type: DataTypes.INTEGER, allowNull: true },
    orderDate: { type: DataTypes.DATE, allowNull: false },
    dispatchDate: { type: DataTypes.DATE, allowNull: true },
    deliveryDate: { type: DataTypes.DATE, allowNull: true },
    deliveryAddress: { type: DataTypes.STRING, allowNull: true },
    totalWeight: { type: DataTypes.FLOAT, allowNull: true },
    totalAmount: { type: DataTypes.FLOAT, allowNull: true },
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
    tableName: 'deliveryorders' // Explicitly set table name to match DB
});

module.exports = DeliveryOrder;
