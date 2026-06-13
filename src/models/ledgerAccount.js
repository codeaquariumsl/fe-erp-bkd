const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const LedgerAccount = sequelize.define('LedgerAccount', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    ledgerCode: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'System-generated ledger code'
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Ledger name e.g., Cash in Hand, Bank of Ceylon - Current'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    accountTypeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'account_types',
            key: 'id'
        }
    },
    accountCategoryId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'account_categories',
            key: 'id'
        }
    },
    isUseControlAccount: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    controlAccountId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'control_accounts',
            key: 'id'
        }
    },
    openingBalance: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Opening balance amount'
    },
    openingBalanceType: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'DR',
        validate: {
            isIn: [['DR', 'CR']]
        },
        comment: 'Debit or Credit'
    },
    ledgerType: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'GENERAL',
        validate: {
            isIn: [['GENERAL', 'SYSTEM', 'BANK', 'CASH', 'PETTY_CASH', 'CASH_BOOK']]
        }
    },
    isBankLedger: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    bankId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'banks',
            key: 'id'
        }
    },
    branchId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'bank_branches',
            key: 'id'
        }
    },
    accountNumber: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    accountHolderName: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    cashBookLedgerId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'ledger_accounts',
            key: 'id'
        }
    },
    pettyCashAmount: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Petty cash amount'
    },
    bufferLevel: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Buffer level'
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Active',
        validate: {
            isIn: [['Active', 'Inactive']]
        }
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
    tableName: 'ledger_accounts',
    indexes: [
        { fields: ['ledgerCode'], unique: true },
        { fields: ['accountTypeId'] },
        { fields: ['accountCategoryId'] },
        { fields: ['controlAccountId'] },
        { fields: ['status'] }
    ]
});

module.exports = LedgerAccount;
