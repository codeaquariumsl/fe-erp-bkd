const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Batch = sequelize.define('Batch', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    batchNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Unique batch identifier'
    },
    batchDate: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Date when the batch was created/received'
    },
    expireDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Expiration date of the batch'
    },
    reference: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Reference information for the batch'
    },
    grnId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'grns',
            key: 'id',
        },
        comment: 'Reference to the GRN that created this batch'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Flag to indicate if the batch is active'
    },
    locationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'locations',
            key: 'id',
        },
        comment: 'Location where the batch is stored'
    },
    storeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'stores',
            key: 'id',
        },
        comment: 'Store where the batch is located'
    },
    createdBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'User who created this batch record'
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
        comment: 'User who last updated this batch record'
    }
}, {
    timestamps: true,
    tableName: 'batches',
    indexes: [
        {
            fields: ['batchNumber']
        },
        {
            fields: ['grnId']
        },
        {
            fields: ['locationId', 'storeId']
        },
        {
            fields: ['batchDate']
        },
        {
            fields: ['expireDate']
        }
    ]
});

module.exports = Batch;