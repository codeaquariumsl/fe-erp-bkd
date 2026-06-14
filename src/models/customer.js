const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Customer = sequelize.define('Customer', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    type: {
        type: DataTypes.ENUM('Supermarket', 'Own Shop', 'Distributor', 'Wholesaler', 'Walking'),
        allowNull: false,
    },
    parentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'customers',
            key: 'id',
        },
    },
    address: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    contactPerson: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    contactNumber: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    email: {
        type: DataTypes.STRING,
        allowNull: true,
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
    creditLimit: {
        type: DataTypes.FLOAT,
        allowNull: true,
    },
    creditPeriod: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    isTaxInclusive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Flag to indicate if the customers prices are tax inclusive'
    },
    taxNumber: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    locationId: {
        type: DataTypes.INTEGER, allowNull: false,
        references: { model: 'locations', key: 'id', },
    },
    discountRate: {
        type: DataTypes.FLOAT,
        allowNull: false,
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'active',
    },
    ledgerAccountId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'ledger_accounts',
            key: 'id',
        },
    },
    latitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true,
    },
    longitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true,
    }
}, {
    timestamps: true,
    tableName: 'customers',
});

module.exports = Customer;
