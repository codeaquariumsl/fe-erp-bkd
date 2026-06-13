const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const BankBranch = sequelize.define('BankBranch', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    bankId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'banks',
            key: 'id'
        }
    },
    branchCode: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Branch Code (e.g., 001)'
    },
    branchName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    swiftCode: {
        type: DataTypes.STRING,
        allowNull: true
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
        allowNull: true,
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
    tableName: 'bank_branches',
    indexes: [
        { fields: ['bankId'] },
        { fields: ['bankId', 'branchCode'], unique: true }
    ]
});

module.exports = BankBranch;
