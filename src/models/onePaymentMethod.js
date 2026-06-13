const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const OnePaymentMethod = sequelize.define('OnePaymentMethod', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    onePaymentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'one_payments',
            key: 'id',
        },
        comment: 'Reference to one payment header'
    },
    lineNumber: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Payment method sequence number'
    },
    paymentMethod: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Payment method type'
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
    bankAccountId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'ledger_accounts',
            key: 'id',
        },
        comment: 'Bank account used for this payment method'
    },
    amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Amount paid via this method'
    },
    referenceNumber: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Payment reference (cheque number, transaction ID, etc.)'
    },
    chequeNumber: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Cheque number if payment method is Cheque'
    },
    chequeDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Cheque date'
    },
    bankName: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Bank name for cheque or transfer'
    },
    cardType: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Card type if payment method is Credit Card'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Payment method description'
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
        comment: 'User who created the payment method'
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
        comment: 'User who last updated the payment method'
    },
}, {
    timestamps: true,
    tableName: 'one_payment_methods',
    indexes: [
        { fields: ['onePaymentId'] },
        { fields: ['bankAccountId'] },
        { fields: ['paymentMethod'] },
    ]
});

module.exports = OnePaymentMethod;
