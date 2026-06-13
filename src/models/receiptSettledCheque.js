const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ReceiptSettledCheque = sequelize.define('ReceiptSettledCheque', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    receiptId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'receipt', key: 'id' }
    },
    receiptPaymentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'receipt_payment', key: 'id' }
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    }
}, {
    tableName: 'receipt_settled_cheque',
    timestamps: true
});

module.exports = ReceiptSettledCheque;
