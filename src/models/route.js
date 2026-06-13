const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Route = sequelize.define('Route', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    routeName: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    description: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    city: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    startPoint: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    endPoint: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    distanceKm: {
        type: DataTypes.FLOAT,
        allowNull: false,
    },
    estimateTime: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    vehicleId: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    driverId: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    customerIds: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Array of customer IDs assigned to this route'
    },
    days: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Array of days when this route is active (e.g., ["Monday", "Friday"])'
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Active',
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
    }
}, {
    timestamps: true,
    tableName: 'routes',
});

module.exports = Route;
