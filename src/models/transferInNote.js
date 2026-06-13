const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const TransferInNote = sequelize.define('TransferInNote', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    transferNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Unique transfer number for the transfer in note'
    },
    transferDate: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Date when the transfer in note was created'
    },
    issueNoteId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'issue_notes',
            key: 'id',
        },
        comment: 'Reference to the original issue note'
    },
    goodRequestNoteId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'good_request_notes',
            key: 'id',
        },
        comment: 'Reference to the original good request note'
    },
    fromLocationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'locations',
            key: 'id',
        },
        comment: 'Location from where goods were transferred'
    },
    fromStoreId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'stores',
            key: 'id',
        },
        comment: 'Store from where goods were transferred'
    },
    toLocationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'locations',
            key: 'id',
        },
        comment: 'Location to where goods are being transferred'
    },
    toStoreId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'stores',
            key: 'id',
        },
        comment: 'Store to where goods are being transferred'
    },
    status: {
        type: DataTypes.ENUM('Pending', 'In_Transit', 'Received', 'Approved', 'Rejected'),
        allowNull: false,
        defaultValue: 'Pending',
        comment: 'Current status of the transfer in note'
    },
    transferredBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'User who initiated the transfer'
    },
    receivedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'User who received the goods'
    },
    receivedDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Date when the goods were received'
    },
    approvedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'User who approved the transfer in'
    },
    approvedDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Date when the transfer in was approved'
    },
    vehicleId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'vehicles',
            key: 'id',
        },
        comment: 'Vehicle used for transportation (if applicable)'
    },
    driverId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'drivers',
            key: 'id',
        },
        comment: 'Driver who transported the goods (if applicable)'
    },
    dispatchDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Date when goods were dispatched'
    },
    expectedDeliveryDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Expected delivery date'
    },
    actualDeliveryDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Actual delivery date'
    },
    remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Additional remarks or notes'
    },
    totalWeight: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Total weight of all transferred items'
    },
    totalValue: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        comment: 'Total value of all transferred items'
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
    tableName: 'transfer_in_notes',
    indexes: [
        {
            fields: ['transferNumber']
        },
        {
            fields: ['status']
        },
        {
            fields: ['issueNoteId']
        },
        {
            fields: ['goodRequestNoteId']
        },
        {
            fields: ['fromLocationId', 'fromStoreId']
        },
        {
            fields: ['toLocationId', 'toStoreId']
        },
        {
            fields: ['transferDate']
        },
        {
            fields: ['expectedDeliveryDate']
        },
        {
            fields: ['actualDeliveryDate']
        }
    ]
});

module.exports = TransferInNote;