const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AccountType = sequelize.define('AccountType', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'A unique code for the account type'
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Asset, Liability, Income, Expense, Equity'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    drBehavior: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'increase or decrease - Debit impact',
        validate: {
            isIn: [['increase', 'decrease']]
        }
    },
    crBehavior: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'increase or decrease - Credit impact',
        validate: {
            isIn: [['increase', 'decrease']]
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
    isSystemProtected: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'System-protected types cannot be edited'
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
    tableName: 'account_types',
});

module.exports = AccountType;
