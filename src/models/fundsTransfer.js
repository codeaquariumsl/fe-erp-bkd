const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const FundsTransfer = sequelize.define('FundsTransfer', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    transferNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Auto-generated transfer number (e.g., FT-001)'
    },
    transferDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'Transfer date'
    },
    sourceBankAccountId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'ledger_accounts',
            key: 'id',
        },
        comment: 'Source bank account'
    },
    destinationBankAccountId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'ledger_accounts',
            key: 'id',
        },
        comment: 'Destination bank account'
    },
    amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Transfer amount'
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
        comment: 'Transfer description/narration'
    },
    referenceNumber: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Bank reference number'
    },
    status: {
        type: DataTypes.ENUM('Draft', 'Submitted', 'Approved', 'Posted', 'Rejected', 'Cancelled'),
        allowNull: false,
        defaultValue: 'Draft',
        comment: 'Transfer status in workflow'
    },
    approvalStatus: {
        type: DataTypes.ENUM('Pending', 'Approved', 'Rejected'),
        allowNull: false,
        defaultValue: 'Pending',
        comment: 'Approval status'
    },
    reconciliationStatus: {
        type: DataTypes.ENUM('Pending', 'Reconciled', 'Mismatch', 'Cancelled'),
        allowNull: false,
        defaultValue: 'Pending',
        comment: 'Bank reconciliation status'
    },
    journalEntryId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'journal_entries',
            key: 'id',
        },
        comment: 'Link to auto-generated journal entry'
    },
    rejectionReason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Reason for rejection'
    },
    cancellationReason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Reason for cancellation'
    },
    postedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When transfer was posted'
    },
    postedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'User who posted the transfer'
    },
    approvedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When transfer was approved'
    },
    approvedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'User who approved the transfer'
    },
    reconciledAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When transfer was reconciled'
    },
    reconciledBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'User who reconciled the transfer'
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
        comment: 'User who created the transfer'
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
        comment: 'User who last updated the transfer'
    },
}, {
    timestamps: true,
    tableName: 'funds_transfers',
    indexes: [
        { fields: ['transferNumber'], unique: true },
        { fields: ['transferDate'] },
        { fields: ['sourceBankAccountId'] },
        { fields: ['destinationBankAccountId'] },
        { fields: ['status'] },
        { fields: ['reconciliationStatus'] },
    ]
});

module.exports = FundsTransfer;
