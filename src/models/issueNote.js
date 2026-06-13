const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const IssueNote = sequelize.define('IssueNote', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    issueNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Unique issue number for the issue note'
    },
    issueDate: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Date when the issue note was created'
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
        comment: 'Location from where goods will be issued'
    },
    fromStoreId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'stores',
            key: 'id',
        },
        comment: 'Store from where goods will be issued'
    },
    toLocationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'locations',
            key: 'id',
        },
        comment: 'Location to where goods will be transferred'
    },
    toStoreId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'stores',
            key: 'id',
        },
        comment: 'Store to where goods will be transferred'
    },
    status: {
        type: DataTypes.ENUM('Pending', 'Approved', 'Rejected', 'Transferred'),
        allowNull: false,
        defaultValue: 'Pending',
        comment: 'Current status of the issue note'
    },
    issuedBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'User who created the issue note'
    },
    approvedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'User who approved the issue note'
    },
    approvedDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Date when the issue note was approved'
    },
    transferInNoteId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Reference to the generated transfer in note after approval'
    },
    remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Additional remarks or notes'
    },
    deliveryExpectedDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Expected delivery date for the issued goods'
    },
    deliveryActualDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Actual delivery date'
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
    tableName: 'issue_notes',
    indexes: [
        {
            fields: ['issueNumber']
        },
        {
            fields: ['status']
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
            fields: ['issueDate']
        },
        {
            fields: ['deliveryExpectedDate']
        }
    ]
});

module.exports = IssueNote;