const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const PaymentAllocation = sequelize.define('PaymentAllocation', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    billPaymentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'bill_payments',
            key: 'id',
        },
        comment: 'Reference to bill payment'
    },
    billEntryId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'bill_entries',
            key: 'id',
        },
        comment: 'Reference to bill entry being paid'
    },
    allocatedAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Amount allocated to this bill'
    },
    currencyCode: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'LKR',
        comment: 'Currency code'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Allocation notes'
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    createdBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'User who created the allocation'
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
        comment: 'User who last updated the allocation'
    },
}, {
    timestamps: true,
    tableName: 'payment_allocations',
    indexes: [
        { fields: ['billPaymentId'] },
        { fields: ['billEntryId'] },
        { fields: ['billPaymentId', 'billEntryId'], unique: true },
    ]
});

module.exports = PaymentAllocation;
