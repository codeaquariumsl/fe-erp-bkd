const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const OnePayment = sequelize.define('OnePayment', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    paymentNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Auto-generated payment number (e.g., OP-000001)'
    },
    paymentDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'Payment date'
    },
    totalDebitAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Total debit amount from all lines'
    },
    totalCreditAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Total credit amount from all lines'
    },
    totalPaymentAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Total payment amount from all payment methods'
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
        comment: 'External reference number'
    },
    status: {
        type: DataTypes.ENUM('Draft', 'Submitted', 'Approved', 'Posted', 'Rejected', 'Cancelled', 'Reversed'),
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
    rejectionReason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Reason for rejection'
    },
    reversalReason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Reason for reversal'
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
    reversedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When payment was reversed'
    },
    reversedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'User who reversed the payment'
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
    tableName: 'one_payments',
    indexes: [
        { fields: ['paymentNumber'], unique: true },
        { fields: ['paymentDate'] },
        { fields: ['status'] },
    ]
});

module.exports = OnePayment;
