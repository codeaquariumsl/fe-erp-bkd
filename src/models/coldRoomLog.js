const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const ColdRoom = require('./coldRoom');

const ColdRoomLog = sequelize.define('ColdRoomLog', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    coldRoomId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'cold_rooms', key: 'id' } },
    timestamp: { type: DataTypes.DATE, allowNull: false },
    temperature: { type: DataTypes.FLOAT },
    humidity: { type: DataTypes.FLOAT },
    status: { type: DataTypes.STRING }
}, {
    tableName: 'cold_room_logs',
    timestamps: false
});

ColdRoom.hasMany(ColdRoomLog, { foreignKey: 'coldRoomId' });
ColdRoomLog.belongsTo(ColdRoom, { foreignKey: 'coldRoomId' });

module.exports = ColdRoomLog;
