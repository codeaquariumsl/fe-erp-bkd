const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const BOMItem = sequelize.define('BOMItem', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    bomId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'boms',
            key: 'id',
        },
        comment: 'Reference to the BOM this item belongs to'
    },
    itemId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'items',
            key: 'id',
        },
        comment: 'Raw material item used in this BOM'
    },
    quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Quantity of this item required in the BOM'
    },
    unit: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Unit of measurement for this item'
    },
    cost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.00,
        comment: 'Cost per unit of this item'
    },
    totalCost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.00,
        comment: 'Total cost (quantity * cost)'
    },
    remark: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Additional remarks or notes about this BOM item'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Flag to indicate if the BOM item is active'
    },
    createdBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'User who created this BOM item'
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
        comment: 'User who last updated this BOM item'
    },
    sequence: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 1,
        comment: 'Order/sequence of this item in the BOM process'
    },
    wastagePercentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        defaultValue: 0.00,
        comment: 'Expected wastage percentage for this item'
    }
}, {
    timestamps: true,
    tableName: 'bom_items',
    indexes: [
        {
            fields: ['bomId']
        },
        {
            fields: ['itemId']
        },
        {
            fields: ['bomId', 'itemId'],
            unique: true,
            name: 'bom_item_unique'
        },
        {
            fields: ['isActive']
        },
        {
            fields: ['sequence']
        }
    ],
    hooks: {
        beforeSave: (bomItem, options) => {
            // Calculate total cost when saving
            if (bomItem.quantity && bomItem.cost) {
                bomItem.totalCost = parseFloat(bomItem.quantity) * parseFloat(bomItem.cost);
            }
        }
    }
});

module.exports = BOMItem;