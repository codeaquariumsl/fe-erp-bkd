const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ColdRoom = sequelize.define('ColdRoom', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    temperature: { type: DataTypes.FLOAT },
    targetTemp: { type: DataTypes.FLOAT },
    humidity: { type: DataTypes.FLOAT },
    targetHumidity: { type: DataTypes.FLOAT },
    capacity: { type: DataTypes.FLOAT },
    occupied: { type: DataTypes.FLOAT },
    status: { type: DataTypes.STRING }, // Optimal, Warning, Critical
    lastMaintenance: { type: DataTypes.DATE },
    nextMaintenance: { type: DataTypes.DATE },
    storeId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'stores',
            key: 'id',
        },
    },
    locationId: {
        type: DataTypes.INTEGER, allowNull: false,
        references: { model: 'locations', key: 'id', },
    },
}, {
    tableName: 'cold_rooms',
    timestamps: true
});

module.exports = ColdRoom;
