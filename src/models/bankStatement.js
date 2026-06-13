const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const BankStatement = sequelize.define('BankStatement', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    statementNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Auto-generated statement number (e.g., BS-001)'
    },
    bankAccountId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'ledger_accounts',
            key: 'id',
        },
        comment: 'Bank account for this statement'
    },
    statementDate: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Statement date'
    },
    periodFrom: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Statement period start date'
    },
    periodTo: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Statement period end date'
    },
    openingBalance: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Opening balance'
    },
    closingBalance: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Closing balance'
    },
    totalDeposits: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Total deposits in period'
    },
    totalWithdrawals: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Total withdrawals in period'
    },
    totalTransactions: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Total number of transactions'
    },
    fileName: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Uploaded file name (if imported)'
    },
    fileType: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'File type (CSV, PDF, Excel, etc.)'
    },
    uploadedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When the file was uploaded'
    },
    status: {
        type: DataTypes.ENUM('Draft', 'Imported', 'Verified', 'Reconciled'),
        allowNull: false,
        defaultValue: 'Draft',
        comment: 'Statement status'
    },
    remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Statement remarks'
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
        comment: 'User who created the statement'
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
        comment: 'User who last updated the statement'
    },
}, {
    timestamps: true,
    tableName: 'bank_statements',
    indexes: [
        { fields: ['statementNumber'], unique: true },
        { fields: ['bankAccountId'] },
        { fields: ['statementDate'] },
        { fields: ['periodFrom'] },
        { fields: ['periodTo'] },
        { fields: ['status'] },
    ]
});

module.exports = BankStatement;
