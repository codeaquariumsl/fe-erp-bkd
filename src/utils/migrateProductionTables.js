const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

/**
 * Migration script to create production management tables
 * This includes ProductionConfig, BOM, BOMItem, and ProductionOrder tables
 * Run this to set up the complete production management system
 */
async function migrateProductionTables() {
    try {
        console.log('🔄 Starting Production tables migration...');
        
        const queryInterface = sequelize.getQueryInterface();
        
        // Check existing tables
        const existingTables = await queryInterface.showAllTables();
        console.log('📋 Existing tables:', existingTables);
        
        // 1. Create production_configs table
        if (!existingTables.includes('production_configs')) {
            console.log('➕ Creating production_configs table...');
            await queryInterface.createTable('production_configs', {
                id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                    allowNull: false
                },
                rawMaterialStoreId: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    references: {
                        model: 'stores',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'RESTRICT'
                },
                outputStoreId: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    references: {
                        model: 'stores',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'RESTRICT'
                },
                locationId: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    references: {
                        model: 'locations',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'RESTRICT'
                },
                isActive: {
                    type: DataTypes.BOOLEAN,
                    allowNull: false,
                    defaultValue: true
                },
                createdBy: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    references: {
                        model: 'users',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'RESTRICT'
                },
                createdAt: {
                    type: DataTypes.DATE,
                    allowNull: false,
                    defaultValue: DataTypes.NOW
                },
                updatedAt: {
                    type: DataTypes.DATE,
                    allowNull: false,
                    defaultValue: DataTypes.NOW
                },
                updatedBy: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                    references: {
                        model: 'users',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL'
                }
            });
            
            // Add unique constraint for location
            await queryInterface.addConstraint('production_configs', {
                fields: ['locationId'],
                type: 'unique',
                name: 'unique_production_config_location'
            });
        } else {
            console.log('✅ production_configs table already exists');
        }

        // 2. Create boms table
        if (!existingTables.includes('boms')) {
            console.log('➕ Creating boms table...');
            await queryInterface.createTable('boms', {
                id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                    allowNull: false
                },
                bomCode: {
                    type: DataTypes.STRING(50),
                    allowNull: false,
                    unique: true
                },
                itemId: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    references: {
                        model: 'items',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'RESTRICT'
                },
                qty: {
                    type: DataTypes.DECIMAL(10, 2),
                    allowNull: false,
                    defaultValue: 1.00
                },
                locationId: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    references: {
                        model: 'locations',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'RESTRICT'
                },
                isActive: {
                    type: DataTypes.BOOLEAN,
                    allowNull: false,
                    defaultValue: true
                },
                createdBy: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    references: {
                        model: 'users',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'RESTRICT'
                },
                createdAt: {
                    type: DataTypes.DATE,
                    allowNull: false,
                    defaultValue: DataTypes.NOW
                },
                updatedAt: {
                    type: DataTypes.DATE,
                    allowNull: false,
                    defaultValue: DataTypes.NOW
                },
                updatedBy: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                    references: {
                        model: 'users',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL'
                },
                name: {
                    type: DataTypes.STRING,
                    allowNull: true
                },
                version: {
                    type: DataTypes.STRING,
                    allowNull: true,
                    defaultValue: '1.0'
                },
                totalCost: {
                    type: DataTypes.DECIMAL(10, 2),
                    allowNull: true,
                    defaultValue: 0.00
                }
            });
        } else {
            console.log('✅ boms table already exists');
        }

        // 3. Create bom_items table
        if (!existingTables.includes('bom_items')) {
            console.log('➕ Creating bom_items table...');
            await queryInterface.createTable('bom_items', {
                id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                    allowNull: false
                },
                bomId: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    references: {
                        model: 'boms',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'CASCADE'
                },
                itemId: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    references: {
                        model: 'items',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'RESTRICT'
                },
                quantity: {
                    type: DataTypes.DECIMAL(10, 2),
                    allowNull: false,
                    defaultValue: 0.00
                },
                unit: {
                    type: DataTypes.STRING,
                    allowNull: true
                },
                cost: {
                    type: DataTypes.DECIMAL(10, 2),
                    allowNull: true,
                    defaultValue: 0.00
                },
                totalCost: {
                    type: DataTypes.DECIMAL(10, 2),
                    allowNull: true,
                    defaultValue: 0.00
                },
                remark: {
                    type: DataTypes.TEXT,
                    allowNull: true
                },
                isActive: {
                    type: DataTypes.BOOLEAN,
                    allowNull: false,
                    defaultValue: true
                },
                createdBy: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    references: {
                        model: 'users',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'RESTRICT'
                },
                createdAt: {
                    type: DataTypes.DATE,
                    allowNull: false,
                    defaultValue: DataTypes.NOW
                },
                updatedAt: {
                    type: DataTypes.DATE,
                    allowNull: false,
                    defaultValue: DataTypes.NOW
                },
                updatedBy: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                    references: {
                        model: 'users',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL'
                },
                sequence: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                    defaultValue: 1
                },
                wastagePercentage: {
                    type: DataTypes.DECIMAL(5, 2),
                    allowNull: true,
                    defaultValue: 0.00
                }
            });

            // Add unique constraint for BOM-Item combination
            await queryInterface.addConstraint('bom_items', {
                fields: ['bomId', 'itemId'],
                type: 'unique',
                name: 'bom_item_unique'
            });
        } else {
            console.log('✅ bom_items table already exists');
        }

        // 4. Create production_orders table
        if (!existingTables.includes('production_orders')) {
            console.log('➕ Creating production_orders table...');
            await queryInterface.createTable('production_orders', {
                id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                    allowNull: false
                },
                itemId: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    references: {
                        model: 'items',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'RESTRICT'
                },
                batchId: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                    references: {
                        model: 'batches',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL'
                },
                code: {
                    type: DataTypes.STRING,
                    allowNull: false,
                    unique: true
                },
                date: {
                    type: DataTypes.DATE,
                    allowNull: false
                },
                bomId: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    references: {
                        model: 'boms',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'RESTRICT'
                },
                plannedQuantity: {
                    type: DataTypes.DECIMAL(10, 2),
                    allowNull: false,
                    defaultValue: 0.00
                },
                produceQuantity: {
                    type: DataTypes.DECIMAL(10, 2),
                    allowNull: false,
                    defaultValue: 0.00
                },
                wastageQuantity: {
                    type: DataTypes.DECIMAL(10, 2),
                    allowNull: false,
                    defaultValue: 0.00
                },
                status: {
                    type: DataTypes.ENUM('planned', 'in_progress', 'completed', 'cancelled', 'on_hold'),
                    allowNull: false,
                    defaultValue: 'planned'
                },
                locationId: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    references: {
                        model: 'locations',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'RESTRICT'
                },
                isActive: {
                    type: DataTypes.BOOLEAN,
                    allowNull: false,
                    defaultValue: true
                },
                createdBy: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    references: {
                        model: 'users',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'RESTRICT'
                },
                createdAt: {
                    type: DataTypes.DATE,
                    allowNull: false,
                    defaultValue: DataTypes.NOW
                },
                updatedAt: {
                    type: DataTypes.DATE,
                    allowNull: false,
                    defaultValue: DataTypes.NOW
                },
                updatedBy: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                    references: {
                        model: 'users',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL'
                },
                startDate: {
                    type: DataTypes.DATE,
                    allowNull: true
                },
                endDate: {
                    type: DataTypes.DATE,
                    allowNull: true
                },
                notes: {
                    type: DataTypes.TEXT,
                    allowNull: true
                },
                priority: {
                    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
                    allowNull: false,
                    defaultValue: 'medium'
                },
                estimatedCost: {
                    type: DataTypes.DECIMAL(10, 2),
                    allowNull: true,
                    defaultValue: 0.00
                },
                actualCost: {
                    type: DataTypes.DECIMAL(10, 2),
                    allowNull: true,
                    defaultValue: 0.00
                }
            });
        } else {
            console.log('✅ production_orders table already exists');
        }

        // 5. Create production_order_items table
        if (!existingTables.includes('production_order_items')) {
            console.log('➕ Creating production_order_items table...');
            await queryInterface.createTable('production_order_items', {
                id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                    allowNull: false
                },
                productionOrderId: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    references: {
                        model: 'production_orders',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'CASCADE'
                },
                bomId: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                    references: {
                        model: 'boms',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL'
                },
                itemId: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    references: {
                        model: 'items',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'RESTRICT'
                },
                quantity: {
                    type: DataTypes.DECIMAL(10, 3),
                    allowNull: false,
                    defaultValue: 0.000
                },
                unit: {
                    type: DataTypes.STRING(20),
                    allowNull: true
                },
                cost: {
                    type: DataTypes.DECIMAL(10, 2),
                    allowNull: true,
                    defaultValue: 0.00
                },
                totalCost: {
                    type: DataTypes.DECIMAL(10, 2),
                    allowNull: true,
                    defaultValue: 0.00
                },
                remark: {
                    type: DataTypes.TEXT,
                    allowNull: true
                },
                sequence: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                    defaultValue: 1
                },
                wastageQuantity: {
                    type: DataTypes.DECIMAL(10, 3),
                    allowNull: false,
                    defaultValue: 0.000
                },
                status: {
                    type: DataTypes.ENUM('pending', 'allocated', 'consumed', 'returned', 'cancelled'),
                    allowNull: false,
                    defaultValue: 'pending'
                },
                isActive: {
                    type: DataTypes.BOOLEAN,
                    allowNull: false,
                    defaultValue: true
                },
                createdBy: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    references: {
                        model: 'users',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'RESTRICT'
                },
                createdAt: {
                    type: DataTypes.DATE,
                    allowNull: false,
                    defaultValue: DataTypes.NOW
                },
                updatedAt: {
                    type: DataTypes.DATE,
                    allowNull: false,
                    defaultValue: DataTypes.NOW
                },
                updatedBy: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                    references: {
                        model: 'users',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL'
                }
            });
        } else {
            console.log('✅ production_order_items table already exists');
        }

        // Add indexes for better performance
        console.log('🔧 Creating indexes for better performance...');
        
        // production_configs indexes
        if (!existingTables.includes('production_configs')) {
            await queryInterface.addIndex('production_configs', ['rawMaterialStoreId'], {
                name: 'idx_production_config_raw_store'
            });
            await queryInterface.addIndex('production_configs', ['outputStoreId'], {
                name: 'idx_production_config_output_store'
            });
            await queryInterface.addIndex('production_configs', ['locationId'], {
                name: 'idx_production_config_location'
            });
            await queryInterface.addIndex('production_configs', ['isActive'], {
                name: 'idx_production_config_active'
            });
        }

        // boms indexes
        if (!existingTables.includes('boms')) {
            await queryInterface.addIndex('boms', ['itemId'], {
                name: 'idx_bom_item'
            });
            await queryInterface.addIndex('boms', ['locationId'], {
                name: 'idx_bom_location'
            });
            await queryInterface.addIndex('boms', ['isActive'], {
                name: 'idx_bom_active'
            });
            await queryInterface.addIndex('boms', ['itemId', 'locationId'], {
                name: 'bom_item_location_idx'
            });
        }

        // bom_items indexes
        if (!existingTables.includes('bom_items')) {
            await queryInterface.addIndex('bom_items', ['bomId'], {
                name: 'idx_bom_item_bom'
            });
            await queryInterface.addIndex('bom_items', ['itemId'], {
                name: 'idx_bom_item_item'
            });
            await queryInterface.addIndex('bom_items', ['isActive'], {
                name: 'idx_bom_item_active'
            });
            await queryInterface.addIndex('bom_items', ['sequence'], {
                name: 'idx_bom_item_sequence'
            });
        }

        // production_orders indexes
        if (!existingTables.includes('production_orders')) {
            await queryInterface.addIndex('production_orders', ['itemId'], {
                name: 'idx_production_order_item'
            });
            await queryInterface.addIndex('production_orders', ['batchId'], {
                name: 'idx_production_order_batch'
            });
            await queryInterface.addIndex('production_orders', ['bomId'], {
                name: 'idx_production_order_bom'
            });
            await queryInterface.addIndex('production_orders', ['locationId'], {
                name: 'idx_production_order_location'
            });
            await queryInterface.addIndex('production_orders', ['status'], {
                name: 'idx_production_order_status'
            });
            await queryInterface.addIndex('production_orders', ['date'], {
                name: 'idx_production_order_date'
            });
            await queryInterface.addIndex('production_orders', ['code'], {
                name: 'idx_production_order_code',
                unique: true
            });
            await queryInterface.addIndex('production_orders', ['priority'], {
                name: 'idx_production_order_priority'
            });
            await queryInterface.addIndex('production_orders', ['isActive'], {
                name: 'idx_production_order_active'
            });
        }

        // production_order_items indexes
        if (!existingTables.includes('production_order_items')) {
            await queryInterface.addIndex('production_order_items', ['productionOrderId'], {
                name: 'idx_production_order_item_production_order'
            });
            await queryInterface.addIndex('production_order_items', ['bomId'], {
                name: 'idx_production_order_item_bom'
            });
            await queryInterface.addIndex('production_order_items', ['itemId'], {
                name: 'idx_production_order_item_item'
            });
            await queryInterface.addIndex('production_order_items', ['status'], {
                name: 'idx_production_order_item_status'
            });
            await queryInterface.addIndex('production_order_items', ['isActive'], {
                name: 'idx_production_order_item_active'
            });
            await queryInterface.addIndex('production_order_items', ['sequence'], {
                name: 'idx_production_order_item_sequence'
            });
            await queryInterface.addIndex('production_order_items', ['productionOrderId', 'sequence'], {
                name: 'production_order_sequence_idx'
            });
        }

        console.log('✅ Production tables migration completed successfully!');
        
        // Verify the tables were created
        const updatedTables = await queryInterface.showAllTables();
        const productionTables = ['production_configs', 'boms', 'bom_items', 'production_orders', 'production_order_items'];
        
        console.log('📋 Production tables verification:');
        productionTables.forEach(table => {
            if (updatedTables.includes(table)) {
                console.log(`✅ ${table} - Created successfully`);
            } else {
                console.log(`❌ ${table} - Failed to create`);
            }
        });

        // Display table structure summary
        console.log('\n📊 Production Management System Tables Created:');
        console.log('┌─────────────────────────┬─────────────────────────────────────────────┐');
        console.log('│ Table Name              │ Purpose                                     │');
        console.log('├─────────────────────────┼─────────────────────────────────────────────┤');
        console.log('│ production_configs      │ Production line configurations per location │');
        console.log('│ boms                    │ Bill of Materials for products             │');
        console.log('│ bom_items               │ Individual materials within BOMs           │');
        console.log('│ production_orders       │ Production orders with lifecycle tracking  │');
        console.log('│ production_order_items  │ Items/materials used in production orders  │');
        console.log('└─────────────────────────┴─────────────────────────────────────────────┘');
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('Stack trace:', error.stack);
        throw error;
    }
}

/**
 * Rollback function to drop production tables (use with caution!)
 */
async function rollbackProductionTables() {
    try {
        console.log('⚠️  Starting Production tables rollback...');
        
        const queryInterface = sequelize.getQueryInterface();
        const existingTables = await queryInterface.showAllTables();
        
        // Drop tables in reverse order to handle foreign key constraints
        const tablesToDrop = ['production_order_items', 'production_orders', 'bom_items', 'boms', 'production_configs'];
        
        for (const table of tablesToDrop) {
            if (existingTables.includes(table)) {
                console.log(`🗑️  Dropping ${table} table...`);
                await queryInterface.dropTable(table);
            }
        }
        
        console.log('✅ Production tables rollback completed successfully!');
        
    } catch (error) {
        console.error('❌ Rollback failed:', error.message);
        throw error;
    }
}

// Run migration if this file is executed directly
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--rollback')) {
        rollbackProductionTables()
            .then(() => {
                console.log('🎉 Rollback completed successfully');
                process.exit(0);
            })
            .catch((error) => {
                console.error('💥 Rollback failed:', error);
                process.exit(1);
            });
    } else {
        migrateProductionTables()
            .then(() => {
                console.log('🎉 Migration completed successfully');
                process.exit(0);
            })
            .catch((error) => {
                console.error('💥 Migration failed:', error);
                process.exit(1);
            });
    }
}

module.exports = { 
    migrateProductionTables, 
    rollbackProductionTables 
};