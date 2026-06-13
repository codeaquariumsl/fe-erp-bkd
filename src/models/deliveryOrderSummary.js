const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const DeliveryOrderSummary = sequelize.define('DeliveryOrderSummary', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING, allowNull: false },
  dateTime: { type: DataTypes.DATE, allowNull: false },
  isDispatched: { type: DataTypes.BOOLEAN, defaultValue: false },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  locationId: {
    type: DataTypes.INTEGER, allowNull: false,
    references: { model: 'locations', key: 'id', },
  },
  createdBy: { type: DataTypes.INTEGER },
  updatedBy: { type: DataTypes.INTEGER },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'delivery_order_summaries',
  timestamps: true,
  updatedAt: 'updatedAt',
  createdAt: 'createdAt'
});

module.exports = DeliveryOrderSummary;
