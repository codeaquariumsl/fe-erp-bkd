const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const PettyCashPaymentLine = sequelize.define('PettyCashPaymentLine', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    pettyCashPaymentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'petty_cash_payments',
            key: 'id',
        },
        comment: 'Reference to petty cash payment header'
    },
    lineNumber: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Line sequence number'
    },
    categoryId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'petty_cash_categories',
            key: 'id',
        },
        comment: 'Petty cash category'
    },
    ledgerAccountId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'ledger_accounts',
            key: 'id',
        },
        comment: 'Ledger account for this line'
    },
    amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Line amount'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Line description'
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
    tableName: 'petty_cash_payment_lines',
    indexes: [
        { fields: ['pettyCashPaymentId'] },
        { fields: ['categoryId'] },
        { fields: ['ledgerAccountId'] }
    ]
});

module.exports = PettyCashPaymentLine;
