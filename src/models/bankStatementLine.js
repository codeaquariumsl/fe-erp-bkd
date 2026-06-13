const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const BankStatementLine = sequelize.define('BankStatementLine', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    bankStatementId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'bank_statements',
            key: 'id',
        },
        comment: 'Reference to bank statement'
    },
    lineNumber: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Line number in statement'
    },
    transactionDate: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Transaction date'
    },
    valueDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Value date'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'Transaction description'
    },
    referenceNumber: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Reference/cheque number'
    },
    debitAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Debit amount (withdrawals)'
    },
    creditAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Credit amount (deposits)'
    },
    balance: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        comment: 'Running balance after transaction'
    },
    transactionType: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Transaction type (e.g., CHQ, TRF, ATM, etc.)'
    },
    isReconciled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether this line has been reconciled'
    },
    reconciledWith: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'bank_reconciliation_items',
            key: 'id',
        },
        comment: 'ID of the reconciliation item matched with this line'
    },
    remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Line-specific remarks'
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
    tableName: 'bank_statement_lines',
    indexes: [
        { fields: ['bankStatementId'] },
        { fields: ['lineNumber'] },
        { fields: ['transactionDate'] },
        { fields: ['isReconciled'] },
        { fields: ['reconciledWith'] },
    ]
});

module.exports = BankStatementLine;
