const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const BillEntryDetail = sequelize.define('BillEntryDetail', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    billEntryId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'bill_entries',
            key: 'id',
        },
        onDelete: 'CASCADE',
        comment: 'Reference to parent BillEntry'
    },
    ledgerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'ledger_accounts',
            key: 'id',
        },
        comment: 'Ledger account for this line item'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Item description/narration'
    },
    quantity: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0,
        comment: 'Quantity if applicable'
    },
    unitPrice: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0,
        comment: 'Unit price if applicable'
    },
    amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Line item amount (quantity × unitPrice or direct amount)'
    },
    taxAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        comment: 'Tax on this line item'
    },
    totalAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Total amount including tax (amount + taxAmount)'
    },
    taxPercentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        defaultValue: 0,
        comment: 'Tax percentage applied'
    },
    lineNumber: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Line sequence number'
    },
    remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Additional remarks'
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
        comment: 'User who created this detail'
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
        comment: 'User who last updated this detail'
    },
}, {
    timestamps: true,
    tableName: 'bill_entry_details',
    indexes: [
        { fields: ['billEntryId'] },
        { fields: ['ledgerId'] },
        { fields: ['billEntryId', 'lineNumber'], unique: true },
    ]
});

module.exports = BillEntryDetail;
