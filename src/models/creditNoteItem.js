const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const CreditNoteItem = sequelize.define('CreditNoteItem', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    creditNoteId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'credit_notes',
            key: 'id',
        },
        comment: 'Reference to the credit note'
    },
    itemId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'items',
            key: 'id',
        },
        comment: 'Reference to the item'
    },
    invoiceItemId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'invoice_items',
            key: 'id',
        },
        comment: 'Reference to original invoice item if applicable'
    },
    customerReturnItemId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'customer_return_items',
            key: 'id',
        },
        comment: 'Reference to customer return item if applicable'
    },
    code: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Customer specific code for the item'
    },
    qty: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Quantity being credited'
    },
    unitPrice: {
        type: DataTypes.FLOAT,
        allowNull: false,
        comment: 'Unit price of the item'
    },
    discount: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: 0,
            max: 100,
            isFloat: true
        },
        comment: 'Discount percentage'
    },
    discountedAmount: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0.0,
        comment: 'Amount after discount'
    },
    isTaxItem: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether tax applies to this item'
    },
    excludingTaxAmount: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0.0,
        comment: 'Amount excluding tax'
    },
    total: {
        type: DataTypes.FLOAT,
        allowNull: false,
        comment: 'Total amount for this line item'
    },
    reason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Specific reason for this item credit'
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
    tableName: 'credit_note_items',
});

module.exports = CreditNoteItem;
