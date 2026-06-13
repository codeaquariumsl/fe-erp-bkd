const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const TransactionDetail = sequelize.define('TransactionDetail', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    transactionHeaderId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Link to TransactionHeader'
    },
    journalEntryLineId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Link to JournalEntryLine'
    },
    ledgerAccountId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Ledger account ID'
    },
    lineNumber: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },
    debitAmount: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    creditAmount: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    createdBy: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    isReconciled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Wait for bank reconciliation'
    },
    reconciledAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    reconciledBy: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'transaction_details',
    timestamps: false,
    createdAt: 'createdAt',
    indexes: [
        { fields: ['transactionHeaderId'] },
        { fields: ['journalEntryLineId'] },
        { fields: ['ledgerAccountId'] },
        { fields: ['transactionHeaderId', 'lineNumber'] }
    ]
});

module.exports = TransactionDetail;
