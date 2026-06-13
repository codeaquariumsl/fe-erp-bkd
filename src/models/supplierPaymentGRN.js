const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const SupplierPaymentGRN = sequelize.define('SupplierPaymentGRN', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    supplierPaymentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'supplier_payments',
            key: 'id',
        },
        onDelete: 'CASCADE',
        comment: 'Reference to parent SupplierPayment'
    },
    grnId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'grns',
            key: 'id',
        },
        comment: 'Reference to GRN'
    },
    grnAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Amount from GRN being paid'
    },
    paidAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        comment: 'Amount paid towards this GRN'
    },
    pendingAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Amount still pending for this GRN'
    },
    currency: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'LKR',
        comment: 'Payment currency'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Notes for this GRN payment line'
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
    }
}, {
    timestamps: true,
    tableName: 'supplier_payment_grns',
    indexes: [
        {
            fields: ['supplierPaymentId', 'grnId'],
            unique: true,
            name: 'unique_payment_grn'
        }
    ]
});

module.exports = SupplierPaymentGRN;
