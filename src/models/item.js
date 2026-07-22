const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Category = require('./category');

const Item = sequelize.define('Item', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    sku: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    barcode: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    categoryId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'categories',
            key: 'id',
        },
    },
    temperature: {
        type: DataTypes.FLOAT,
        allowNull: true,
    },
    unit: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    country: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    color: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    weight: {
        type: DataTypes.FLOAT,
        allowNull: true,
    },
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
        allowNull: true,
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
    boxCount: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    qty: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    sellingPrice: {
        type: DataTypes.FLOAT,
        allowNull: true,
    },
    reorderLevelQty: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    reorderDateRange: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    overstockLevelQty: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    overstockDateRange: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    itemsPerBox: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 1,
        comment: 'Number of items per box/package'
    },
    leadTimeDays: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
        comment: 'Lead time in days for procurement'
    },
    image: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Image URL for the item'
    },
    doNotAllowDirectSale: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Flag to prevent direct sales of this item'
    },
    allowsMinus: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Flag to allow negative inventory for this item'
    },
    isProductionRawMaterial: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Flag to indicate if this item is a production raw material'
    },
    isTaxInclusive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Flag to indicate if the prices are tax inclusive'
    },
    isFreeIssue: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Flag to indicate if free issue promotion is active for this item'
    },
    freeIssuePerCount: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
        comment: 'Purchased count trigger for free issue (e.g. 10)'
    },
    freeIssueCount: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
        comment: 'Free issue count given per trigger count (e.g. 3)'
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'active',
    }
}, {
    timestamps: true,
    tableName: 'items',
});

module.exports = Item;
