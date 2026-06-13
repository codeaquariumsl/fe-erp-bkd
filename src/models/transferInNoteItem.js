const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const TransferInNoteItem = sequelize.define('TransferInNoteItem', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    transferInNoteId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'transfer_in_notes',
            key: 'id',
        },
        comment: 'Reference to the transfer in note'
    },
    issueNoteItemId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'issue_note_items',
            key: 'id',
        },
        comment: 'Reference to the original issue note item'
    },
    itemId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'items',
            key: 'id',
        },
        comment: 'Reference to the item being transferred'
    },
    sourceBatchId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'batches',
            key: 'id',
        },
        comment: 'Source batch from which item is being transferred'
    },
    targetBatchId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'batches',
            key: 'id',
        },
        comment: 'Target batch created at destination (if applicable)'
    },
    issuedQuantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Quantity issued from source'
    },
    receivedQuantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        comment: 'Quantity actually received at destination'
    },
    acceptedQuantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        comment: 'Quantity accepted after inspection'
    },
    rejectedQuantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        comment: 'Quantity rejected due to quality issues'
    },
    damagedQuantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        comment: 'Quantity damaged during transport'
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
    issuedWeight: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Weight when issued from source'
    },
    receivedWeight: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Weight when received at destination'
    },
    costPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Cost price per unit'
    },
    totalCost: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        comment: 'Total cost for this item'
    },
    expiryDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Expiry date of the item'
    },
    qualityGrade: {
        type: DataTypes.ENUM('A', 'B', 'C', 'Reject'),
        allowNull: true,
        comment: 'Quality grade assigned during inspection'
    },
    inspectionNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Notes from quality inspection'
    },
    storageLocationId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'locations',
            key: 'id',
        },
        comment: 'Specific storage location within the destination store'
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
    tableName: 'transfer_in_note_items',
    indexes: [
        {
            fields: ['transferInNoteId']
        },
        {
            fields: ['itemId']
        },
        {
            fields: ['sourceBatchId']
        },
        {
            fields: ['targetBatchId']
        },
        {
            fields: ['issueNoteItemId']
        },
        {
            fields: ['transferInNoteId', 'itemId'],
            unique: true
        },
        {
            fields: ['isActive']
        },
        {
            fields: ['expiryDate']
        },
        {
            fields: ['qualityGrade']
        }
    ]
});

module.exports = TransferInNoteItem;