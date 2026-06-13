const { Supplier, LedgerAccount, ControlAccount, sequelize } = require('../models');
const { Op } = require('sequelize');

async function backfillSupplierLedgers() {
    const t = await sequelize.transaction();
    try {
        console.log('--- Starting Supplier Ledger Backfill ---');

        // 1. Find the Supplier Control Account
        const controlAccount = await ControlAccount.findOne({
            where: { controlType: 'SUPPLIER', status: 'Active' },
            transaction: t
        });

        if (!controlAccount) {
            throw new Error('Supplier Control Account not found. Please ensure it exists and is active.');
        }

        console.log(`Using Control Account: ${controlAccount.name} (${controlAccount.code})`);

        // 2. Find all suppliers without a ledger account
        const suppliers = await Supplier.findAll({
            where: { ledgerAccountId: null },
            transaction: t
        });

        console.log(`Found ${suppliers.length} suppliers needing ledger accounts.`);

        const prefixCode = controlAccount.code;

        for (const supplier of suppliers) {
            // 3. Generate Next Ledger Code (Fetch fresh each time to avoid duplicates within this loop)
            const lastAccount = await LedgerAccount.findOne({
                where: {
                    controlAccountId: controlAccount.id,
                    ledgerCode: { [Op.like]: `${prefixCode}%` }
                },
                order: [['ledgerCode', 'DESC']],
                attributes: ['ledgerCode'],
                transaction: t
            });

            let nextNumber = 1;
            if (lastAccount && lastAccount.ledgerCode) {
                const numericPart = lastAccount.ledgerCode.substring(prefixCode.length);
                const lastNumber = parseInt(numericPart, 10);
                if (!isNaN(lastNumber)) {
                    nextNumber = lastNumber + 1;
                }
            }
            const ledgerCode = `${prefixCode}${String(nextNumber).padStart(3, '0')}`;

            console.log(`Creating ledger ${ledgerCode} for supplier: ${supplier.name}`);

            // 4. Create Ledger Account
            const ledgerAccount = await LedgerAccount.create({
                ledgerCode,
                name: `Supplier - ${supplier.name}`,
                description: `Auto-generated ledger for supplier ${supplier.name}`,
                accountTypeId: controlAccount.accountTypeId,
                accountCategoryId: controlAccount.accountCategoryId,
                isUseControlAccount: true,
                controlAccountId: controlAccount.id,
                ledgerType: 'GENERAL',
                createdBy: supplier.createdBy || 1 // Fallback to system user if creator unknown
            }, { transaction: t });

            // 5. Link to Supplier
            await supplier.update({ ledgerAccountId: ledgerAccount.id }, { transaction: t });

            console.log(`Successfully linked ledger ID ${ledgerAccount.id} to supplier ${supplier.id}`);
        }

        await t.commit();
        console.log('--- Backfill Completed Successfully ---');
        process.exit(0);
    } catch (error) {
        if (t) await t.rollback();
        console.error('--- Backfill Failed ---');
        console.error(error.message);
        process.exit(1);
    }
}

backfillSupplierLedgers();
