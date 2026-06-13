const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const CustomerItemCode = sequelize.define('CustomerItemCode', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    customerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'customerId',
        references: {
            model: 'customers',
            key: 'id',
        },
    },
    itemId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'itemId',
        references: {
            model: 'items',
            key: 'id',
        },
    },
    code: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Customer specific code for the item'
    },
    locationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'locationId',
        references: {
            model: 'locations',
            key: 'id',
        },
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'isActive',
        comment: 'Flag to indicate if the customer item code is active'
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'createdAt',
    },
    createdBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'createdBy',
        references: {
            model: 'users',
            key: 'id',
        },
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'updatedAt',
    },
    updatedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'updatedBy',
        references: {
            model: 'users',
            key: 'id',
        },
    },
}, {
    timestamps: true,
    tableName: 'customer_item_codes',
    indexes: [
        // Unique constraint to prevent duplicate codes for the same customer-item-location combination
        {
            unique: true,
            fields: ['customerId', 'itemId', 'locationId'],
            name: 'unique_customer_item_location'
        },
        // Index for faster lookups by customer
        {
            fields: ['customerId'],
            name: 'idx_customer_item_codes_customer_id'
        },
        // Index for faster lookups by item
        {
            fields: ['itemId'],
            name: 'idx_customer_item_codes_item_id'
        },
        // Index for faster lookups by code
        {
            fields: ['code'],
            name: 'idx_customer_item_codes_code'
        },
        // Index for faster lookups by location
        {
            fields: ['locationId'],
            name: 'idx_customer_item_codes_location_id'
        },
        // Index for faster lookups by active status
        {
            fields: ['isActive'],
            name: 'idx_customer_item_codes_is_active'
        }
    ]
});

module.exports = CustomerItemCode;