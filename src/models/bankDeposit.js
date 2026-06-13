const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const BankDeposit = sequelize.define('BankDeposit', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    depositNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Auto-generated deposit number (e.g., BD-001)'
    },
    depositDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'Date of deposit'
    },
    bankAccountId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'ledger_accounts',
            key: 'id',
        },
        comment: 'Destination bank account (Ledger Account)'
    },
    locationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Location where the deposit is made'
    },
    totalAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Total deposit amount'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Deposit description/narration'
    },
    referenceNumber: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Bank slip/reference number'
    },
    status: {
        type: DataTypes.ENUM('Draft', 'Submitted', 'Approved', 'Posted', 'Rejected', 'Cancelled'),
        allowNull: false,
        defaultValue: 'Draft',
        comment: 'Deposit status in workflow'
    },
    approvalStatus: {
        type: DataTypes.ENUM('Pending', 'Approved', 'Rejected'),
        allowNull: false,
        defaultValue: 'Pending',
        comment: 'Approval status'
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
    approvedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When deposit was approved'
    },
    approvedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'User who approved the deposit'
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
    },
}, {
    timestamps: true,
    tableName: 'bank_deposits',
    indexes: [
        { fields: ['depositNumber'], unique: true },
        { fields: ['depositDate'] },
        { fields: ['bankAccountId'] },
        { fields: ['status'] },
    ]
});

module.exports = BankDeposit;
