require('dotenv').config();

const bcrypt = require('bcryptjs');
const sequelize = require('../config/db');
const { User, Role, Location, Store } = require('../models');

async function createDefaultLocationAndStore() {
    try {
        // Create or check default location
        let defaultLocation = await Location.findOne({ where: { code: 'BHL-MAIN' } });
        if (!defaultLocation) {
            defaultLocation = await Location.create({
                name: 'Code Aqua ERP Main Warehouse',
                code: 'BHL-MAIN',
                address: 'Code Aqua ERP Main Distribution Center',
                city: 'Colombo',
                state: 'Western Province',
                country: 'Sri Lanka',
                postalCode: '00100',
                contactPerson: 'Warehouse Manager',
                contactNumber: '+94 11 234 5678',
                email: 'warehouse@codeaqua.com',
                isActive: true,
                createdBy: 1,
                updatedBy: 1
            });
            console.log('✅ Default location created: Code Aqua ERP Main Warehouse');
        } else {
            console.log('ℹ️  Default location already exists: Code Aqua ERP Main Warehouse');
        }

        // Create or check default store
        let defaultStore = await Store.findOne({ where: { name: 'Main Storage Area' } });
        if (!defaultStore) {
            defaultStore = await Store.create({
                name: 'Main Storage Area',
                capacity: 10000,
                locationId: defaultLocation.id,
                createdBy: 1,
                updatedBy: 1
            });
            console.log('✅ Default store created: Main Storage Area');
        } else {
            console.log('ℹ️  Default store already exists: Main Storage Area');
        }

        // Create additional default stores for different product types
        const additionalStores = [
            {
                name: 'Dry Storage',
                capacity: 5000,
                locationId: defaultLocation.id
            },
            {
                name: 'Cold Storage Prep Area',
                capacity: 2000,
                locationId: defaultLocation.id
            },
            {
                name: 'Dispatch Area',
                capacity: 1500,
                locationId: defaultLocation.id
            }
        ];

        for (const storeData of additionalStores) {
            let existingStore = await Store.findOne({ where: { name: storeData.name } });
            if (!existingStore) {
                await Store.create({
                    ...storeData,
                    createdBy: 1,
                    updatedBy: 1
                });
                console.log(`✅ Additional store created: ${storeData.name}`);
            } else {
                console.log(`ℹ️  Store already exists: ${storeData.name}`);
            }
        }

    } catch (error) {
        console.error('❌ Error creating default location and stores:', error);
        throw error;
    }
}

async function insertAdminUser() {
    try {
        // Sync database with all tables first
        await sequelize.sync({ force: false });
        console.log('Database synchronized.');

        // Check or create admin role
        let adminRole = await Role.findOne({ where: { name: 'admin' } });
        if (!adminRole) {
            adminRole = await Role.create({
                name: 'admin',
                description: 'Administrator role',
                createdBy: 1,
                updatedBy: 1
            });
            console.log('Admin role created.');
        }

        // Check or create admin user
        let adminUser = await User.findOne({ where: { username: 'admin' } });
        if (!adminUser) {
            const hashedPassword = await bcrypt.hash('caadmin@123', 10);
            adminUser = await User.create({
                username: 'admin',
                password: hashedPassword,
                email: 'admin@codeaqua.com',
                fullName: 'Admin User',
                mobile: '1234567890',
                roleId: adminRole.id,
                createdBy: 1,
                updatedBy: 1
            });
            console.log('Admin user created.');
        } else {
            console.log('Admin user already exists.');
        }
        // Ensure customer role exists
        let customerRole = await Role.findOne({ where: { name: 'customer' } });
        if (!customerRole) await Role.create({ name: 'customer', description: 'Customer role', createdBy: 1, updatedBy: 1 });
        // Ensure driver role exists
        let driverRole = await Role.findOne({ where: { name: 'driver' } });
        if (!driverRole) await Role.create({ name: 'driver', description: 'Driver role', createdBy: 1, updatedBy: 1 });

        // Create default location and store
        await createDefaultLocationAndStore();

        console.log('✅ Database initialization completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error inserting admin user:', error);
        process.exit(1);
    }
}

insertAdminUser();
