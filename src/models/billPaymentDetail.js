const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const BillPaymentDetail = sequelize.define('BillPaymentDetail', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    billPaymentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'bill_payments',
            key: 'id',
        },
        onDelete: 'CASCADE',
        comment: 'Reference to parent BillPayment'
    },
    amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Amount paid via this payment method'
    },
    lineNumber: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Line sequence number'
    },
    paymentTypeId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    ledgerAccountId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    referenceNo: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    bankId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    bankBranchId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    cardType: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    chequeNo: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    chequeDate: {
        type: DataTypes.DATE,
        allowNull: true
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
        comment: 'User who created this detail'
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
        comment: 'User who last updated this detail'
    },
}, {
    timestamps: true,
    tableName: 'bill_payment_details',
    indexes: [
        { fields: ['billPaymentId'] },
        { fields: ['billPaymentId', 'lineNumber'], unique: true },
    ]
});

module.exports = BillPaymentDetail;
