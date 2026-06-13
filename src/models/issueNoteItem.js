const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const IssueNoteItem = sequelize.define('IssueNoteItem', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    issueNoteId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'issue_notes',
            key: 'id',
        },
        comment: 'Reference to the issue note'
    },
    goodRequestNoteItemId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'good_request_note_items',
            key: 'id',
        },
        comment: 'Reference to the original request note item'
    },
    itemId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'items',
            key: 'id',
        },
        comment: 'Reference to the item being issued'
    },
    batchId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'batches',
            key: 'id',
        },
        comment: 'Specific batch to be issued (if applicable)'
    },
    requestedQuantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Originally requested quantity'
    },
    issuedQuantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Quantity to be issued'
    },
    actualIssuedQuantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        comment: 'Actual quantity issued (updated when transfer completes)'
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
        comment: 'Estimated weight of the issued quantity'
    },
    actualWeight: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Actual weight issued'
    },
    costPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Cost price per unit'
    },
    totalCost: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        comment: 'Total cost for this item (quantity * cost price)'
    },
    expiryDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Expiry date of the batch being issued'
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
    tableName: 'issue_note_items',
    indexes: [
        {
            fields: ['issueNoteId']
        },
        {
            fields: ['itemId']
        },
        {
            fields: ['batchId']
        },
        {
            fields: ['goodRequestNoteItemId']
        },
        {
            fields: ['issueNoteId', 'itemId'],
            unique: true
        },
        {
            fields: ['isActive']
        },
        {
            fields: ['expiryDate']
        }
    ]
});

module.exports = IssueNoteItem;