const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const GRNScheduleItem = sequelize.define('GRNScheduleItem', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    scheduleDate: { type: DataTypes.DATE, allowNull: false },
    type: {
        type: DataTypes.ENUM('Supermarket', 'Own Shop', 'Distribution', 'Wholesaler', 'Walking'),
        allowNull: false,
    },
    customerId: { type: DataTypes.INTEGER, allowNull: true },
    itemId: { type: DataTypes.INTEGER, allowNull: false },
    grn1Id: { type: DataTypes.INTEGER, allowNull: false },
    grn2Id: { type: DataTypes.INTEGER, allowNull: true },
    grn3Id: { type: DataTypes.INTEGER, allowNull: true },
    price: { type: DataTypes.FLOAT, allowNull: false },
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
    tableName: 'grn_schedule_items',
});

module.exports = GRNScheduleItem;
