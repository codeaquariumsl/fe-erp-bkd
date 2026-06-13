const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const BillPayment = sequelize.define('BillPayment', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    paymentNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Auto-generated payment number (e.g., BP-001)'
    },
    supplierId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'suppliers',
            key: 'id',
        },
        comment: 'Reference to supplier'
    },
    paymentDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'Date of payment'
    },
    amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Payment amount'
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
        comment: 'Payment description/narration'
    },
    referenceNumber: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Bank transaction reference/cheque number'
    },
    status: {
        type: DataTypes.ENUM('Draft', 'Submitted', 'Approved', 'Posted', 'Rejected', 'Cancelled'),
        allowNull: false,
        defaultValue: 'Draft',
        comment: 'Payment status in workflow'
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
    transactionHeaderId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'transaction_headers',
            key: 'id',
        },
        comment: 'Link to transaction header'
    },
    rejectionReason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Reason for rejection'
    },
    postedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When payment was posted'
    },
    postedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'User who posted the payment'
    },
    approvedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When payment was approved'
    },
    approvedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'User who approved the payment'
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
        comment: 'User who created the payment'
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
        comment: 'User who last updated the payment'
    },
}, {
    timestamps: true,
    tableName: 'bill_payments',
    indexes: [
        { fields: ['paymentNumber'], unique: true },
        { fields: ['supplierId'] },
        { fields: ['paymentDate'] },
        { fields: ['status'] },
    ]
});

module.exports = BillPayment;
