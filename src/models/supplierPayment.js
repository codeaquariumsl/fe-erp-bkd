const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const SupplierPayment = sequelize.define('SupplierPayment', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    paymentNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Auto-generated payment number (e.g., SP-001)'
    },
    supplierId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'suppliers',
            key: 'id',
        },
        comment: 'Reference to the supplier'
    },
    purchaseOrderId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'purchase_orders',
            key: 'id',
        },
        comment: 'Related purchase order if applicable'
    },
    grnId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'grns',
            key: 'id',
        },
        comment: 'Related GRN if applicable'
    },
    supplierReturnId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'supplier_returns',
            key: 'id',
        },
        comment: 'Related supplier return if this is a refund'
    },
    paymentDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'Date of the payment'
    },
    paymentType: {
        type: DataTypes.ENUM('Advance Payment', 'Invoice Payment', 'Refund', 'Partial Payment', 'Final Payment'),
        allowNull: false,
        defaultValue: 'Invoice Payment',
        comment: 'Type of payment'
    },
    paymentMethod: {
        type: DataTypes.ENUM('Cash', 'Bank Transfer', 'Cheque', 'Credit Card', 'Online Transfer', 'LC'),
        allowNull: false,
        defaultValue: 'Bank Transfer',
        comment: 'Method of payment'
    },
    amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Payment amount'
    },
    currency: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'LKR',
        comment: 'Payment currency'
    },
    exchangeRate: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: true,
        defaultValue: 1.0000,
        comment: 'Exchange rate if foreign currency'
    },
    amountInBaseCurrency: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Amount in base currency (LKR)'
    },
    status: {
        type: DataTypes.ENUM('Pending', 'Approved', 'Processing', 'Completed', 'Failed', 'Cancelled'),
        allowNull: false,
        defaultValue: 'Pending',
        comment: 'Payment status'
    },
    referenceNumber: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Bank reference, cheque number, or transaction ID'
    },
    bankDetails: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Bank details for the transaction (JSON format)'
    },
    chequeNumber: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Cheque number if payment method is cheque'
    },
    chequeDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Cheque date if applicable'
    },
    bankAccountId: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Company bank account used for payment'
    },
    supplierAccountDetails: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Supplier account details (JSON format)'
    },
    dueDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Payment due date'
    },
    paidDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Actual date payment was processed'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Additional notes or comments'
    },
    attachments: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'File attachments (receipts, invoices, etc.) in JSON format'
    },
    approvedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'User who approved the payment'
    },
    approvedDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Date when payment was approved'
    },
    processedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'User who processed the payment'
    },
    processedDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Date when payment was processed'
    },
    reconciled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether payment has been reconciled'
    },
    reconciledDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Date when payment was reconciled'
    },
    locationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'locations',
            key: 'id',
        },
        comment: 'Location where payment is processed'
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
    tableName: 'supplier_payments',
});

module.exports = SupplierPayment;