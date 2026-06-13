const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AccountCategory = sequelize.define('AccountCategory', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'A unique code for the account category'
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'e.g., Current Assets, Fixed Assets, Current Liabilities'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    accountTypeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'account_types',
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
    tableName: 'account_categories',
    indexes: [
        { fields: ['accountTypeId'] },
        { fields: ['status'] }
    ]
});

module.exports = AccountCategory;
