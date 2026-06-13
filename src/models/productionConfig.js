const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ProductionConfig = sequelize.define('ProductionConfig', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    rawMaterialStoreId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'stores',
            key: 'id',
        },
        comment: 'Store where raw materials are stored for production'
    },
    outputStoreId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'stores',
            key: 'id',
        },
        comment: 'Store where finished production output is stored'
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
        comment: 'Flag to indicate if the production configuration is active'
    },
    createdBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'User who created this production configuration'
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
        comment: 'User who last updated this production configuration'
    }
}, {
    timestamps: true,
    tableName: 'production_configs',
    indexes: [
        {
            fields: ['rawMaterialStoreId']
        },
        {
            fields: ['outputStoreId']
        },
        {
            fields: ['locationId']
        },
        {
            fields: ['isActive']
        }
    ]
});

module.exports = ProductionConfig;