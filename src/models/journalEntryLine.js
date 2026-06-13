const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const JournalEntryLine = sequelize.define('JournalEntryLine', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
    },
    journalEntryId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { 
            model: 'journal_entries', 
            key: 'id' 
        }
    },
    ledgerAccountId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { 
            model: 'ledger_accounts', 
            key: 'id' 
        }
    },
    debitAmount: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    creditAmount: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    description: { 
        type: DataTypes.TEXT, 
        allowNull: true,
        comment: 'Line-level description/narration'
    },
    lineNumber: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Sequential line number in journal'
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
    tableName: 'journal_entry_lines',
    indexes: [
        { fields: ['journalEntryId'] },
        { fields: ['ledgerAccountId'] }
    ]
});

module.exports = JournalEntryLine;
