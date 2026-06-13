const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const PettyCashPayment = sequelize.define('PettyCashPayment', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    paymentNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Auto-generated payment number'
    },
    paymentDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'Date of payment'
    },
    pettyCashBookId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'petty_cash_books',
            key: 'id',
        },
        comment: 'Reference to petty cash book'
    },
    totalAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Total payment amount'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Payment description'
    },
    status: {
        type: DataTypes.ENUM('Draft', 'Approved', 'Posted', 'Cancelled'),
        allowNull: false,
        defaultValue: 'Draft',
        comment: 'Payment status'
    },
    journalEntryId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'journal_entries',
            key: 'id',
        }
    },
    transactionHeaderId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'transaction_headers',
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
    tableName: 'petty_cash_payments',
    indexes: [
        { fields: ['paymentNumber'], unique: true },
        { fields: ['paymentDate'] },
        { fields: ['pettyCashBookId'] },
        { fields: ['status'] }
    ]
});

module.exports = PettyCashPayment;
