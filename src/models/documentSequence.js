const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const DocumentSequence = sequelize.define('DocumentSequence', {
  documentType: { type: DataTypes.STRING, allowNull: false },
  prefix: { type: DataTypes.STRING, allowNull: false },
  currentNumber: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  numberLength: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 },
  locationId: {
    type: DataTypes.INTEGER, allowNull: false,
    references: { model: 'locations', key: 'id', },
  },
}, {
  tableName: 'document_sequences',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['documentType', 'locationId']
    }
  ]
});

module.exports = DocumentSequence;
