require('dotenv').config();

const sequelize = require('../config/db');
const { ReturnType, Unit } = require('../models');

async function seedReturnTypesAndUnits() {
    try {
        // Sync database with all tables first
        await sequelize.sync({ force: false });
        console.log('🔄 Database synchronized for return types and units seeding.');
        
        // Default Return Types
        const defaultReturnTypes = [
            {
                name: 'Damaged Product',
                code: 'RT-DMG',
                description: 'Product received in damaged condition or damaged during handling',
                isRefundable: true,
                isReplaceable: true,
                priority: 10
            },
            {
                name: 'Expired Product',
                code: 'RT-EXP',
                description: 'Product has expired or will expire soon',
                isRefundable: false,
                isReplaceable: false,
                priority: 8
            },
            {
                name: 'Quality Issue',
                code: 'RT-QUA',
                description: 'Product quality does not meet standards',
                isRefundable: true,
                isReplaceable: true,
                priority: 9
            },
            {
                name: 'Wrong Product',
                code: 'RT-WRG',
                description: 'Wrong product delivered to customer',
                isRefundable: true,
                isReplaceable: true,
                priority: 7
            },
            {
                name: 'Customer Rejection',
                code: 'RT-CUS',
                description: 'Customer rejected the product',
                isRefundable: true,
                isReplaceable: false,
                priority: 5
            },
            {
                name: 'Overstock Return',
                code: 'RT-OVR',
                description: 'Excess inventory being returned to supplier',
                isRefundable: false,
                isReplaceable: false,
                priority: 3
            }
        ];

        // Default Units
        const defaultUnits = [
            // Weight Units
            {
                name: 'Kilogram',
                code: 'UNIT-KG',
                symbol: 'kg',
                unitType: 'WEIGHT',
                baseUnit: 'gram',
                conversionFactor: 1000.0,
                description: 'Kilogram - standard unit of mass'
            },
            {
                name: 'Gram',
                code: 'UNIT-G',
                symbol: 'g',
                unitType: 'WEIGHT',
                baseUnit: 'gram',
                conversionFactor: 1.0,
                description: 'Gram - base unit of mass'
            },
            {
                name: 'Pound',
                code: 'UNIT-LB',
                symbol: 'lb',
                unitType: 'WEIGHT',
                baseUnit: 'gram',
                conversionFactor: 453.592,
                description: 'Pound - imperial unit of weight'
            },
            // Volume Units
            {
                name: 'Liter',
                code: 'UNIT-L',
                symbol: 'l',
                unitType: 'VOLUME',
                baseUnit: 'milliliter',
                conversionFactor: 1000.0,
                description: 'Liter - standard unit of volume'
            },
            {
                name: 'Milliliter',
                code: 'UNIT-ML',
                symbol: 'ml',
                unitType: 'VOLUME',
                baseUnit: 'milliliter',
                conversionFactor: 1.0,
                description: 'Milliliter - base unit of volume'
            },
            {
                name: 'Gallon',
                code: 'UNIT-GAL',
                symbol: 'gal',
                unitType: 'VOLUME',
                baseUnit: 'milliliter',
                conversionFactor: 3785.41,
                description: 'Gallon - imperial unit of volume'
            },
            // Count Units
            {
                name: 'Piece',
                code: 'UNIT-PC',
                symbol: 'pcs',
                unitType: 'COUNT',
                baseUnit: 'piece',
                conversionFactor: 1.0,
                description: 'Individual pieces or items',
                isDecimalAllowed: false
            },
            {
                name: 'Dozen',
                code: 'UNIT-DZ',
                symbol: 'dz',
                unitType: 'COUNT',
                baseUnit: 'piece',
                conversionFactor: 12.0,
                description: 'Twelve pieces',
                isDecimalAllowed: false
            },
            {
                name: 'Box',
                code: 'UNIT-BOX',
                symbol: 'box',
                unitType: 'COUNT',
                baseUnit: 'piece',
                conversionFactor: 1.0,
                description: 'Box or carton',
                isDecimalAllowed: false
            },
            {
                name: 'Carton',
                code: 'UNIT-CTN',
                symbol: 'ctn',
                unitType: 'COUNT',
                baseUnit: 'piece',
                conversionFactor: 1.0,
                description: 'Carton packaging unit',
                isDecimalAllowed: false
            },
            // Length Units
            {
                name: 'Meter',
                code: 'UNIT-M',
                symbol: 'm',
                unitType: 'LENGTH',
                baseUnit: 'millimeter',
                conversionFactor: 1000.0,
                description: 'Meter - standard unit of length'
            },
            {
                name: 'Centimeter',
                code: 'UNIT-CM',
                symbol: 'cm',
                unitType: 'LENGTH',
                baseUnit: 'millimeter',
                conversionFactor: 10.0,
                description: 'Centimeter - unit of length'
            }
        ];

        // Create return types
        for (const returnTypeData of defaultReturnTypes) {
            let existingReturnType = await ReturnType.findOne({ where: { code: returnTypeData.code } });
            if (!existingReturnType) {
                await ReturnType.create({
                    ...returnTypeData,
                    isActive: true,
                    createdBy: 1,
                    updatedBy: 1
                });
                console.log(`✅ Return type created: ${returnTypeData.name}`);
            } else {
                console.log(`ℹ️  Return type already exists: ${returnTypeData.name}`);
            }
        }

        // Create units
        for (const unitData of defaultUnits) {
            let existingUnit = await Unit.findOne({ where: { code: unitData.code } });
            if (!existingUnit) {
                await Unit.create({
                    ...unitData,
                    isActive: true,
                    createdBy: 1,
                    updatedBy: 1
                });
                console.log(`✅ Unit created: ${unitData.name} (${unitData.symbol})`);
            } else {
                console.log(`ℹ️  Unit already exists: ${unitData.name} (${unitData.symbol})`);
            }
        }

        console.log('🎉 Return types and units seeding completed successfully!');
        
        const totalReturnTypes = await ReturnType.count();
        const totalUnits = await Unit.count();
        console.log(`📋 Total Return Types: ${totalReturnTypes}`);
        console.log(`📐 Total Units: ${totalUnits}`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating default return types and units:', error);
        process.exit(1);
    }
}

// Run the seeder
seedReturnTypesAndUnits();