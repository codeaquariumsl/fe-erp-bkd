const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const TransactionHeader = sequelize.define('TransactionHeader', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    transactionNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Auto-generated transaction number'
    },
    transactionDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    transactionModule: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Source module: BILL_ENTRY, BILL_PAYMENT, ONE_PAYMENT, FUNDS_TRANSFER, BANK_DEPOSIT'
    },
    referenceModule: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Journal reference module: PURCHASE, PAYMENT, etc'
    },
    referenceNumber: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Reference document number (Bill#, Payment#, etc)'
    },
    referenceId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Reference document ID'
    },
    journalEntryId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Link to JournalEntry'
    },
    totalDebit: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    totalCredit: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Posted',
        validate: {
            isIn: [['Draft', 'Posted', 'Reversed']]
        }
    },
    createdBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'User ID who created'
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'transaction_headers',
    timestamps: true,
    indexes: [
        { fields: ['transactionNumber'] },
        { fields: ['transactionModule'] },
        { fields: ['referenceNumber'] },
        { fields: ['journalEntryId'] },
        { fields: ['transactionDate'] }
    ]
});

module.exports = TransactionHeader;
