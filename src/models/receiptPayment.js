const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ReceiptPayment = sequelize.define("ReceiptPayment", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    receiptId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    paymentTypeId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    paymentAmount: {
        type: DataTypes.DECIMAL(10, 2),
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
    isDeposited: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    bankDepositId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'bank_deposits',
            key: 'id'
        }
    },
    status: {
        type: DataTypes.ENUM('RECEIVED', 'DEPOSITED', 'CANCELLED', 'RETURNED'),
        allowNull: false,
        defaultValue: 'RECEIVED'
    },
    isCancelled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    cancelDate: {
        type: DataTypes.DATE,
        allowNull: true
    },
    cancelReason: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    cancelledBy: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    isReturned: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    returnDate: {
        type: DataTypes.DATE,
        allowNull: true
    },
    returnReason: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    returnedBy: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    settledAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    }
}, {
    tableName: "receipt_payment",
    timestamps: true,
});

ReceiptPayment.associate = (models) => {
    ReceiptPayment.belongsTo(models.Receipt, {
        foreignKey: "receiptId",
        as: "receipt"
    });
    ReceiptPayment.belongsTo(models.LedgerAccount, {
        foreignKey: "ledgerAccountId",
        as: "ledgerAccount"
    });
    ReceiptPayment.belongsTo(models.User, {
        foreignKey: "cancelledBy",
        as: "cancelledByUser"
    });
    ReceiptPayment.belongsTo(models.Bank, {
        foreignKey: "bankId",
        as: "bank"
    });
};

module.exports = ReceiptPayment;