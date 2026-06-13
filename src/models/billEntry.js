const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const BillEntry = sequelize.define('BillEntry', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    billNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Auto-generated bill number (e.g., BE-001)'
    },
    supplierInvoiceNumber: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Supplier invoice number'
    },
    supplierId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'suppliers',
            key: 'id',
        },
        comment: 'Reference to supplier'
    },
    billDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'Bill/Invoice date from supplier'
    },
    dueDate: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Payment due date'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Bill description/narration'
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
    purchaseOrderId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'purchase_orders',
            key: 'id',
        },
        comment: 'Related purchase order if applicable'
    },
    amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Bill amount before tax'
    },
    taxRate: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Tax percentage (VAT/GST)'
    },
    taxAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Tax amount (VAT/GST)'
    },
    totalAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Total amount including tax'
    },
    paidAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Amount already paid'
    },
    currencyCode: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'LKR',
        comment: 'Currency code (LKR, USD, etc.)'
    },
    paymentTerms: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: 'Net 30',
        comment: 'Payment terms description'
    },
    status: {
        type: DataTypes.ENUM('Draft', 'Submitted', 'Approved', 'Posted', 'Rejected', 'Voided', 'Partially Paid', 'Paid'),
        allowNull: false,
        defaultValue: 'Draft',
        comment: 'Bill status in workflow'
    },
    approvalStatus: {
        type: DataTypes.ENUM('Pending', 'Approved', 'Rejected'),
        allowNull: false,
        defaultValue: 'Pending',
        comment: 'Approval status'
    },
    journalEntryId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'journal_entries',
            key: 'id',
        },
        comment: 'Link to auto-generated journal entry'
    },
    rejectionReason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Reason for rejection'
    },
    postedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When bill was posted'
    },
    postedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'User who posted the bill'
    },
    approvedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When bill was approved'
    },
    approvedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'User who approved the bill'
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
        comment: 'User who created the bill'
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
        comment: 'User who last updated the bill'
    },
}, {
    timestamps: true,
    tableName: 'bill_entries',
    indexes: [
        { fields: ['billNumber'], unique: true },
        { fields: ['supplierId'] },
        { fields: ['billDate'] },
        { fields: ['dueDate'] },
        { fields: ['status'] },
        { fields: ['grnId'] },
        { fields: ['purchaseOrderId'] },
    ]
});

module.exports = BillEntry;
