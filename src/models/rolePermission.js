const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const RolePermission = sequelize.define('RolePermission', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    roleId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'roles',
            key: 'id',
        },
        onDelete: 'CASCADE',
    },
    permissionId: {
        type: DataTypes.STRING(255),
        allowNull: false,
        references: {
            model: 'permissions',
            key: 'id',
        },
        onDelete: 'CASCADE',
    },
}, {
    timestamps: true,
    tableName: 'role_permissions',
    createdAt: 'createdAt',
    updatedAt: false, // Only track creation time for role permissions
    indexes: [
        {
            unique: true,
            fields: ['roleId', 'permissionId'],
            name: 'unique_role_permission'
        }
    ]
});

module.exports = RolePermission;
