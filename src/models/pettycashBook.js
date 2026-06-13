const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const PettyCashBook = sequelize.define('PettyCashBook', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
    },
    pettyCashCode: { 
        type: DataTypes.STRING, 
        allowNull: false, 
        unique: true,
        comment: 'Auto-generated code'
    },
    name: { 
        type: DataTypes.STRING, 
        allowNull: false,
        comment: 'e.g., Branch A Petty Cash'
    },
    location: { 
        type: DataTypes.STRING, 
        allowNull: false 
    },
    custodian: { 
        type: DataTypes.STRING, 
        allowNull: false,
        comment: 'Person responsible for petty cash'
    },
    initialAmount: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    currentBalance: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    ledgerAccountId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { 
            model: 'ledger_accounts', 
            key: 'id' 
        }
    },
    status: { 
        type: DataTypes.STRING, 
        allowNull: false, 
        defaultValue: 'Active',
        validate: {
            isIn: [['Active', 'Inactive']]
        }
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
    tableName: 'petty_cash_books',
    indexes: [
        { fields: ['pettyCashCode'], unique: true },
        { fields: ['location'] }
    ]
});

module.exports = PettyCashBook;
