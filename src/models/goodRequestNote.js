const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const GoodRequestNote = sequelize.define('GoodRequestNote', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    requestNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Unique request number for the good request note'
    },
    requestDate: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Date when the request was created'
    },
    fromLocationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'locations',
            key: 'id',
        },
        comment: 'Location requesting the goods'
    },
    fromStoreId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'stores',
            key: 'id',
        },
        comment: 'Store requesting the goods'
    },
    toLocationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'locations',
            key: 'id',
        },
        comment: 'Location from where goods will be supplied'
    },
    toStoreId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'stores',
            key: 'id',
        },
        comment: 'Store from where goods will be supplied'
    },
    status: {
        type: DataTypes.ENUM('Pending', 'Approved', 'Rejected', 'Converted_to_Issue'),
        allowNull: false,
        defaultValue: 'Pending',
        comment: 'Current status of the request note'
    },
    requestedBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'User who created the request'
    },
    approvedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'User who approved the request'
    },
    approvedDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Date when the request was approved'
    },
    remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Additional remarks or notes'
    },
    priority: {
        type: DataTypes.ENUM('Low', 'Medium', 'High', 'Urgent'),
        allowNull: false,
        defaultValue: 'Medium',
        comment: 'Priority level of the request'
    },
    expectedDeliveryDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Expected delivery date for the requested goods'
    },
    issueNoteId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Reference to the generated issue note after approval'
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
    tableName: 'good_request_notes',
    indexes: [
        {
            fields: ['requestNumber']
        },
        {
            fields: ['status']
        },
        {
            fields: ['fromLocationId', 'fromStoreId']
        },
        {
            fields: ['toLocationId', 'toStoreId']
        },
        {
            fields: ['requestDate']
        },
        {
            fields: ['expectedDeliveryDate']
        }
    ]
});

module.exports = GoodRequestNote;