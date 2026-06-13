const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const GoodRequestNoteItem = sequelize.define('GoodRequestNoteItem', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    goodRequestNoteId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'good_request_notes',
            key: 'id',
        },
        comment: 'Reference to the good request note'
    },
    itemId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'items',
            key: 'id',
        },
        comment: 'Reference to the requested item'
    },
    requestedQuantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Quantity requested for this item'
    },
    approvedQuantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        comment: 'Approved quantity (may be different from requested)'
    },
    unitId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'units',
            key: 'id',
        },
        comment: 'Unit of measurement for the item'
    },
    estimatedWeight: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Estimated weight of the requested quantity'
    },
    urgency: {
        type: DataTypes.ENUM('Normal', 'High', 'Critical'),
        allowNull: false,
        defaultValue: 'Normal',
        comment: 'Urgency level for this specific item'
    },
    purpose: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Purpose or reason for requesting this item'
    },
    remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Additional remarks for this item'
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
        comment: 'User who created this record'
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
        comment: 'User who last updated this record'
    }
}, {
    timestamps: true,
    tableName: 'good_request_note_items',
    indexes: [
        {
            fields: ['goodRequestNoteId']
        },
        {
            fields: ['itemId']
        },
        {
            fields: ['goodRequestNoteId', 'itemId'],
            unique: true
        },
        {
            fields: ['urgency']
        },
        {
            fields: ['isActive']
        }
    ]
});

module.exports = GoodRequestNoteItem;