const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const BatchItem = sequelize.define('BatchItem', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    batchId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'batches',
            key: 'id',
        },
        comment: 'Reference to the batch this item belongs to'
    },
    itemId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'items',
            key: 'id',
        },
        comment: 'Reference to the item in this batch'
    },
    expireDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Expiration date of the batch item'
    },
    batchQuantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: 'Total quantity of items in this batch'
    },
    reservedQuantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: 'Reserved quantity of items in this batch'
    },
    availableQuantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: 'Available quantity of items in this batch'
    },
    costPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: 'Cost price of items in this batch'
    },
    sellingPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: 'Selling price of items in this batch'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Flag to indicate if the batch item is active'
    },
    locationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'locations',
            key: 'id',
        },
        comment: 'Location where the batch items are stored'
    },
    storeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'stores',
            key: 'id',
        },
        comment: 'Store where the batch items are located'
    },
    createdBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'User who created this batch item record'
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    updatedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'User who last updated this batch item record'
    }
}, {
    timestamps: true,
    tableName: 'batch_items',
    indexes: [
        {
            fields: ['batchId']
        },
        {
            fields: ['itemId']
        },
        {
            fields: ['batchId', 'itemId'],
            unique: true
        },
        {
            fields: ['locationId', 'storeId']
        },
        {
            fields: ['availableQuantity']
        }
    ]
});

module.exports = BatchItem;