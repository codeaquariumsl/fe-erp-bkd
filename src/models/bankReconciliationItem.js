const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const BankReconciliationItem = sequelize.define('BankReconciliationItem', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    bankReconciliationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'bank_reconciliations',
            key: 'id',
        },
        comment: 'Reference to bank reconciliation'
    },
    transactionType: {
        type: DataTypes.ENUM('Book', 'Statement'),
        allowNull: false,
        comment: 'Whether this is a book transaction or statement transaction'
    },
    transactionDate: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Transaction date'
    },
    valueDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Value date (for bank statement items)'
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
        comment: 'Running balance (for statement items)'
    },
    isReconciled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether this item has been reconciled'
    },
    reconciledWith: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'bank_reconciliation_items',
            key: 'id',
        },
        comment: 'ID of the matching item (book item matched with statement item)'
    },
    journalEntryId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'journal_entries',
            key: 'id',
        },
        comment: 'Link to journal entry (for book transactions)'
    },
    journalEntryLineId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'journal_entry_lines',
            key: 'id',
        },
        comment: 'Link to specific journal entry line'
    },
    receiptId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'receipt',
            key: 'id',
        },
        comment: 'Link to receipt (for customer payments)'
    },
    billPaymentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'bill_payments',
            key: 'id',
        },
        comment: 'Link to bill payment (for supplier payments)'
    },
    fundsTransferId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'funds_transfers',
            key: 'id',
        },
        comment: 'Link to funds transfer'
    },
    bankStatementLineId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'bank_statement_lines',
            key: 'id',
        },
        comment: 'Link to bank statement line (for statement transactions)'
    },
    transactionDetailId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'transaction_details',
            key: 'id'
        },
        comment: 'Link to General Ledger transaction detail'
    },
    reconciliationType: {
        type: DataTypes.ENUM('Matched', 'Outstanding Deposit', 'Outstanding Withdrawal', 'Bank Charge', 'Bank Interest', 'Adjustment', 'Error'),
        allowNull: true,
        comment: 'Type of reconciliation item'
    },
    remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Item-specific remarks'
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
        comment: 'User who created the item'
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
        comment: 'User who last updated the item'
    },
}, {
    timestamps: true,
    tableName: 'bank_reconciliation_items',
    indexes: [
        { fields: ['bankReconciliationId'] },
        { fields: ['transactionType'] },
        { fields: ['transactionDate'] },
        { fields: ['isReconciled'] },
        { fields: ['reconciledWith'] },
        { fields: ['journalEntryId'] },
        { fields: ['bankStatementLineId'] },
    ]
});

module.exports = BankReconciliationItem;
