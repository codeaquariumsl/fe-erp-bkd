const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const TimeSlot = sequelize.define('TimeSlot', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    timeslot: { type: DataTypes.STRING(10), allowNull: false },
    isBulk: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    isSpecial: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    locationId: {
        type: DataTypes.INTEGER, allowNull: false,
        references: { model: 'locations', key: 'id', },
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    }
}, {
    timestamps: true,
    tableName: 'time_slots',
});

module.exports = TimeSlot;
