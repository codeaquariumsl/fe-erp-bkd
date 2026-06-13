const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const SalesPersonCustomer = sequelize.define('SalesPersonCustomer', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'The sales person (User) ID'
    },
    customerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'customers',
            key: 'id',
        },
        comment: 'The Customer ID'
    },
    assignedDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    createdBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
    },
    updatedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
    }
}, {
    timestamps: true,
    tableName: 'sales_person_customers',
    indexes: [
        {
            unique: true,
            fields: ['userId', 'customerId']
        }
    ]
});

module.exports = SalesPersonCustomer;
