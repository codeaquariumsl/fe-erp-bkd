const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ProductionOrder = sequelize.define('ProductionOrder', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    itemId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'items',
            key: 'id',
        },
        comment: 'Finished product item to be produced'
    },
    batchId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'batches',
            key: 'id',
        },
        comment: 'Batch associated with this production order'
    },
    code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Unique production order code/number'
    },
    date: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Production order date'
    },
    bomId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'boms',
            key: 'id',
        },
        comment: 'Bill of Materials used for this production'
    },
    plannedQuantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Planned quantity to be produced'
    },
    produceQuantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Actual quantity produced'
    },
    wastageQuantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Quantity wasted during production'
    },
    status: {
        type: DataTypes.ENUM('planned', 'in_progress', 'completed', 'cancelled', 'on_hold'),
        allowNull: false,
        defaultValue: 'planned',
        comment: 'Current status of the production order'
    },
    locationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'locations',
            key: 'id',
        },
        comment: 'Location where production takes place'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Flag to indicate if the production order is active'
    },
    createdBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'User who created this production order'
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
        comment: 'User who last updated this production order'
    },
    startDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Actual production start date'
    },
    endDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Actual production end date'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Additional notes about the production order'
    },
    priority: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
        allowNull: false,
        defaultValue: 'medium',
        comment: 'Priority level of the production order'
    },
    estimatedCost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.00,
        comment: 'Estimated cost for this production order'
    },
    actualCost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.00,
        comment: 'Actual cost incurred for this production order'
    }
}, {
    timestamps: true,
    tableName: 'production_orders',
    indexes: [
        {
            fields: ['itemId']
        },
        {
            fields: ['batchId']
        },
        {
            fields: ['bomId']
        },
        {
            fields: ['locationId']
        },
        {
            fields: ['status']
        },
        {
            fields: ['date']
        },
        {
            fields: ['code'],
            unique: true
        },
        {
            fields: ['priority']
        },
        {
            fields: ['isActive']
        }
    ]
});

module.exports = ProductionOrder;