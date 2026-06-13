const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ControlAccount = sequelize.define('ControlAccount', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'A unique code for the control account'
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'e.g., Customer Control Account, Supplier Control Account'
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
    accountCategoryId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'account_categories',
            key: 'id'
        }
    },
    controlType: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'CUSTOMER, SUPPLIER, BANK, INVENTORY',
        validate: {
            isIn: [['CUSTOMER', 'SUPPLIER', 'BANK', 'INVENTORY', 'OTHER']]
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
    tableName: 'control_accounts',
    indexes: [
        { fields: ['accountTypeId'] },
        { fields: ['accountCategoryId'] },
        { fields: ['controlType'] }
    ]
});

module.exports = ControlAccount;
