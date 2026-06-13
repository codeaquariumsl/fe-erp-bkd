const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const OnePaymentLine = sequelize.define('OnePaymentLine', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    onePaymentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'one_payments',
            key: 'id',
        },
        comment: 'Reference to one payment header'
    },
    lineNumber: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Line sequence number'
    },
    lineType: {
        type: DataTypes.ENUM('Debit', 'Credit'),
        allowNull: false,
        comment: 'Line type - Debit or Credit'
    },
    ledgerAccountId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'ledger_accounts',
            key: 'id',
        },
        comment: 'Ledger account for this line'
    },
    amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Line amount'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Line description'
    },
    referenceType: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Reference type (e.g., BILL, SUPPLIER, EXPENSE)'
    },
    referenceId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Reference ID (e.g., bill entry id, supplier id)'
    },
    referenceNumber: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Reference number (e.g., bill number)'
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
        comment: 'User who created the line'
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
        comment: 'User who last updated the line'
    },
}, {
    timestamps: true,
    tableName: 'one_payment_lines',
    indexes: [
        { fields: ['onePaymentId'] },
        { fields: ['ledgerAccountId'] },
        { fields: ['referenceType', 'referenceId'] },
    ]
});

module.exports = OnePaymentLine;
