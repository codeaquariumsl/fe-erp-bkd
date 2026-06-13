const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const ColdRoom = require('./coldRoom');

const PalletRack = sequelize.define('PalletRack', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    code: { type: DataTypes.STRING, allowNull: false, unique: true, },
    capacity: { type: DataTypes.INTEGER, allowNull: false, },
    availableQty: { type: DataTypes.INTEGER, allowNull: true },
    weight: { type: DataTypes.FLOAT, allowNull: true },
    reservedQty: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    occupied: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    coldRoomId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'cold_rooms', // must match the tableName in ColdRoom
            key: 'id',
        },
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'active',
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
    tableName: 'pallet_racks',
});

// Association

module.exports = PalletRack;
