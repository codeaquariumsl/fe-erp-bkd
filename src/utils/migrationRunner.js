const { migrateItemsTable } = require('./migrateItems');
const { migrateProductionTables, rollbackProductionTables } = require('./migrateProductionTables');

/**
 * Master migration runner for all database migrations
 * This script can run individual migrations or all migrations at once
 */

const MIGRATIONS = {
    items: {
        name: 'Items Table Migration',
        description: 'Adds new fields to items table',
        migrate: migrateItemsTable
    },
    production: {
        name: 'Production Tables Migration',
        description: 'Creates ProductionConfig, BOM, BOMItem, and ProductionOrder tables',
        migrate: migrateProductionTables,
        rollback: rollbackProductionTables
    }
};

async function runMigration(migrationName) {
    const migration = MIGRATIONS[migrationName];
    if (!migration) {
        console.error(`❌ Migration '${migrationName}' not found`);
        console.log('Available migrations:', Object.keys(MIGRATIONS).join(', '));
        return false;
    }

    try {
        console.log(`🚀 Running ${migration.name}...`);
        console.log(`📝 Description: ${migration.description}`);
        await migration.migrate();
        console.log(`✅ ${migration.name} completed successfully`);
        return true;
    } catch (error) {
        console.error(`❌ ${migration.name} failed:`, error.message);
        return false;
    }
}

async function runAllMigrations() {
    console.log('🚀 Running all migrations...\n');
    
    let successCount = 0;
    const migrationNames = Object.keys(MIGRATIONS);
    
    for (const migrationName of migrationNames) {
        const success = await runMigration(migrationName);
        if (success) {
            successCount++;
        }
        console.log(''); // Add spacing between migrations
    }
    
    console.log(`📊 Migration Summary: ${successCount}/${migrationNames.length} successful`);
    
    if (successCount === migrationNames.length) {
        console.log('🎉 All migrations completed successfully!');
        return true;
    } else {
        console.log('⚠️  Some migrations failed. Please check the errors above.');
        return false;
    }
}

async function rollbackMigration(migrationName) {
    const migration = MIGRATIONS[migrationName];
    if (!migration) {
        console.error(`❌ Migration '${migrationName}' not found`);
        return false;
    }

    if (!migration.rollback) {
        console.error(`❌ Migration '${migrationName}' does not support rollback`);
        return false;
    }

    try {
        console.log(`⏪ Rolling back ${migration.name}...`);
        await migration.rollback();
        console.log(`✅ ${migration.name} rollback completed successfully`);
        return true;
    } catch (error) {
        console.error(`❌ ${migration.name} rollback failed:`, error.message);
        return false;
    }
}

function showHelp() {
    console.log(`
🛠️  Database Migration Runner

Usage:
  node src/utils/migrationRunner.js [command] [options]

Commands:
  --all                    Run all available migrations
  --migrate <name>         Run a specific migration
  --rollback <name>        Rollback a specific migration (if supported)
  --list                   List all available migrations
  --help                   Show this help message

Available Migrations:
${Object.entries(MIGRATIONS).map(([key, migration]) => 
  `  ${key.padEnd(12)} - ${migration.description}`
).join('\n')}

Examples:
  node src/utils/migrationRunner.js --all
  node src/utils/migrationRunner.js --migrate production
  node src/utils/migrationRunner.js --rollback production
  node src/utils/migrationRunner.js --list
`);
}

function listMigrations() {
    console.log('\n📋 Available Migrations:\n');
    Object.entries(MIGRATIONS).forEach(([key, migration]) => {
        console.log(`🔧 ${key}`);
        console.log(`   Name: ${migration.name}`);
        console.log(`   Description: ${migration.description}`);
        console.log(`   Rollback: ${migration.rollback ? '✅ Supported' : '❌ Not supported'}`);
        console.log('');
    });
}

// Main execution logic
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--help')) {
        showHelp();
        return;
    }

    if (args.includes('--list')) {
        listMigrations();
        return;
    }

    try {
        if (args.includes('--all')) {
            const success = await runAllMigrations();
            process.exit(success ? 0 : 1);
        }

        const migrateIndex = args.indexOf('--migrate');
        if (migrateIndex !== -1 && args[migrateIndex + 1]) {
            const success = await runMigration(args[migrateIndex + 1]);
            process.exit(success ? 0 : 1);
        }

        const rollbackIndex = args.indexOf('--rollback');
        if (rollbackIndex !== -1 && args[rollbackIndex + 1]) {
            const success = await rollbackMigration(args[rollbackIndex + 1]);
            process.exit(success ? 0 : 1);
        }

        console.log('❌ Invalid command. Use --help for usage information.');
        process.exit(1);

    } catch (error) {
        console.error('💥 Migration runner failed:', error);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (require.main === module) {
    main();
}

module.exports = {
    runMigration,
    runAllMigrations,
    rollbackMigration,
    MIGRATIONS
};