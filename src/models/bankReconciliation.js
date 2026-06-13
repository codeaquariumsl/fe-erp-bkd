const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const BankReconciliation = sequelize.define('BankReconciliation', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    reconciliationNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Auto-generated reconciliation number (e.g., BR-001)'
    },
    bankAccountId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'ledger_accounts',
            key: 'id',
        },
        comment: 'Bank account being reconciled (from LedgerAccount)'
    },
    reconciliationDate: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Date of reconciliation'
    },
    statementDate: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Bank statement date'
    },
    statementPeriodFrom: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Statement period start date'
    },
    statementPeriodTo: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Statement period end date'
    },
    openingBalance: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Opening balance as per bank statement'
    },
    closingBalance: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Closing balance as per bank statement'
    },
    bookOpeningBalance: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Opening balance as per books'
    },
    bookClosingBalance: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Closing balance as per books'
    },
    totalDeposits: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Total deposits in statement'
    },
    totalWithdrawals: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Total withdrawals in statement'
    },
    reconciledDeposits: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Total reconciled deposits'
    },
    reconciledWithdrawals: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Total reconciled withdrawals'
    },
    unreconciledDeposits: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Total unreconciled deposits'
    },
    unreconciledWithdrawals: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Total unreconciled withdrawals'
    },
    difference: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Difference between bank and book balance'
    },
    status: {
        type: DataTypes.ENUM('Draft', 'In Progress', 'Reconciled', 'Approved', 'Rejected'),
        allowNull: false,
        defaultValue: 'Draft',
        comment: 'Reconciliation status'
    },
    remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Reconciliation remarks/notes'
    },
    isBalanced: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether reconciliation is balanced (difference = 0)'
    },
    approvedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When reconciliation was approved'
    },
    approvedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'User who approved the reconciliation'
    },
    rejectionReason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Reason for rejection'
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
        comment: 'User who created the reconciliation'
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
        comment: 'User who last updated the reconciliation'
    },
}, {
    timestamps: true,
    tableName: 'bank_reconciliations',
    indexes: [
        { fields: ['reconciliationNumber'], unique: true },
        { fields: ['bankAccountId'] },
        { fields: ['reconciliationDate'] },
        { fields: ['statementDate'] },
        { fields: ['status'] },
        { fields: ['isBalanced'] },
    ]
});

module.exports = BankReconciliation;
