const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Permission = sequelize.define('Permission', {
    id: {
        type: DataTypes.STRING(255),
        primaryKey: true,
        allowNull: false,
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    module: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    action: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
}, {
    timestamps: true,
    tableName: 'permissions',
    createdAt: 'createdAt',
    updatedAt: false, // Only track creation time for permissions
});

module.exports = Permission;
