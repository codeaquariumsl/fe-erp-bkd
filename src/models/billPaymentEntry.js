const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const BillPaymentEntry = sequelize.define('BillPaymentEntry', {
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
        onDelete: 'CASCADE',
        comment: 'Reference to parent BillPayment'
    },
    billEntryId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'bill_entries',
            key: 'id',
        },
        comment: 'Reference to BillEntry being paid'
    },
    taxRate: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Tax percentage (VAT/GST)'
    },
    taxAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Tax amount (VAT/GST)'
    },
    amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Amount allocated to this bill'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Payment allocation description'
    },
    lineNumber: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Line sequence number'
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
        comment: 'User who created this entry'
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
        comment: 'User who last updated this entry'
    },
}, {
    timestamps: true,
    tableName: 'bill_payment_entries',
    indexes: [
        { fields: ['billPaymentId'] },
        { fields: ['billEntryId'] },
        { fields: ['billPaymentId', 'lineNumber'], unique: true },
    ]
});

module.exports = BillPaymentEntry;
