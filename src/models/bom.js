const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const BOM = sequelize.define('BOM', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    bomCode: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        comment: 'Unique BOM code/identifier'
    },
    itemId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'items',
            key: 'id',
        },
        comment: 'Finished product item that this BOM produces'
    },
    qty: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 1.00,
        comment: 'Quantity of finished product this BOM produces'
    },
    locationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'locations',
            key: 'id',
        },
        comment: 'Location where this BOM is applicable'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Flag to indicate if the BOM is active'
    },
    createdBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'User who created this BOM'
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
        comment: 'User who last updated this BOM'
    },
    name: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Optional name/description for the BOM'
    },
    version: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: '1.0',
        comment: 'Version number of the BOM'
    },
    totalCost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.00,
        comment: 'Total cost of materials in this BOM'
    }
}, {
    timestamps: true,
    tableName: 'boms',
    indexes: [
        {
            fields: ['bomCode'],
            unique: true
        },
        {
            fields: ['itemId']
        },
        {
            fields: ['locationId']
        },
        {
            fields: ['isActive']
        },
        {
            fields: ['itemId', 'locationId'],
            name: 'bom_item_location_idx'
        }
    ]
});

module.exports = BOM;