/**
 * ACCOUNTING MODULE SETUP SCRIPT
 * 
 * This script initializes the accounting module with:
 * 1. Default Account Types
 * 2. Default Account Categories
 * 3. Control Accounts
 * 4. System Ledgers
 * 5. Default Auto-Posting Rules
 * 
 * Run this after deploying the accounting module for the first time
 */

const { 
    AccountType, 
    AccountCategory, 
    ControlAccount, 
    LedgerAccount, 
    AutoPostingRule,
    sequelize 
} = require('../src/models');

const setupAccounting = async (userId = 1) => {
    try {
        console.log('🚀 Starting Accounting Module Setup...');

        // Sync database to create tables if they don't exist
        console.log('📊 Syncing database tables...');
        await sequelize.sync({ alter: false });
        console.log('✅ Database tables synchronized');

        // ===== STEP 1: CREATE ACCOUNT TYPES =====
        console.log('\n📋 Creating Account Types...');
        
        const accountTypes = {
            ASSET: await AccountType.findOrCreate({
                where: { name: 'Asset' },
                defaults: {
                    name: 'Asset',
                    description: 'Resources owned by the business',
                    drBehavior: 'increase',
                    crBehavior: 'decrease',
                    isSystemProtected: true,
                    createdBy: userId
                }
            }),
            LIABILITY: await AccountType.findOrCreate({
                where: { name: 'Liability' },
                defaults: {
                    name: 'Liability',
                    description: 'Debts and obligations of the business',
                    drBehavior: 'decrease',
                    crBehavior: 'increase',
                    isSystemProtected: true,
                    createdBy: userId
                }
            }),
            EQUITY: await AccountType.findOrCreate({
                where: { name: 'Equity' },
                defaults: {
                    name: 'Equity',
                    description: 'Owner\'s stake in the business',
                    drBehavior: 'decrease',
                    crBehavior: 'increase',
                    isSystemProtected: true,
                    createdBy: userId
                }
            }),
            INCOME: await AccountType.findOrCreate({
                where: { name: 'Income' },
                defaults: {
                    name: 'Income',
                    description: 'Revenue from business operations',
                    drBehavior: 'decrease',
                    crBehavior: 'increase',
                    isSystemProtected: true,
                    createdBy: userId
                }
            }),
            EXPENSE: await AccountType.findOrCreate({
                where: { name: 'Expense' },
                defaults: {
                    name: 'Expense',
                    description: 'Costs incurred in business operations',
                    drBehavior: 'increase',
                    crBehavior: 'decrease',
                    isSystemProtected: true,
                    createdBy: userId
                }
            })
        };

        console.log('✅ Account Types created successfully');

        // ===== STEP 2: CREATE ACCOUNT CATEGORIES =====
        console.log('\n📋 Creating Account Categories...');

        const accountCategories = {};

        // Asset Categories
        accountCategories.CURRENT_ASSETS = await AccountCategory.findOrCreate({
            where: { 
                name: 'Current Assets',
                accountTypeId: accountTypes.ASSET[0].id
            },
            defaults: {
                name: 'Current Assets',
                description: 'Assets expected to be used within one year',
                accountTypeId: accountTypes.ASSET[0].id,
                createdBy: userId
            }
        });

        accountCategories.FIXED_ASSETS = await AccountCategory.findOrCreate({
            where: { 
                name: 'Fixed Assets',
                accountTypeId: accountTypes.ASSET[0].id
            },
            defaults: {
                name: 'Fixed Assets',
                description: 'Long-term assets with useful life > 1 year',
                accountTypeId: accountTypes.ASSET[0].id,
                createdBy: userId
            }
        });

        // Liability Categories
        accountCategories.CURRENT_LIABILITIES = await AccountCategory.findOrCreate({
            where: { 
                name: 'Current Liabilities',
                accountTypeId: accountTypes.LIABILITY[0].id
            },
            defaults: {
                name: 'Current Liabilities',
                description: 'Liabilities due within one year',
                accountTypeId: accountTypes.LIABILITY[0].id,
                createdBy: userId
            }
        });

        // Income Categories
        accountCategories.OPERATING_INCOME = await AccountCategory.findOrCreate({
            where: { 
                name: 'Operating Income',
                accountTypeId: accountTypes.INCOME[0].id
            },
            defaults: {
                name: 'Operating Income',
                description: 'Income from core business operations',
                accountTypeId: accountTypes.INCOME[0].id,
                createdBy: userId
            }
        });

        accountCategories.OTHER_INCOME = await AccountCategory.findOrCreate({
            where: { 
                name: 'Other Income',
                accountTypeId: accountTypes.INCOME[0].id
            },
            defaults: {
                name: 'Other Income',
                description: 'Income from non-operational sources',
                accountTypeId: accountTypes.INCOME[0].id,
                createdBy: userId
            }
        });

        // Expense Categories
        accountCategories.OPERATING_EXPENSES = await AccountCategory.findOrCreate({
            where: { 
                name: 'Operating Expenses',
                accountTypeId: accountTypes.EXPENSE[0].id
            },
            defaults: {
                name: 'Operating Expenses',
                description: 'Direct costs of operations',
                accountTypeId: accountTypes.EXPENSE[0].id,
                createdBy: userId
            }
        });

        accountCategories.OTHER_EXPENSES = await AccountCategory.findOrCreate({
            where: { 
                name: 'Other Expenses',
                accountTypeId: accountTypes.EXPENSE[0].id
            },
            defaults: {
                name: 'Other Expenses',
                description: 'Non-operational expenses',
                accountTypeId: accountTypes.EXPENSE[0].id,
                createdBy: userId
            }
        });

        console.log('✅ Account Categories created successfully');

        // ===== STEP 3: CREATE CONTROL ACCOUNTS =====
        console.log('\n📋 Creating Control Accounts...');

        const controlAccounts = {};

        controlAccounts.CUSTOMER_CONTROL = await ControlAccount.findOrCreate({
            where: { name: 'Customer Control Account' },
            defaults: {
                name: 'Customer Control Account',
                description: 'Aggregate account for all customer receivables',
                accountTypeId: accountTypes.ASSET[0].id,
                accountCategoryId: accountCategories.CURRENT_ASSETS[0].id,
                controlType: 'CUSTOMER',
                createdBy: userId
            }
        });

        controlAccounts.SUPPLIER_CONTROL = await ControlAccount.findOrCreate({
            where: { name: 'Supplier Control Account' },
            defaults: {
                name: 'Supplier Control Account',
                description: 'Aggregate account for all supplier payables',
                accountTypeId: accountTypes.LIABILITY[0].id,
                accountCategoryId: accountCategories.CURRENT_LIABILITIES[0].id,
                controlType: 'SUPPLIER',
                createdBy: userId
            }
        });

        controlAccounts.BANK_CONTROL = await ControlAccount.findOrCreate({
            where: { name: 'Bank Control Account' },
            defaults: {
                name: 'Bank Control Account',
                description: 'Aggregate account for all bank accounts',
                accountTypeId: accountTypes.ASSET[0].id,
                accountCategoryId: accountCategories.CURRENT_ASSETS[0].id,
                controlType: 'BANK',
                createdBy: userId
            }
        });

        controlAccounts.INVENTORY_CONTROL = await ControlAccount.findOrCreate({
            where: { name: 'Inventory Control Account' },
            defaults: {
                name: 'Inventory Control Account',
                description: 'Aggregate account for inventory',
                accountTypeId: accountTypes.ASSET[0].id,
                accountCategoryId: accountCategories.CURRENT_ASSETS[0].id,
                controlType: 'INVENTORY',
                createdBy: userId
            }
        });

        console.log('✅ Control Accounts created successfully');

        // ===== STEP 4: CREATE SYSTEM LEDGERS =====
        console.log('\n📋 Creating System Ledgers...');

        const generateLedgerCode = (type, num) => {
            const typeCode = type.substring(0, 1).toUpperCase();
            return `${typeCode}${String(num).padStart(4, '0')}`;
        };

        let ledgerNum = 0;

        const ledgerAccounts = {};

        // Cash and Bank Ledgers
        ledgerAccounts.CASH_IN_HAND = await LedgerAccount.findOrCreate({
            where: { name: 'Cash in Hand' },
            defaults: {
                ledgerCode: generateLedgerCode('Asset', ++ledgerNum),
                name: 'Cash in Hand',
                accountTypeId: accountTypes.ASSET[0].id,
                accountCategoryId: accountCategories.CURRENT_ASSETS[0].id,
                ledgerType: 'CASH',
                openingBalance: 0,
                openingBalanceType: 'DR',
                createdBy: userId
            }
        });

        // Inventory Ledgers
        ledgerAccounts.INVENTORY = await LedgerAccount.findOrCreate({
            where: { name: 'Inventory Asset' },
            defaults: {
                ledgerCode: generateLedgerCode('Asset', ++ledgerNum),
                name: 'Inventory Asset',
                accountTypeId: accountTypes.ASSET[0].id,
                accountCategoryId: accountCategories.CURRENT_ASSETS[0].id,
                controlAccountId: controlAccounts.INVENTORY_CONTROL[0].id,
                ledgerType: 'SYSTEM',
                createdBy: userId
            }
        });

        // Customer and Supplier Ledgers
        ledgerAccounts.CUSTOMER_RECEIVABLES = await LedgerAccount.findOrCreate({
            where: { name: 'Accounts Receivable' },
            defaults: {
                ledgerCode: generateLedgerCode('Asset', ++ledgerNum),
                name: 'Accounts Receivable',
                accountTypeId: accountTypes.ASSET[0].id,
                accountCategoryId: accountCategories.CURRENT_ASSETS[0].id,
                controlAccountId: controlAccounts.CUSTOMER_CONTROL[0].id,
                ledgerType: 'CONTROL',
                createdBy: userId
            }
        });

        ledgerAccounts.SUPPLIER_PAYABLES = await LedgerAccount.findOrCreate({
            where: { name: 'Accounts Payable' },
            defaults: {
                ledgerCode: generateLedgerCode('Liability', ++ledgerNum),
                name: 'Accounts Payable',
                accountTypeId: accountTypes.LIABILITY[0].id,
                accountCategoryId: accountCategories.CURRENT_LIABILITIES[0].id,
                controlAccountId: controlAccounts.SUPPLIER_CONTROL[0].id,
                ledgerType: 'CONTROL',
                createdBy: userId
            }
        });

        // Income Ledgers
        ledgerAccounts.SALES_INCOME = await LedgerAccount.findOrCreate({
            where: { name: 'Sales Income' },
            defaults: {
                ledgerCode: generateLedgerCode('Income', ++ledgerNum),
                name: 'Sales Income',
                accountTypeId: accountTypes.INCOME[0].id,
                accountCategoryId: accountCategories.OPERATING_INCOME[0].id,
                ledgerType: 'SYSTEM',
                createdBy: userId
            }
        });

        // Expense Ledgers
        ledgerAccounts.COGS = await LedgerAccount.findOrCreate({
            where: { name: 'Cost of Goods Sold' },
            defaults: {
                ledgerCode: generateLedgerCode('Expense', ++ledgerNum),
                name: 'Cost of Goods Sold',
                accountTypeId: accountTypes.EXPENSE[0].id,
                accountCategoryId: accountCategories.OPERATING_EXPENSES[0].id,
                ledgerType: 'SYSTEM',
                createdBy: userId
            }
        });

        ledgerAccounts.PURCHASE_EXPENSE = await LedgerAccount.findOrCreate({
            where: { name: 'Purchase Expense' },
            defaults: {
                ledgerCode: generateLedgerCode('Expense', ++ledgerNum),
                name: 'Purchase Expense',
                accountTypeId: accountTypes.EXPENSE[0].id,
                accountCategoryId: accountCategories.OPERATING_EXPENSES[0].id,
                ledgerType: 'SYSTEM',
                createdBy: userId
            }
        });

        ledgerAccounts.STOCK_ADJUSTMENT_GAIN = await LedgerAccount.findOrCreate({
            where: { name: 'Stock Adjustment Gain' },
            defaults: {
                ledgerCode: generateLedgerCode('Income', ++ledgerNum),
                name: 'Stock Adjustment Gain',
                accountTypeId: accountTypes.INCOME[0].id,
                accountCategoryId: accountCategories.OTHER_INCOME[0].id,
                ledgerType: 'SYSTEM',
                createdBy: userId
            }
        });

        ledgerAccounts.STOCK_ADJUSTMENT_LOSS = await LedgerAccount.findOrCreate({
            where: { name: 'Stock Adjustment Loss' },
            defaults: {
                ledgerCode: generateLedgerCode('Expense', ++ledgerNum),
                name: 'Stock Adjustment Loss',
                accountTypeId: accountTypes.EXPENSE[0].id,
                accountCategoryId: accountCategories.OTHER_EXPENSES[0].id,
                ledgerType: 'SYSTEM',
                createdBy: userId
            }
        });

        console.log('✅ System Ledgers created successfully');

        // ===== STEP 5: CREATE DEFAULT AUTO-POSTING RULES =====
        console.log('\n📋 Creating Auto-Posting Rules...');

        const autoPostingRules = [
            {
                ruleName: 'GRN_RECEIPT',
                description: 'Goods Receipt Note - Stock In',
                triggerModule: 'PURCHASE_GRN',
                triggerEvent: 'RECEIVE',
                debitLedgerId: ledgerAccounts.INVENTORY[0].id,
                creditLedgerId: ledgerAccounts.SUPPLIER_PAYABLES[0].id,
                useControlAccount: true,
                controlAccountType: 'SUPPLIER',
                ruleOrder: 1
            },
            {
                ruleName: 'SALES_INVOICE_POSTING',
                description: 'Sales Invoice - Customer Receivable',
                triggerModule: 'SALES_INVOICE',
                triggerEvent: 'APPROVE',
                debitLedgerId: ledgerAccounts.CUSTOMER_RECEIVABLES[0].id,
                creditLedgerId: ledgerAccounts.SALES_INCOME[0].id,
                useControlAccount: true,
                controlAccountType: 'CUSTOMER',
                ruleOrder: 1
            },
            {
                ruleName: 'COGS_POSTING',
                description: 'Cost of Goods Sold - Delivery',
                triggerModule: 'COGS',
                triggerEvent: 'RECEIVE',
                debitLedgerId: ledgerAccounts.COGS[0].id,
                creditLedgerId: ledgerAccounts.INVENTORY[0].id,
                ruleOrder: 1
            },
            {
                ruleName: 'STOCK_ADJUSTMENT_INCREASE',
                description: 'Stock Adjustment Increase',
                triggerModule: 'STOCK_ADJUSTMENT',
                triggerEvent: 'APPROVE',
                debitLedgerId: ledgerAccounts.INVENTORY[0].id,
                creditLedgerId: ledgerAccounts.STOCK_ADJUSTMENT_GAIN[0].id,
                ruleOrder: 1
            },
            {
                ruleName: 'STOCK_ADJUSTMENT_DECREASE',
                description: 'Stock Adjustment Decrease',
                triggerModule: 'STOCK_ADJUSTMENT',
                triggerEvent: 'APPROVE',
                debitLedgerId: ledgerAccounts.STOCK_ADJUSTMENT_LOSS[0].id,
                creditLedgerId: ledgerAccounts.INVENTORY[0].id,
                ruleOrder: 1
            },
            {
                ruleName: 'CUSTOMER_PAYMENT',
                description: 'Customer Payment Received',
                triggerModule: 'CUSTOMER_PAYMENT',
                triggerEvent: 'APPROVE',
                debitLedgerId: ledgerAccounts.CASH_IN_HAND[0].id,
                creditLedgerId: ledgerAccounts.CUSTOMER_RECEIVABLES[0].id,
                ruleOrder: 1
            },
            {
                ruleName: 'SUPPLIER_PAYMENT',
                description: 'Supplier Payment Made',
                triggerModule: 'SUPPLIER_PAYMENT',
                triggerEvent: 'APPROVE',
                debitLedgerId: ledgerAccounts.SUPPLIER_PAYABLES[0].id,
                creditLedgerId: ledgerAccounts.CASH_IN_HAND[0].id,
                ruleOrder: 1
            }
        ];

        for (const rule of autoPostingRules) {
            await AutoPostingRule.findOrCreate({
                where: { ruleName: rule.ruleName },
                defaults: {
                    ...rule,
                    createdBy: userId
                }
            });
        }

        console.log('✅ Auto-Posting Rules created successfully');

        console.log('\n✨ Accounting Module Setup Completed Successfully!\n');

        return {
            accountTypes,
            accountCategories,
            controlAccounts,
            ledgerAccounts,
            autoPostingRules
        };
    } catch (error) {
        console.error('❌ Error setting up accounting module:', error);
        throw error;
    }
};

module.exports = setupAccounting;

// Run directly if executed as main script
if (require.main === module) {
    setupAccounting(1).then(() => {
        console.log('Setup completed. You can now use the accounting module.');
        process.exit(0);
    }).catch((error) => {
        console.error('Setup failed:', error);
        process.exit(1);
    });
}
