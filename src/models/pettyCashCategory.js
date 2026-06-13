const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const PettyCashCategory = sequelize.define('PettyCashCategory', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
    },
    name: { 
        type: DataTypes.STRING, 
        allowNull: false,
        comment: 'e.g., Tea & Meals, Travel, Stationary, Office Supplies'
    },
    description: { 
        type: DataTypes.TEXT, 
        allowNull: true 
    },
    ledgerAccountId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { 
            model: 'ledger_accounts', 
            key: 'id' 
        },
        comment: 'Expense ledger for this category'
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
    tableName: 'petty_cash_categories',
    indexes: [
        { fields: ['name'] }
    ]
});

module.exports = PettyCashCategory;
