const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const PettyCashReimbursement = sequelize.define('PettyCashReimbursement', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    reimbursementNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Auto-generated reimbursement number'
    },
    reimbursementDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'Date of reimbursement'
    },
    pettyCashBookId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'petty_cash_books',
            key: 'id',
        },
        comment: 'Target petty cash book'
    },
    sourceLedgerAccountId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'ledger_accounts',
            key: 'id',
        },
        comment: 'Source account (Cash/Bank)'
    },
    amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Reimbursement amount'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Reimbursement description'
    },
    status: {
        type: DataTypes.ENUM('Draft', 'Approved', 'Posted', 'Cancelled'),
        allowNull: false,
        defaultValue: 'Draft',
        comment: 'Reimbursement status'
    },
    transactionHeaderId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'transaction_headers',
            key: 'id'
        }
    },
    locationId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'locations',
            key: 'id'
        }
    },
    approvedAt: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    approvedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' }
    },
    postedAt: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    postedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' }
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    createdBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    updatedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
    }
}, {
    timestamps: true,
    tableName: 'petty_cash_reimbursements',
    indexes: [
        { fields: ['reimbursementNumber'], unique: true },
        { fields: ['reimbursementDate'] },
        { fields: ['pettyCashBookId'] },
        { fields: ['status'] }
    ]
});

module.exports = PettyCashReimbursement;
