const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AutoPostingRule = sequelize.define('AutoPostingRule', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
    },
    ruleName: { 
        type: DataTypes.STRING, 
        allowNull: false, 
        unique: true,
        comment: 'e.g., GRN_RECEIPT, SALES_INVOICE, COGS_POSTING'
    },
    description: { 
        type: DataTypes.TEXT, 
        allowNull: true 
    },
    triggerModule: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Module that triggers auto-posting',
        validate: {
            isIn: [['PURCHASE_GRN', 'PURCHASE_INVOICE', 'SALES_INVOICE', 'STOCK_ADJUSTMENT', 
                    'STOCK_TRANSFER', 'CUSTOMER_PAYMENT', 'SUPPLIER_PAYMENT', 'SALES_RETURN', 
                    'PURCHASE_RETURN', 'COGS']]
        }
    },
    triggerEvent: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'CREATE, UPDATE, APPROVE, POST',
        validate: {
            isIn: [['CREATE', 'UPDATE', 'APPROVE', 'POST', 'RECEIVE']]
        }
    },
    debitLedgerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { 
            model: 'ledger_accounts', 
            key: 'id' 
        },
        comment: 'Default debit account for this rule'
    },
    creditLedgerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { 
            model: 'ledger_accounts', 
            key: 'id' 
        },
        comment: 'Default credit account for this rule'
    },
    debitAmount: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Formula or field path for debit amount (e.g., item_quantity * item_cost)',
        defaultValue: 'TOTAL_AMOUNT'
    },
    creditAmount: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Formula or field path for credit amount',
        defaultValue: 'TOTAL_AMOUNT'
    },
    useControlAccount: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'If true, use customer/supplier control account from transaction'
    },
    controlAccountType: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'CUSTOMER, SUPPLIER, BANK',
        validate: {
            isIn: [[null, 'CUSTOMER', 'SUPPLIER', 'BANK']]
        }
    },
    isEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    ruleOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Execution order if multiple rules apply'
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
    tableName: 'auto_posting_rules',
    indexes: [
        { fields: ['ruleName'], unique: true },
        { fields: ['triggerModule'] },
        { fields: ['isEnabled'] },
        { fields: ['debitLedgerId'] },
        { fields: ['creditLedgerId'] }
    ]
});

module.exports = AutoPostingRule;
