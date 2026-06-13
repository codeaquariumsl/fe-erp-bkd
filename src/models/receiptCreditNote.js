const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ReceiptCreditNote = sequelize.define("ReceiptCreditNote", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    receiptId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'receipt',
            key: 'id'
        }
    },
    creditNoteId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'credit_notes',
            key: 'id'
        }
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    }
}, {
    tableName: "receipt_credit_note",
    timestamps: true,
});

ReceiptCreditNote.associate = (models) => {
    ReceiptCreditNote.belongsTo(models.Receipt, {
        foreignKey: "receiptId",
        as: "Receipt"
    });
    ReceiptCreditNote.belongsTo(models.CreditNote, {
        foreignKey: "creditNoteId",
        as: "CreditNote"
    });
};

module.exports = ReceiptCreditNote;
