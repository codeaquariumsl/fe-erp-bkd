const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const BankDepositItem = sequelize.define('BankDepositItem', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    bankDepositId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'bank_deposits',
            key: 'id',
        },
        onDelete: 'CASCADE',
    },
    receiptPaymentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'receipt_payment',
            key: 'id',
        },
        comment: 'Link to specific receipt payment'
    },
    ledgerAccountId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'ledger_accounts',
            key: 'id',
        },
        comment: 'Link to specific ledger account (for cash deposits)'
    },
    amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Amount deposited for this item'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
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
    tableName: 'bank_deposit_items',
    indexes: [
        { fields: ['bankDepositId'] },
        { fields: ['receiptPaymentId'] },
    ]
});

module.exports = BankDepositItem;
