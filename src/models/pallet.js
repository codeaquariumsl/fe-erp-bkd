const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Pallet = sequelize.define('Pallet', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    palletRackId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'pallet_racks', key: 'id' }
    },
    itemId: { type: DataTypes.INTEGER, allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    unit: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'stored' }
}, { 
    timestamps: true,
    tableName: 'pallets',
});

module.exports = Pallet;
