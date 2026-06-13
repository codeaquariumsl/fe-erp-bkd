const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ReturnType = sequelize.define('ReturnType', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Name of the return type (e.g., Damaged, Expired, Quality Issue)'
    },
    code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Unique code for the return type'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Detailed description of the return type'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Whether this return type is active'
    },
    isRefundable: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Whether items of this return type are eligible for refund'
    },
    isReplaceable: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Whether items of this return type can be replaced'
    },
    priority: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Priority level for processing (higher number = higher priority)'
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
}, {
    timestamps: true,
    tableName: 'return_types',
});

module.exports = ReturnType;