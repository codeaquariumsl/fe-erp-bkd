const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const CreditNote = sequelize.define('CreditNote', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    creditNoteNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Auto-generated credit note number (e.g., CN-001)'
    },
    customerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'customers',
            key: 'id',
        },
        comment: 'Reference to the customer'
    },
    invoiceId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'invoices',
            key: 'id',
        },
        comment: 'Related invoice if applicable'
    },
    customerReturnId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'customer_returns',
            key: 'id',
        },
        comment: 'Related customer return if applicable'
    },
    creditNoteDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'Date of the credit note'
    },
    reason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Reason for issuing the credit note'
    },
    isTaxCreditNote: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether this is a tax credit note'
    },
    taxRate: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0.0,
        comment: 'Tax rate applied'
    },
    taxAmount: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0.0,
        comment: 'Total tax amount'
    },
    subtotal: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Subtotal before tax'
    },
    total: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Total credit note amount'
    },
    appliedAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Amount already applied to invoices or refunded'
    },
    status: {
        type: DataTypes.ENUM('Draft', 'Pending', 'Approved', 'Rejected', 'Applied', 'Cancelled'),
        allowNull: false,
        defaultValue: 'Draft',
        comment: 'Status of the credit note'
    },
    approvedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'User who approved the credit note'
    },
    approvedDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Date when credit note was approved'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Additional notes or comments'
    },
    locationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'locations',
            key: 'id',
        },
        comment: 'Location where credit note is issued'
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
    tableName: 'credit_notes',
});

module.exports = CreditNote;
