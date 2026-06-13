const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Supplier = sequelize.define('Supplier', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    type: {
        type: DataTypes.ENUM('Foreign', 'Local'),
        allowNull: false,
    },
    ledgerType: {
        type: DataTypes.ENUM('Expense', 'Trade'),
        allowNull: false,
    },
    contactPerson: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    email: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    address: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    country: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    status: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    locationId: {
        type: DataTypes.INTEGER, allowNull: false,
        references: { model: 'locations', key: 'id', },
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
    },
    ledgerAccountId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'ledger_accounts',
            key: 'id',
        },
    }
}, {
    timestamps: true,
    tableName: 'suppliers',
});

module.exports = Supplier;
