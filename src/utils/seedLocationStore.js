require('dotenv').config();

const sequelize = require('../config/db');
const { Location, Store } = require('../models');

async function createDefaultLocationAndStore() {
    try {
        // Sync database with all tables first
        await sequelize.sync({ force: false });
        console.log('🔄 Database synchronized for location and store seeding.');
        
        // Create or check default location
        let defaultLocation = await Location.findOne({ where: { code: 'BHL-MAIN' } });
        if (!defaultLocation) {
            defaultLocation = await Location.create({
                name: 'Code Aqua ERP Main Warehouse',
                code: 'BHL-MAIN',
                address: 'Code Aqua ERP Main Distribution Center, Industrial Zone',
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

        // Create additional locations
        const additionalLocations = [
            {
                name: 'Code Aqua ERP Kandy Branch',
                code: 'BHL-KDY',
                address: 'Kandy Road, Peradeniya Junction',
                city: 'Kandy',
                state: 'Central Province',
                country: 'Sri Lanka',
                postalCode: '20000',
                contactPerson: 'Branch Manager - Kandy',
                contactNumber: '+94 81 234 5678',
                email: 'kandy@codeaqua.com'
            },
            {
                name: 'Code Aqua ERP Galle Branch',
                code: 'BHL-GAL',
                address: 'Galle Fort Area, Southern Express Exit',
                city: 'Galle',
                state: 'Southern Province',
                country: 'Sri Lanka',
                postalCode: '80000',
                contactPerson: 'Branch Manager - Galle',
                contactNumber: '+94 91 234 5678',
                email: 'galle@codeaqua.com'
            }
        ];

        for (const locationData of additionalLocations) {
            let existingLocation = await Location.findOne({ where: { code: locationData.code } });
            if (!existingLocation) {
                await Location.create({
                    ...locationData,
                    isActive: true,
                    createdBy: 1,
                    updatedBy: 1
                });
                console.log(`✅ Additional location created: ${locationData.name}`);
            } else {
                console.log(`ℹ️  Location already exists: ${locationData.name}`);
            }
        }

        // Get all created locations
        const locations = await Location.findAll();

        // Create default stores for each location
        const storeTemplates = [
            { name: 'Main Storage Area', capacity: 10000 },
            { name: 'Dry Storage', capacity: 5000 },
            { name: 'Cold Storage Prep Area', capacity: 2000 },
            { name: 'Dispatch Area', capacity: 1500 },
            { name: 'Receiving Area', capacity: 1000 }
        ];

        for (const location of locations) {
            for (const storeTemplate of storeTemplates) {
                const storeName = `${storeTemplate.name} - ${location.name}`;
                let existingStore = await Store.findOne({ 
                    where: { 
                        name: storeName,
                        locationId: location.id 
                    } 
                });
                
                if (!existingStore) {
                    await Store.create({
                        name: storeName,
                        capacity: storeTemplate.capacity,
                        locationId: location.id,
                        createdBy: 1,
                        updatedBy: 1
                    });
                    console.log(`✅ Store created: ${storeName}`);
                } else {
                    console.log(`ℹ️  Store already exists: ${storeName}`);
                }
            }
        }

        console.log('🎉 Location and Store seeding completed successfully!');
        console.log(`📍 Total Locations: ${locations.length}`);
        
        const totalStores = await Store.count();
        console.log(`🏪 Total Stores: ${totalStores}`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating default locations and stores:', error);
        process.exit(1);
    }
}

// Run the seeder
createDefaultLocationAndStore();