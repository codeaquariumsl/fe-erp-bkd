#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const sequelize = require('../src/config/db');
const {
  BillEntry,
  BillEntryDetail,
  BillPayment,
  PaymentAllocation,
  OnePayment,
  FundsTransfer,
  TransactionHeader,
  TransactionDetail
} = require('../src/models');

/**
 * Database Migration Script for Accounting Transaction Tables
 * This script creates all necessary tables for the accounting transaction module:
 * - BillEntry: Supplier invoice registration
 * - BillEntryDetail: Line items for bills with ledger allocations
 * - BillPayment: Supplier payment tracking with allocations
 * - PaymentAllocation: Bill-to-payment linking
 * - OnePayment: Advance/lump-sum payments with reversal capability
 * - FundsTransfer: Inter-bank transfers with reconciliation
 */

const TABLES_TO_CREATE = [
  'BillEntry',
  'BillEntryDetail',
  'BillPayment',
  'PaymentAllocation',
  'OnePayment',
  'FundsTransfer',
  'TransactionHeader',
  'TransactionDetail'
];

async function createAccountingTables() {
  try {
    console.log('\n🚀 Starting Accounting Transaction Tables Migration...\n');

    // Sync models with database
    console.log('📝 Syncing database models...');
    await sequelize.sync({ alter: false });
    console.log('✅ Models synced successfully\n');

    // Create each table
    console.log('📊 Creating transaction tables:\n');

    const models = {
      'BillEntry': BillEntry,
      'BillEntryDetail': BillEntryDetail,
      'BillPayment': BillPayment,
      'PaymentAllocation': PaymentAllocation,
      'OnePayment': OnePayment,
      'FundsTransfer': FundsTransfer,
      'TransactionHeader': TransactionHeader,
      'TransactionDetail': TransactionDetail
    };

    for (const [tableName, model] of Object.entries(models)) {
      try {
        await model.sync({ alter: false });
        console.log(`   ✅ ${tableName} table created successfully`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`   ℹ️  ${tableName} table already exists`);
        } else {
          throw error;
        }
      }
    }

    console.log('\n📋 Migration Summary:\n');
    console.log('   Tables Created/Verified:');
    TABLES_TO_CREATE.forEach(table => {
      console.log(`   ✅ ${table}`);
    });

    console.log('\n📌 Important Notes:\n');
    console.log('   1. All models include audit fields: createdBy, updatedBy, approvedBy, postedBy');
    console.log('   2. Status enums are defined for workflow management');
    console.log('   3. Foreign key relationships are automatically created');
    console.log('   4. Indexes are created on key fields for performance\n');

    console.log('🎉 Migration completed successfully!\n');

    // Log table details
    console.log('📊 Table Details:\n');
    console.log('   BillEntry:');
    console.log('   - Tracks supplier invoices with status workflow');
    console.log('   - Auto-creates journal entries via AutoPostingService');
    console.log('   - Fields: billNumber, supplierId, amount, status, etc.\n');

    console.log('   BillPayment:');
    console.log('   - Records supplier payments with payment methods');
    console.log('   - Supports multi-bill allocation via PaymentAllocation');
    console.log('   - Fields: paymentNumber, paymentMethod, amount, status, etc.\n');

    console.log('   PaymentAllocation:');
    console.log('   - Linking table for bill-to-payment allocation');
    console.log('   - Enables flexible multi-bill payment scenarios');
    console.log('   - Fields: billPaymentId, billEntryId, allocatedAmount\n');

    console.log('   OnePayment:');
    console.log('   - Handles advance and lump-sum payments');
    console.log('   - Supports partial allocation and reversal');
    console.log('   - Fields: paymentNumber, totalAmount, allocatedAmount, status, etc.\n');

    console.log('   FundsTransfer:');
    console.log('   - Records inter-bank transfers');
    console.log('   - Supports reconciliation status tracking');
    console.log('   - Fields: transferNumber, sourceBankAccountId, destinationBankAccountId, etc.\n');

    console.log('🔗 Key Relationships:\n');
    console.log('   - BillEntry → Supplier (many-to-one)');
    console.log('   - BillEntry → JournalEntry (one-to-one)');
    console.log('   - BillPayment → PaymentAllocation (one-to-many)');
    console.log('   - PaymentAllocation → BillEntry (many-to-one)');
    console.log('   - OnePayment → BillEntry (many-to-many via allocations)');
    console.log('   - FundsTransfer → BankAccount (many-to-one for source & destination)\n');

    console.log('📚 Next Steps:\n');
    console.log('   1. Test API endpoints using Postman collections');
    console.log('   2. Create default auto-posting rules');
    console.log('   3. Run integration tests');
    console.log('   4. Verify journal entries are created automatically\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run migration
createAccountingTables();
