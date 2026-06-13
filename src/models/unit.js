const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Unit = sequelize.define('Unit', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Name of the unit (e.g., Kilogram, Liter, Piece)'
    },
    code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Unique code for the unit (e.g., KG, L, PC)'
    },
    symbol: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Symbol representation of the unit (e.g., kg, l, pcs)'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Detailed description of the unit'
    },
    unitType: {
        type: DataTypes.ENUM('WEIGHT', 'VOLUME', 'LENGTH', 'AREA', 'COUNT', 'TIME', 'OTHER'),
        allowNull: false,
        defaultValue: 'COUNT',
        comment: 'Type/category of the unit'
    },
    baseUnit: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Base unit for conversion (if applicable)'
    },
    conversionFactor: {
        type: DataTypes.DECIMAL(10, 6),
        allowNull: true,
        defaultValue: 1.000000,
        comment: 'Factor to convert to base unit'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Whether this unit is active'
    },
    isDecimalAllowed: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Whether decimal values are allowed for this unit'
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
    },
}, {
    timestamps: true,
    tableName: 'units',
});

module.exports = Unit;