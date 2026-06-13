const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Receipt = sequelize.define("Receipt", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    receiptNo: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    receiptDate: {
        type: DataTypes.DATE,
        allowNull: false
    },
    locationId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    customerId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    totalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Total invoice amount across all invoices'
    },
    totalPaid: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    totalBalance: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Remaining balance across all invoices'
    },
    totalReturnAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.00
    },
    totalCreditNoteAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.00
    },
    isSettled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    remarks: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    printedCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
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
    tableName: "receipt",
    timestamps: true,
});

Receipt.associate = (models) => {
    Receipt.belongsTo(models.Customer, {
        foreignKey: "customerId",
        as: "Customer"
    });
    Receipt.belongsTo(models.User, {
        foreignKey: "createdBy",
        as: "Creator"
    });
    Receipt.belongsTo(models.User, {
        foreignKey: "updatedBy",
        as: "Updater"
    });
    Receipt.hasMany(models.ReceiptPayment, {
        foreignKey: "receiptId",
        as: "payments"
    });
    Receipt.hasMany(models.ReceiptInvoice, {
        foreignKey: "receiptId",
        as: "invoices"
    });
};

module.exports = Receipt;