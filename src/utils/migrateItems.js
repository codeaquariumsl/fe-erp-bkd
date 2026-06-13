const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

/**
 * Migration script to add new fields to the items table
 * Run this if you need to manually update the database schema
 */
async function migrateItemsTable() {
    try {
        console.log('🔄 Starting Items table migration...');
        
        // Add new columns to items table
        const queryInterface = sequelize.getQueryInterface();
        
        // Check if columns already exist before adding
        const tableDescription = await queryInterface.describeTable('items');
        
        const newColumns = {
            itemsPerBox: {
                type: DataTypes.INTEGER,
                allowNull: true,
                defaultValue: 1,
                comment: 'Number of items per box/package'
            },
            leadTimeDays: {
                type: DataTypes.INTEGER,
                allowNull: true,
                defaultValue: 0,
                comment: 'Lead time in days for procurement'
            },
            image: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: 'Image URL for the item'
            },
            doNotAllowDirectSale: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: 'Flag to prevent direct sales of this item'
            },
            allowsMinus: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: 'Flag to allow negative inventory for this item'
            }
        };

        for (const [columnName, columnDefinition] of Object.entries(newColumns)) {
            if (!tableDescription[columnName]) {
                console.log(`➕ Adding column: ${columnName}`);
                await queryInterface.addColumn('items', columnName, columnDefinition);
            } else {
                console.log(`✅ Column ${columnName} already exists`);
            }
        }

        console.log('✅ Items table migration completed successfully!');
        
        // Verify the changes
        const updatedDescription = await queryInterface.describeTable('items');
        console.log('📋 Updated table columns:', Object.keys(updatedDescription));
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    }
}

// Run migration if this file is executed directly
if (require.main === module) {
    migrateItemsTable()
        .then(() => {
            console.log('🎉 Migration completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Migration failed:', error);
            process.exit(1);
        });
}

module.exports = { migrateItemsTable };