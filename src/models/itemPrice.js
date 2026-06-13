const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ItemPrice = sequelize.define('ItemPrice', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    type: {
        type: DataTypes.ENUM('Supermarket', 'Own Shop', 'Distribution', 'Wholesaler', 'Walking'),
        allowNull: false,
    },
    customerId: { type: DataTypes.INTEGER, allowNull: true },
    itemId: { type: DataTypes.INTEGER, allowNull: false },
    price: { type: DataTypes.FLOAT, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Active' },
    effectiveDate: { type: DataTypes.DATE, allowNull: true },
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
    },
}, { 
    timestamps: true,
    tableName: 'item_prices',
});

module.exports = ItemPrice;
