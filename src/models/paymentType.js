const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const PaymentType = sequelize.define('PaymentType', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    paymentTypeName: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    description: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
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
    tableName: 'payment_type',
    timestamps: true,      // createdAt, updatedAt
    // underscored: true
});

PaymentType.associate = (models) => {
    PaymentType.belongsTo(models.User, {
        foreignKey: 'createdBy',
        as: 'Creator'
    });
    PaymentType.belongsTo(models.User, {
        foreignKey: 'updatedBy',
        as: 'Updater'
    });
    PaymentType.hasMany(models.ReceiptPayment, {
        foreignKey: 'paymentTypeId',
        as: 'payments'
    });
};

module.exports = PaymentType;