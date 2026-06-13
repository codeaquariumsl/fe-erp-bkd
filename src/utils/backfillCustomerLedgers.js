const { Customer, LedgerAccount, ControlAccount, sequelize } = require('../models');
const { Op } = require('sequelize');

async function backfillCustomerLedgers() {
    const t = await sequelize.transaction();
    try {
        console.log('--- Starting Customer Ledger Backfill ---');

        // 1. Find the Customer Control Account
        const controlAccount = await ControlAccount.findOne({
            where: { controlType: 'CUSTOMER', status: 'Active' },
            transaction: t
        });

        if (!controlAccount) {
            throw new Error('Customer Control Account not found. Please ensure it exists and is active.');
        }

        console.log(`Using Control Account: ${controlAccount.name} (${controlAccount.code})`);

        // 2. Find all customers without a ledger account
        const customers = await Customer.findAll({
            where: { ledgerAccountId: null },
            transaction: t
        });

        console.log(`Found ${customers.length} customers needing ledger accounts.`);

        const prefixCode = controlAccount.code;

        for (const customer of customers) {
            // 3. Generate Next Ledger Code
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

            console.log(`Creating ledger ${ledgerCode} for customer: ${customer.name}`);

            // 4. Create Ledger Account
            const ledgerAccount = await LedgerAccount.create({
                ledgerCode,
                name: `Customer - ${customer.name}`,
                description: `Auto-generated ledger for customer ${customer.name}`,
                accountTypeId: controlAccount.accountTypeId,
                accountCategoryId: controlAccount.accountCategoryId,
                isUseControlAccount: true,
                controlAccountId: controlAccount.id,
                ledgerType: 'GENERAL',
                createdBy: customer.createdBy || 1
            }, { transaction: t });

            // 5. Link to Customer
            await customer.update({ ledgerAccountId: ledgerAccount.id }, { transaction: t });

            console.log(`Successfully linked ledger ID ${ledgerAccount.id} to customer ${customer.id}`);
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

backfillCustomerLedgers();
