const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ProductionOrderItem = sequelize.define('ProductionOrderItem', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    productionOrderId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'production_orders',
            key: 'id',
        },
        comment: 'Reference to the production order'
    },
    bomId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'boms',
            key: 'id',
        },
        comment: 'Reference to the BOM item used'
    },
    itemId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'items',
            key: 'id',
        },
        comment: 'Reference to the item/material used'
    },
    quantity: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 0.000,
        comment: 'Quantity of the item required'
    },
    unit: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: 'Unit of measurement (kg, pcs, liters, etc.)'
    },
    cost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.00,
        comment: 'Unit cost of the item'
    },
    totalCost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.00,
        comment: 'Total cost (quantity × unit cost)'
    },
    remark: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Additional notes or remarks about this item'
    },
    sequence: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 1,
        comment: 'Order sequence for production process'
    },
    wastageQuantity: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 0.000,
        comment: 'Quantity wasted during production'
    },
    status: {
        type: DataTypes.ENUM('pending', 'allocated', 'consumed', 'returned', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Status of this item in the production process'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Flag to indicate if this item is active'
    },
    createdBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'User who created this production order item'
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
        comment: 'User who last updated this production order item'
    }
}, {
    timestamps: true,
    tableName: 'production_order_items',
    indexes: [
        {
            fields: ['productionOrderId']
        },
        {
            fields: ['bomId']
        },
        {
            fields: ['itemId']
        },
        {
            fields: ['status']
        },
        {
            fields: ['isActive']
        },
        {
            fields: ['sequence']
        },
        {
            fields: ['productionOrderId', 'sequence'],
            name: 'production_order_sequence_idx'
        }
    ]
});

module.exports = ProductionOrderItem;