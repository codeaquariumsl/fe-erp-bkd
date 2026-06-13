const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ReceiptInvoice = sequelize.define("ReceiptInvoice", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    receiptId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'receipt',
            key: 'id'
        }
    },
    invoiceId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'invoices',
            key: 'id'
        }
    },
    invoiceAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    paidAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    balanceAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    }
}, {
    tableName: "receipt_invoice",
    timestamps: true,
});

ReceiptInvoice.associate = (models) => {
    ReceiptInvoice.belongsTo(models.Receipt, {
        foreignKey: "receiptId",
        as: "receipt"
    });
    ReceiptInvoice.belongsTo(models.Invoice, {
        foreignKey: "invoiceId",
        as: "invoice"
    });
};

module.exports = ReceiptInvoice;
