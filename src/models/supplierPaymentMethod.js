const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const SupplierPaymentMethod = sequelize.define("SupplierPaymentMethod", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    supplierPaymentId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    paymentTypeId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    paymentAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false
    },
    ledgerAccountId: {
        type: DataTypes.INTEGER,
        allowNull: true
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
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    }
}, {
    tableName: "supplier_payment_methods",
    timestamps: true,
});

module.exports = SupplierPaymentMethod;
