const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const ColdRoom = require('./coldRoom');

const ColdRoomItem = sequelize.define('ColdRoomItem', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    coldRoomId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'cold_rooms', key: 'id' } },
    name: { type: DataTypes.STRING, allowNull: false },
    quantity: { type: DataTypes.FLOAT, allowNull: false },
    unit: { type: DataTypes.STRING, allowNull: false }
}, {
    tableName: 'cold_room_items',
    timestamps: true
});

ColdRoom.hasMany(ColdRoomItem, { foreignKey: 'coldRoomId' });
ColdRoomItem.belongsTo(ColdRoom, { foreignKey: 'coldRoomId' });

module.exports = ColdRoomItem;
