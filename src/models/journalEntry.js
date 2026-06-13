const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const JournalEntry = sequelize.define('JournalEntry', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    journalNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Auto-generated journal number'
    },
    journalDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Journal description/narration'
    },
    referenceModule: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Module that triggered this journal: SALES, PURCHASE, INVENTORY, MANUAL',
        validate: {
            isIn: [['SALES', 'PURCHASE', 'INVENTORY', 'MANUAL', 'PAYMENT', 'RECEIPT', 'BILL_ENTRY', 'BILL_PAYMENT']]
        }
    },
    referenceId: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'ID of the source document (OrderID, InvoiceID, etc.)'
    },
    referenceNumber: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Reference number from source document'
    },
    totalDebit: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    totalCredit: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Draft',
        comment: 'Draft, Submitted, Approved, Posted, Rejected, Voided',
        validate: {
            isIn: [['Draft', 'Submitted', 'Approved', 'Posted', 'Rejected', 'Voided']]
        }
    },
    isAutoPosted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'True if auto-posted by system'
    },
    approvalStatus: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Pending',
        validate: {
            isIn: [['Pending', 'Approved', 'Rejected']]
        }
    },
    postedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    postedBy: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    approvedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    approvedBy: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    rejectionReason: {
        type: DataTypes.TEXT,
        allowNull: true
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
    timestamps: true,
    tableName: 'journal_entries',
    indexes: [
        { fields: ['journalNumber'], unique: true },
        { fields: ['journalDate'] },
        { fields: ['referenceModule'] },
        { fields: ['referenceId'] },
        { fields: ['status'] },
        { fields: ['isAutoPosted'] }
    ]
});

module.exports = JournalEntry;
