const { sequelize, LedgerAccount, TransactionHeader, TransactionDetail, Invoice, Customer, Supplier, Stock, Item, BillEntry, Receipt, CustomerReturn, CreditNote, User } = require('../models');
const { Op } = require('sequelize');

/**
 * 1. TRIAL BALANCE
 * Purpose: Verify that total debits equal credits
 * Answers: "Is my accounting engine healthy?"
 */
exports.getTrialBalance = async (req, res) => {
    try {
        const { asOfDate } = req.query;
        const dateCondition = asOfDate ? new Date(asOfDate) : new Date();

        // Ensure we include everything up to the last millisecond of the selected date
        if (asOfDate) {
            dateCondition.setHours(23, 59, 59, 999);
        }

        // Get all ledger accounts with their balances
        const ledgers = await LedgerAccount.findAll({
            where: { status: 'Active' },
            include: [
                {
                    model: require('../models').AccountType,
                    as: 'AccountType',
                    attributes: ['id', 'name', 'drBehavior', 'crBehavior']
                },
                {
                    model: require('../models').AccountCategory,
                    as: 'AccountCategory',
                    attributes: ['id', 'name']
                }
            ],
            order: [
                ['accountTypeId', 'ASC'],
                ['ledgerCode', 'ASC']
            ]
        });

        // Calculate balances for each ledger
        const trialBalanceData = [];
        let totalDebit = 0;
        let totalCredit = 0;

        for (const ledger of ledgers) {
            // Get opening balance
            let openingBalance = parseFloat(ledger.openingBalance) || 0;
            if (ledger.openingBalanceType === 'CR') {
                openingBalance = -openingBalance;
            }

            // Get sum of debits and credits from transaction details
            const transactionLines = await TransactionDetail.findAll({
                attributes: [
                    [sequelize.fn('SUM', sequelize.col('debitAmount')), 'totalDebit'],
                    [sequelize.fn('SUM', sequelize.col('creditAmount')), 'totalCredit']
                ],
                where: { ledgerAccountId: ledger.id },
                include: [
                    {
                        model: TransactionHeader,
                        as: 'TransactionHeader',
                        attributes: [],
                        where: {
                            status: 'Posted',
                            transactionDate: { [Op.lte]: dateCondition }
                        },
                        required: true
                    }
                ],
                raw: true
            });

            const totalDebitAmount = parseFloat(transactionLines[0]?.totalDebit) || 0;
            const totalCreditAmount = parseFloat(transactionLines[0]?.totalCredit) || 0;

            // Calculate balance (considering account type behavior)
            let balance = openingBalance + totalDebitAmount - totalCreditAmount;
            let balanceType = balance >= 0 ? 'DR' : 'CR';
            balance = Math.abs(balance);

            if (balance !== 0) {
                trialBalanceData.push({
                    ledgerCode: ledger.ledgerCode,
                    ledgerName: ledger.name,
                    accountType: ledger.AccountType?.name,
                    accountCategory: ledger.AccountCategory?.name,
                    openingBalance: Math.abs(openingBalance),
                    openingBalanceType: ledger.openingBalance >= 0 ? 'DR' : 'CR',
                    journalDebits: totalDebitAmount,
                    journalCredits: totalCreditAmount,
                    closingBalance: balance,
                    closingBalanceType: balanceType,
                    debitBalance: balanceType === 'DR' ? balance : 0,
                    creditBalance: balanceType === 'CR' ? balance : 0
                });

                if (balanceType === 'DR') {
                    totalDebit += balance;
                } else {
                    totalCredit += balance;
                }
            }
        }

        // Verify balance
        const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

        res.json({
            success: true,
            asOfDate: dateCondition,
            data: trialBalanceData,
            summary: {
                totalDebits: totalDebit.toFixed(2),
                totalCredits: totalCredit.toFixed(2),
                difference: (totalDebit - totalCredit).toFixed(2),
                isBalanced: isBalanced,
                message: isBalanced ? 'Trial Balance is correct - Total DR = Total CR' : 'Trial Balance is incorrect - Please check entries'
            }
        });
    } catch (error) {
        console.error('Error getting trial balance:', error);
        res.status(500).json({ error: 'Failed to retrieve trial balance', details: error.message });
    }
};

/**
 * 2. PROFIT & LOSS STATEMENT
 * Purpose: Measure business performance
 * Answers: "Did we earn money?"
 */
exports.getProfitAndLoss = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Start date and end date are required' });
        }

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);

        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        // Get all ledger accounts
        const ledgers = await LedgerAccount.findAll({
            where: { status: 'Active' },
            include: [
                {
                    model: require('../models').AccountType,
                    as: 'AccountType',
                    attributes: ['id', 'name']
                },
                {
                    model: require('../models').AccountCategory,
                    as: 'AccountCategory',
                    attributes: ['id', 'name']
                }
            ]
        });

        // Separate income and expense accounts
        const incomeAccounts = [];
        const expenseAccounts = [];
        const cogsAccount = [];

        let totalIncome = 0;
        let totalExpenses = 0;
        let totalCogs = 0;

        for (const ledger of ledgers) {
            if (ledger.AccountType?.name === 'Income') {
                const balance = await getLedgerBalance(ledger.id, start, end);
                if (balance !== 0) {
                    incomeAccounts.push({
                        ledgerCode: ledger.ledgerCode,
                        ledgerName: ledger.name,
                        amount: balance
                    });
                    totalIncome += balance;
                }
            } else if (ledger.AccountType?.name === 'Expense') {
                const balance = await getLedgerBalance(ledger.id, start, end);
                if (balance !== 0) {
                    expenseAccounts.push({
                        ledgerCode: ledger.ledgerCode,
                        ledgerName: ledger.name,
                        amount: balance
                    });
                    totalExpenses += balance;
                }
            }
        }

        // Calculate COGS from opening stock, purchases, and closing stock
        const cogs = await calculateCOGS(startDate, endDate);
        const grossProfit = totalIncome - cogs;
        const netProfit = grossProfit - totalExpenses;

        res.json({
            success: true,
            period: { startDate, endDate },
            incomeStatement: {
                sales: {
                    accounts: incomeAccounts,
                    total: totalIncome.toFixed(2)
                },
                costOfGoodsSold: {
                    amount: cogs.toFixed(2)
                },
                grossProfit: grossProfit.toFixed(2),
                operatingExpenses: {
                    accounts: expenseAccounts,
                    total: totalExpenses.toFixed(2)
                },
                netProfitLoss: netProfit.toFixed(2),
                profitMargin: totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(2) : 0
            }
        });
    } catch (error) {
        console.error('Error getting P&L:', error);
        res.status(500).json({ error: 'Failed to retrieve profit & loss statement', details: error.message });
    }
};

/**
 * 3. BALANCE SHEET
 * Purpose: Show financial position on a specific date
 * Answers: "What do we own and what do we owe?"
 */
exports.getBalanceSheet = async (req, res) => {
    try {
        const { asOfDate } = req.query;
        const dateCondition = asOfDate ? new Date(asOfDate) : new Date();

        // Set to end of day to include all transactions on that day
        if (asOfDate) {
            dateCondition.setHours(23, 59, 59, 999);
        }

        const ledgers = await LedgerAccount.findAll({
            where: { status: 'Active' },
            include: [
                {
                    model: require('../models').AccountType,
                    as: 'AccountType',
                    attributes: ['id', 'name']
                },
                {
                    model: require('../models').AccountCategory,
                    as: 'AccountCategory',
                    attributes: ['id', 'name']
                }
            ]
        });

        const assets = [];
        const liabilities = [];
        const equity = [];

        let totalAssets = 0;
        let totalLiabilities = 0;
        let totalEquity = 0;

        for (const ledger of ledgers) {
            const balance = await getLedgerBalanceAsOfDate(ledger.id, dateCondition);

            if (balance === 0) continue;

            const item = {
                ledgerCode: ledger.ledgerCode,
                ledgerName: ledger.name,
                category: ledger.AccountCategory?.name,
                amount: Math.abs(balance)
            };

            if (ledger.AccountType?.name === 'Asset') {
                assets.push(item);
                totalAssets += Math.abs(balance);
            } else if (ledger.AccountType?.name === 'Liability') {
                liabilities.push(item);
                totalLiabilities += Math.abs(balance);
            } else if (ledger.AccountType?.name === 'Equity') {
                equity.push(item);
                totalEquity += Math.abs(balance);
            }
        }

        const balanceSheetBalance = totalAssets - (totalLiabilities + totalEquity);
        const isBalanced = Math.abs(balanceSheetBalance) < 0.01;

        res.json({
            success: true,
            asOfDate: dateCondition,
            balanceSheet: {
                assets: {
                    accounts: assets,
                    total: totalAssets.toFixed(2)
                },
                liabilities: {
                    accounts: liabilities,
                    total: totalLiabilities.toFixed(2)
                },
                equity: {
                    accounts: equity,
                    total: totalEquity.toFixed(2)
                }
            },
            summary: {
                totalAssets: totalAssets.toFixed(2),
                totalLiabilitiesAndEquity: (totalLiabilities + totalEquity).toFixed(2),
                difference: balanceSheetBalance.toFixed(2),
                isBalanced: isBalanced,
                message: isBalanced ? 'Balance Sheet is balanced - Assets = Liabilities + Equity' : 'Balance Sheet is unbalanced'
            }
        });
    } catch (error) {
        console.error('Error getting balance sheet:', error);
        res.status(500).json({ error: 'Failed to retrieve balance sheet', details: error.message });
    }
};

/**
 * 4. CUSTOMER OUTSTANDING (ACCOUNTS RECEIVABLE)
 * Purpose: Track money customers still owe you
 * Answers: "Who hasn't paid us yet?"
 */
exports.getCustomerOutstanding = async (req, res) => {
    try {
        const { asOfDate, customerId } = req.query;
        const dateCondition = asOfDate ? new Date(asOfDate) : new Date();

        // Include everything up to the last millisecond of the selected date
        if (asOfDate) {
            dateCondition.setHours(23, 59, 59, 999);
        }

        // Get customers (optionally filtered by ID)
        const where = {};
        if (customerId) where.id = customerId;

        const customers = await Customer.findAll({
            where,
            attributes: ['id', 'name', 'creditLimit'],
            order: [['name', 'ASC']]
        });

        const outstanding = [];
        let totalOutstanding = 0;

        for (const customer of customers) {
            // Get all invoices for this customer
            const invoices = await Invoice.findAll({
                where: {
                    customerId: customer.id,
                    invoiceDate: { [Op.lte]: dateCondition },
                    status: { [Op.ne]: 'Cancelled' }
                },
                attributes: [
                    'id',
                    'invoiceNumber',
                    'invoiceDate',
                    'total',
                    'taxAmount',
                    'paidAmount',
                    'setoffAmount'
                ]
            });

            // Get all approved but unutilized returns for this customer
            const unutilizedReturns = await CustomerReturn.findAll({
                where: {
                    customerId: customer.id,
                    status: 'Approved',
                    returnDate: { [Op.lte]: dateCondition }
                }
            });

            // Get all approved but unapplied credit notes for this customer
            const unappliedCreditNotes = await CreditNote.findAll({
                where: {
                    customerId: customer.id,
                    status: 'Approved',
                    creditNoteDate: { [Op.lte]: dateCondition }
                }
            });

            if (invoices.length === 0 && unutilizedReturns.length === 0 && unappliedCreditNotes.length === 0) continue;

            let customerTotal = 0;
            const invoiceDetails = [];
            const now = new Date();

            // Track utilized credits in this report to avoid double counting
            const tempReturns = unutilizedReturns.map(r => ({
                id: r.id,
                invoiceId: r.invoiceId,
                totalAmount: parseFloat(r.totalAmount) || 0,
                utilizedAmount: parseFloat(r.utilizedAmount) || 0,
                remaining: (parseFloat(r.totalAmount) || 0) - (parseFloat(r.utilizedAmount) || 0)
            }));

            const tempCreditNotes = unappliedCreditNotes.map(cn => ({
                id: cn.id,
                invoiceId: cn.invoiceId,
                total: parseFloat(cn.total) || 0,
                appliedAmount: parseFloat(cn.appliedAmount) || 0,
                remaining: (parseFloat(cn.total) || 0) - (parseFloat(cn.appliedAmount) || 0)
            }));

            for (const invoice of invoices) {
                let outstanding_amount = parseFloat(invoice.total) - (parseFloat(invoice.paidAmount || 0) + parseFloat(invoice.setoffAmount || 0));
                
                // 1. Subtract linked returns
                tempReturns.filter(r => r.invoiceId === invoice.id).forEach(r => {
                    const deduction = Math.min(outstanding_amount, r.remaining);
                    outstanding_amount -= deduction;
                    r.remaining -= deduction;
                });

                // 2. Subtract linked credit notes
                tempCreditNotes.filter(cn => cn.invoiceId === invoice.id).forEach(cn => {
                    const deduction = Math.min(outstanding_amount, cn.remaining);
                    outstanding_amount -= deduction;
                    cn.remaining -= deduction;
                });

                if (outstanding_amount > 0) {
                    const daysOutstanding = Math.floor((now - new Date(invoice.invoiceDate)) / (1000 * 60 * 60 * 24));
                    let agingBucket = 'Current';
                    if (daysOutstanding > 90) agingBucket = 'Over 90 Days';
                    else if (daysOutstanding > 60) agingBucket = 'Over 60 Days';
                    else if (daysOutstanding > 30) agingBucket = 'Over 30 Days';

                    invoiceDetails.push({
                        invoiceNumber: invoice.invoiceNumber,
                        invoiceDate: invoice.invoiceDate,
                        total: invoice.total,
                        paidAmount: invoice.paidAmount,
                        outstanding: outstanding_amount.toFixed(2),
                        daysOutstanding,
                        agingBucket
                    });

                    customerTotal += outstanding_amount;
                }
            }

            // 3. Subtract remaining (unlinked) credits from the customerTotal
            let totalUnlinkedCredit = 0;
            tempReturns.forEach(r => {
                if (r.remaining > 0) totalUnlinkedCredit += r.remaining;
            });
            tempCreditNotes.forEach(cn => {
                if (cn.remaining > 0) totalUnlinkedCredit += cn.remaining;
            });

            customerTotal -= totalUnlinkedCredit;

            if (customerTotal !== 0 || invoiceDetails.length > 0) {
                outstanding.push({
                    customerId: customer.id,
                    customerName: customer.name,
                    creditLimit: customer.creditLimit || 0,
                    totalOutstanding: customerTotal.toFixed(2),
                    creditExceeded: customerTotal > (customer.creditLimit || 0),
                    invoices: invoiceDetails,
                    unappliedCredits: totalUnlinkedCredit.toFixed(2)
                });

                totalOutstanding += customerTotal;
            }
        }

        // Sort by outstanding amount (descending)
        outstanding.sort((a, b) => parseFloat(b.totalOutstanding) - parseFloat(a.totalOutstanding));

        res.json({
            success: true,
            asOfDate: dateCondition,
            customerOutstanding: outstanding,
            summary: {
                totalCustomers: outstanding.length,
                totalOutstanding: totalOutstanding.toFixed(2),
                overdueCases: outstanding.filter(c => c.creditExceeded).length
            }
        });
    } catch (error) {
        console.error('Error getting customer outstanding:', error);
        res.status(500).json({ error: 'Failed to retrieve customer outstanding', details: error.message });
    }
};

/**
 * 5. SUPPLIER OUTSTANDING (ACCOUNTS PAYABLE)
 * Purpose: Track money you owe suppliers
 * Answers: "Who do we need to pay?"
 */
exports.getSupplierOutstanding = async (req, res) => {
    try {
        const { asOfDate } = req.query;
        const dateCondition = asOfDate ? new Date(asOfDate) : new Date();

        // Include everything up to the last millisecond of the selected date
        if (asOfDate) {
            dateCondition.setHours(23, 59, 59, 999);
        }

        // Get all suppliers
        const suppliers = await Supplier.findAll({
            attributes: ['id', 'name'],
            order: [['name', 'ASC']]
        });

        const outstanding = [];
        let totalOutstanding = 0;

        for (const supplier of suppliers) {
            // Get all bills for this supplier
            const bills = await BillEntry.findAll({
                where: {
                    supplierId: supplier.id,
                    billDate: { [Op.lte]: dateCondition },
                    status: { [Op.in]: ['Posted', 'Approved'] }
                },
                attributes: [
                    'id',
                    'billNumber',
                    'billDate',
                    'dueDate',
                    'totalAmount',
                    'paidAmount'
                ]
            });

            if (bills.length === 0) continue;

            let supplierTotal = 0;
            const billDetails = [];
            const now = new Date();

            for (const bill of bills) {
                const outstanding_amount = parseFloat(bill.totalAmount) - parseFloat(bill.paidAmount || 0);
                if (outstanding_amount > 0) {
                    const daysOverdue = Math.floor((now - new Date(bill.dueDate)) / (1000 * 60 * 60 * 24));
                    let agingBucket = 'Current';
                    if (daysOverdue > 90) agingBucket = 'Over 90 Days';
                    else if (daysOverdue > 60) agingBucket = 'Over 60 Days';
                    else if (daysOverdue > 30) agingBucket = 'Over 30 Days';
                    else if (daysOverdue > 0) agingBucket = 'Overdue';

                    billDetails.push({
                        billNumber: bill.billNumber,
                        billDate: bill.billDate,
                        dueDate: bill.dueDate,
                        billAmount: bill.totalAmount,
                        paidAmount: bill.paidAmount,
                        outstanding: outstanding_amount.toFixed(2),
                        daysOverdue: Math.max(0, daysOverdue),
                        agingBucket
                    });

                    supplierTotal += outstanding_amount;
                }
            }

            if (supplierTotal > 0) {
                outstanding.push({
                    supplierId: supplier.id,
                    supplierName: supplier.name,
                    totalOutstanding: supplierTotal.toFixed(2),
                    bills: billDetails
                });

                totalOutstanding += supplierTotal;
            }
        }

        // Sort by outstanding amount (descending)
        outstanding.sort((a, b) => parseFloat(b.totalOutstanding) - parseFloat(a.totalOutstanding));

        res.json({
            success: true,
            asOfDate: dateCondition,
            supplierOutstanding: outstanding,
            summary: {
                totalSuppliers: outstanding.length,
                totalOutstanding: totalOutstanding.toFixed(2),
                overduePayments: outstanding.reduce((sum, s) => {
                    const overdue = s.bills.filter(b => b.daysOverdue > 0).length;
                    return sum + overdue;
                }, 0)
            }
        });
    } catch (error) {
        console.error('Error getting supplier outstanding:', error);
        res.status(500).json({ error: 'Failed to retrieve supplier outstanding', details: error.message });
    }
};

/**
 * 6. STOCK VALUATION
 * Purpose: Show the monetary value of inventory
 * Answers: "How much money is sitting on shelves?"
 * Note: Cost price is fetched from the most recent approved GRN for each item
 */
exports.getStockValuation = async (req, res) => {
    try {
        const { asOfDate } = req.query;
        const dateCondition = asOfDate ? new Date(asOfDate) : new Date();

        // Include everything up to the last millisecond of the selected date
        if (asOfDate) {
            dateCondition.setHours(23, 59, 59, 999);
        }

        // Get all items with current stock
        const stocks = await Stock.findAll({
            where: { status: 'Active' },
            include: [
                {
                    model: Item,
                    as: 'Item',
                    attributes: ['id', 'sku', 'name', 'sellingPrice']
                }
            ],
            attributes: ['id', 'itemId', 'availableQty', 'weight']
        });

        const valuation = [];
        let totalValuationAtCost = 0;
        let totalValuationAtMarket = 0;
        let totalQuantity = 0;

        for (const stock of stocks) {
            const item = stock.Item;
            if (!item) continue;

            const quantity = stock.availableQty || 0;

            // Get the most recent approved GRN cost price for this item
            const unitCost = await getLatestGRNCostPrice(stock.itemId, dateCondition);
            const sellingPrice = parseFloat(item.sellingPrice) || 0;

            const valuationAtCost = quantity * unitCost;
            const valuationAtMarket = quantity * sellingPrice;

            if (quantity > 0) {
                valuation.push({
                    itemSku: item.sku,
                    itemName: item.name,
                    quantity,
                    unitCost: unitCost.toFixed(2),
                    sellingPrice: sellingPrice.toFixed(2),
                    valuationAtCost: valuationAtCost.toFixed(2),
                    valuationAtMarket: valuationAtMarket.toFixed(2),
                    margin: sellingPrice > 0 ? ((sellingPrice - unitCost) / sellingPrice * 100).toFixed(2) : '0.00'
                });

                totalValuationAtCost += valuationAtCost;
                totalValuationAtMarket += valuationAtMarket;
                totalQuantity += quantity;
            }
        }

        // Sort by valuation (descending)
        valuation.sort((a, b) => parseFloat(b.valuationAtCost) - parseFloat(a.valuationAtCost));

        res.json({
            success: true,
            asOfDate: dateCondition,
            stockValuation: valuation,
            summary: {
                totalItems: valuation.length,
                totalQuantity,
                totalValuationAtCost: totalValuationAtCost.toFixed(2),
                totalValuationAtMarket: totalValuationAtMarket.toFixed(2),
                potentialProfit: (totalValuationAtMarket - totalValuationAtCost).toFixed(2),
                profitMargin: totalValuationAtMarket > 0 ? (((totalValuationAtMarket - totalValuationAtCost) / totalValuationAtMarket) * 100).toFixed(2) : '0.00'
            }
        });
    } catch (error) {
        console.error('Error getting stock valuation:', error);
        res.status(500).json({ error: 'Failed to retrieve stock valuation', details: error.message });
    }
};

/**
 * 7. CASH & BANK BOOK
 * Purpose: Track real money movement
 * Answers: "How much cash do we actually have?"
 */
exports.getCashAndBankBook = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        let dateCondition = null;
        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);

            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            dateCondition = {
                [Op.between]: [start, end]
            };
        }

        // Get all bank/cash ledger accounts
        const cashAndBankLedgers = await LedgerAccount.findAll({
            where: {
                status: 'Active',
                ledgerType: { [Op.in]: ['BANK', 'CASH', 'PETTY_CASH', 'CASH_BOOK'] }
            },
            include: [
                {
                    model: require('../models').AccountType,
                    as: 'AccountType',
                    attributes: ['name']
                }
            ]
        });

        const accounts = [];
        let totalCash = 0;
        let totalBank = 0;

        for (const ledger of cashAndBankLedgers) {
            // Get all transactions for this ledger
            const transactions = [];
            let balance = parseFloat(ledger.openingBalance) || 0;

            const transactionLines = await TransactionDetail.findAll({
                where: { ledgerAccountId: ledger.id },
                include: [
                    {
                        model: TransactionHeader,
                        as: 'TransactionHeader',
                        attributes: ['id', 'transactionNumber', 'transactionDate', 'description', 'status', 'transactionModule', 'referenceNumber'],
                        where: dateCondition ? { transactionDate: dateCondition } : { status: 'Posted' }
                    }
                ],
                order: [
                    [sequelize.col('TransactionHeader.transactionDate'), 'ASC'],
                    ['id', 'ASC']
                ]
            });

            for (const line of transactionLines) {
                const debit = parseFloat(line.debitAmount) || 0;
                const credit = parseFloat(line.creditAmount) || 0;
                balance += debit - credit;

                if (debit !== 0 || credit !== 0) {
                    transactions.push({
                        date: line.TransactionHeader.transactionDate,
                        transactionNumber: line.TransactionHeader.transactionNumber,
                        referenceNumber: line.TransactionHeader.referenceNumber,
                        module: line.TransactionHeader.transactionModule,
                        description: line.description || line.TransactionHeader.description,
                        debit: debit.toFixed(2),
                        credit: credit.toFixed(2),
                        balance: balance.toFixed(2)
                    });
                }
            }

            if (transactions.length > 0 || parseFloat(ledger.openingBalance) !== 0) {
                const accountInfo = {
                    ledgerCode: ledger.ledgerCode,
                    ledgerName: ledger.name,
                    ledgerType: ledger.ledgerType,
                    openingBalance: Math.abs(parseFloat(ledger.openingBalance) || 0).toFixed(2),
                    closingBalance: Math.abs(balance).toFixed(2),
                    transactions
                };

                accounts.push(accountInfo);

                if (ledger.ledgerType === 'CASH' || ledger.ledgerType === 'PETTY_CASH') {
                    totalCash += balance;
                } else {
                    totalBank += balance;
                }
            }
        }

        res.json({
            success: true,
            period: startDate && endDate ? { startDate, endDate } : { all: true },
            accounts,
            summary: {
                totalCash: totalCash.toFixed(2),
                totalBank: totalBank.toFixed(2),
                totalCashAndBank: (totalCash + totalBank).toFixed(2)
            }
        });
    } catch (error) {
        console.error('Error getting cash and bank book:', error);
        res.status(500).json({ error: 'Failed to retrieve cash and bank book', details: error.message });
    }
};


/**
 * Helper function to get the latest approved GRN cost price for an item
 * Gets the most recent approved GRN's cost price for accurate inventory valuation
 */
async function getLatestGRNCostPrice(itemId, asOfDate) {
    try {
        const GRNItem = require('../models').GRNItem;
        const GRN = require('../models').GRN;

        // Get the most recent approved GRN for this item as of the specified date
        const latestGRNItem = await GRNItem.findOne({
            attributes: ['costPrice'],
            include: [
                {
                    model: GRN,
                    as: 'GRN',
                    attributes: ['grnDate', 'status'],
                    where: {
                        status: 'Approved',
                        grnDate: { [Op.lte]: asOfDate }
                    },
                    required: true
                }
            ],
            where: { itemId },
            order: [
                [{ model: GRN, as: 'GRN' }, 'grnDate', 'DESC']
            ]
        });

        return parseFloat(latestGRNItem?.costPrice) || 0;
    } catch (error) {
        console.error(`Error getting latest GRN cost price for item ${itemId}:`, error);
        return 0;
    }
}

/**
 * Helper function to calculate ledger balance
 */
async function getLedgerBalance(ledgerId, startDate, endDate) {
    const transactionLines = await TransactionDetail.findAll({
        attributes: [
            [sequelize.fn('SUM', sequelize.col('debitAmount')), 'totalDebit'],
            [sequelize.fn('SUM', sequelize.col('creditAmount')), 'totalCredit']
        ],
        where: { ledgerAccountId: ledgerId },
        include: [
            {
                model: TransactionHeader,
                as: 'TransactionHeader',
                attributes: [],
                where: {
                    status: 'Posted',
                    transactionDate: { [Op.between]: [startDate, endDate] }
                },
                required: true
            }
        ],
        raw: true
    });

    const totalDebit = parseFloat(transactionLines[0]?.totalDebit) || 0;
    const totalCredit = parseFloat(transactionLines[0]?.totalCredit) || 0;

    return totalDebit - totalCredit;
}

/**
 * Helper function to calculate ledger balance as of a specific date
 */
async function getLedgerBalanceAsOfDate(ledgerId, asOfDate) {
    const ledger = await LedgerAccount.findByPk(ledgerId);
    let openingBalance = parseFloat(ledger.openingBalance) || 0;
    if (ledger.openingBalanceType === 'CR') {
        openingBalance = -openingBalance;
    }

    const transactionLines = await TransactionDetail.findAll({
        attributes: [
            [sequelize.fn('SUM', sequelize.col('debitAmount')), 'totalDebit'],
            [sequelize.fn('SUM', sequelize.col('creditAmount')), 'totalCredit']
        ],
        where: { ledgerAccountId: ledgerId },
        include: [
            {
                model: TransactionHeader,
                as: 'TransactionHeader',
                attributes: [],
                where: {
                    status: 'Posted',
                    transactionDate: { [Op.lte]: asOfDate }
                },
                required: true
            }
        ],
        raw: true
    });

    const totalDebit = parseFloat(transactionLines[0]?.totalDebit) || 0;
    const totalCredit = parseFloat(transactionLines[0]?.totalCredit) || 0;

    return openingBalance + totalDebit - totalCredit;
}

/**
 * Helper function to calculate COGS
 */
async function calculateCOGS(startDate, endDate) {
    // This is a simplified COGS calculation
    // In real scenarios, you would use Opening Stock + Purchases - Closing Stock
    // For now, we'll calculate from stock movements

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Get opening stock value at start date
    const openingStockValue = await getStockValuationAsOfDate(start);

    // Get closing stock value at end date
    const closingStockValue = await getStockValuationAsOfDate(end);

    // Get total purchases during period
    const totalPurchases = await getTotalPurchases(start, end);

    // COGS = Opening Stock + Purchases - Closing Stock
    const cogs = openingStockValue + totalPurchases - closingStockValue;

    return cogs;
}

/**
 * Helper function to get stock valuation as of a specific date
 * Uses latest approved GRN cost price for each item
 */
async function getStockValuationAsOfDate(asOfDate) {
    const stocks = await Stock.findAll({
        include: [
            {
                model: Item,
                as: 'Item',
                attributes: ['id']
            }
        ]
    });

    let totalValue = 0;
    for (const stock of stocks) {
        if (stock.Item) {
            const costPrice = await getLatestGRNCostPrice(stock.Item.id, asOfDate);
            totalValue += (stock.availableQty || 0) * costPrice;
        }
    }

    return totalValue;
}

/**
 * Helper function to get total purchases in a period
 */
async function getTotalPurchases(startDate, endDate) {
    const billEntries = await BillEntry.findAll({
        where: {
            billDate: { [Op.between]: [startDate, endDate] },
            status: { [Op.in]: ['Posted', 'Approved'] }
        },
        attributes: [[sequelize.fn('SUM', sequelize.col('totalAmount')), 'total']],
        raw: true
    });

    return parseFloat(billEntries[0]?.total) || 0;
}

/**
 * Get comprehensive accounting dashboard
 */
exports.getAccountingDashboard = async (req, res) => {
    try {
        const asOfDate = new Date();
        const startOfMonth = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), 1);

        // Get trial balance summary
        const trialBalance = await getTBSummary(asOfDate);

        // Get P&L summary for the month
        const pnlSummary = await getPLSummary(startOfMonth, asOfDate);

        // Get balance sheet summary
        const bsSummary = await getBSSummary(asOfDate);

        res.json({
            success: true,
            asOfDate,
            dashboard: {
                trialBalance: trialBalance,
                profitAndLoss: pnlSummary,
                balanceSheet: bsSummary
            }
        });
    } catch (error) {
        console.error('Error getting accounting dashboard:', error);
        res.status(500).json({ error: 'Failed to retrieve accounting dashboard', details: error.message });
    }
};

/**
 * Helper to get trial balance summary
 */
async function getTBSummary(asOfDate) {
    const ledgers = await LedgerAccount.findAll({
        where: { status: 'Active' },
        attributes: ['id', 'openingBalance', 'openingBalanceType']
    });

    let totalDebit = 0;
    let totalCredit = 0;

    for (const ledger of ledgers) {
        const balance = await getLedgerBalanceAsOfDate(ledger.id, asOfDate);
        if (balance >= 0) {
            totalDebit += balance;
        } else {
            totalCredit += Math.abs(balance);
        }
    }

    return {
        totalDebits: totalDebit.toFixed(2),
        totalCredits: totalCredit.toFixed(2),
        isBalanced: Math.abs(totalDebit - totalCredit) < 0.01
    };
}

/**
 * Helper to get P&L summary
 */
async function getPLSummary(startDate, endDate) {
    const ledgers = await LedgerAccount.findAll({
        include: [
            {
                model: require('../models').AccountType,
                as: 'AccountType',
                attributes: ['name']
            }
        ]
    });

    let totalIncome = 0;
    let totalExpenses = 0;

    for (const ledger of ledgers) {
        const balance = await getLedgerBalance(ledger.id, startDate, endDate);
        if (ledger.AccountType?.name === 'Income') {
            totalIncome += balance;
        } else if (ledger.AccountType?.name === 'Expense') {
            totalExpenses += balance;
        }
    }

    return {
        totalIncome: totalIncome.toFixed(2),
        totalExpenses: totalExpenses.toFixed(2),
        netProfit: (totalIncome - totalExpenses).toFixed(2)
    };
}

/**
 * Helper to get balance sheet summary
 */
async function getBSSummary(asOfDate) {
    const ledgers = await LedgerAccount.findAll({
        include: [
            {
                model: require('../models').AccountType,
                as: 'AccountType',
                attributes: ['name']
            }
        ]
    });

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    for (const ledger of ledgers) {
        const balance = await getLedgerBalanceAsOfDate(ledger.id, asOfDate);
        const absBalance = Math.abs(balance);

        if (ledger.AccountType?.name === 'Asset') {
            totalAssets += absBalance;
        } else if (ledger.AccountType?.name === 'Liability') {
            totalLiabilities += absBalance;
        } else if (ledger.AccountType?.name === 'Equity') {
            totalEquity += absBalance;
        }
    }

    return {
        totalAssets: totalAssets.toFixed(2),
        totalLiabilities: totalLiabilities.toFixed(2),
        totalEquity: totalEquity.toFixed(2),
        isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01
    };
}

/**
 * 8. LEDGER DETAILS REPORT
 * Purpose: Show all transactions for a specific ledger account within a date range
 * Answers: "What transactions happened in this account?"
 */
exports.getLedgerDetailsReport = async (req, res) => {
    try {
        const { ledgerAccountId, startDate, endDate } = req.query;

        // Validation
        if (!ledgerAccountId) {
            return res.status(400).json({
                error: 'Ledger Account ID is required',
                message: 'Please provide ledgerAccountId parameter'
            });
        }

        if (!startDate || !endDate) {
            return res.status(400).json({
                error: 'Date range is required',
                message: 'Please provide both startDate and endDate parameters'
            });
        }

        // Get ledger account details
        const ledgerAccount = await LedgerAccount.findByPk(ledgerAccountId, {
            include: [
                {
                    model: require('../models').AccountType,
                    as: 'AccountType',
                    attributes: ['id', 'name', 'drBehavior', 'crBehavior']
                },
                {
                    model: require('../models').AccountCategory,
                    as: 'AccountCategory',
                    attributes: ['id', 'name', 'code']
                },
                {
                    model: require('../models').ControlAccount,
                    as: 'ControlAccount',
                    attributes: ['id', 'name', 'code']
                }
            ]
        });

        if (!ledgerAccount) {
            return res.status(404).json({
                error: 'Ledger account not found',
                message: `No ledger account found with ID ${ledgerAccountId}`
            });
        }

        // Parse dates
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);

        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        // Calculate opening balance (all transactions before start date)
        const openingBalanceData = await TransactionDetail.findAll({
            attributes: [
                [sequelize.fn('SUM', sequelize.col('debitAmount')), 'totalDebit'],
                [sequelize.fn('SUM', sequelize.col('creditAmount')), 'totalCredit']
            ],
            where: { ledgerAccountId },
            include: [
                {
                    model: TransactionHeader,
                    as: 'TransactionHeader',
                    attributes: [],
                    where: {
                        status: 'Posted',
                        transactionDate: { [Op.lt]: start }
                    },
                    required: true
                }
            ],
            raw: true
        });

        const openingDebit = parseFloat(openingBalanceData[0]?.totalDebit) || 0;
        const openingCredit = parseFloat(openingBalanceData[0]?.totalCredit) || 0;
        const ledgerOpeningBalance = parseFloat(ledgerAccount.openingBalance) || 0;

        // Calculate opening balance considering the ledger's opening balance type
        let openingBalance = ledgerOpeningBalance;
        if (ledgerAccount.openingBalanceType === 'CR') {
            openingBalance = -ledgerOpeningBalance;
        }
        openingBalance += (openingDebit - openingCredit);

        // Get all transactions within the date range
        const transactionLines = await TransactionDetail.findAll({
            where: { ledgerAccountId },
            include: [
                {
                    model: TransactionHeader,
                    as: 'TransactionHeader',
                    attributes: [
                        'id',
                        'transactionNumber',
                        'transactionDate',
                        'description',
                        'status',
                        'transactionModule',
                        'referenceModule',
                        'referenceNumber',
                        'referenceId'
                    ],
                    where: {
                        status: 'Posted',
                        transactionDate: { [Op.between]: [start, end] }
                    },
                    required: true,
                    include: [
                        {
                            model: User,
                            as: 'Creator',
                            attributes: ['id', 'username', 'fullName']
                        }
                    ]
                }
            ],
            order: [
                [sequelize.col('TransactionHeader.transactionDate'), 'ASC'],
                [sequelize.col('TransactionHeader.id'), 'ASC'],
                ['lineNumber', 'ASC']
            ]
        });

        // Build transaction details with running balance
        const transactions = [];
        let runningBalance = openingBalance;

        for (const line of transactionLines) {
            const debit = parseFloat(line.debitAmount) || 0;
            const credit = parseFloat(line.creditAmount) || 0;
            runningBalance += (debit - credit);

            transactions.push({
                transactionId: line.TransactionHeader.id,
                transactionNumber: line.TransactionHeader.transactionNumber,
                transactionDate: line.TransactionHeader.transactionDate,
                module: line.TransactionHeader.transactionModule,
                referenceModule: line.TransactionHeader.referenceModule,
                referenceNumber: line.TransactionHeader.referenceNumber,
                referenceId: line.TransactionHeader.referenceId,
                description: line.description || line.TransactionHeader.description,
                debit: debit.toFixed(2),
                credit: credit.toFixed(2),
                balance: runningBalance.toFixed(2),
                balanceType: runningBalance >= 0 ? 'DR' : 'CR',
                createdBy: line.TransactionHeader.Creator ? {
                    id: line.TransactionHeader.Creator.id,
                    username: line.TransactionHeader.Creator.username,
                    fullName: line.TransactionHeader.Creator.fullName
                } : null
            });
        }

        // Calculate period totals
        const periodDebit = transactions.reduce((sum, t) => sum + parseFloat(t.debit), 0);
        const periodCredit = transactions.reduce((sum, t) => sum + parseFloat(t.credit), 0);
        const closingBalance = runningBalance;

        res.json({
            success: true,
            ledgerAccount: {
                id: ledgerAccount.id,
                ledgerCode: ledgerAccount.ledgerCode,
                name: ledgerAccount.name,
                accountType: ledgerAccount.AccountType?.name,
                accountCategory: ledgerAccount.AccountCategory?.name,
                controlAccount: ledgerAccount.ControlAccount?.name,
                description: ledgerAccount.description
            },
            period: {
                startDate: start,
                endDate: end
            },
            balances: {
                openingBalance: Math.abs(openingBalance).toFixed(2),
                openingBalanceType: openingBalance >= 0 ? 'DR' : 'CR',
                closingBalance: Math.abs(closingBalance).toFixed(2),
                closingBalanceType: closingBalance >= 0 ? 'DR' : 'CR'
            },
            periodTotals: {
                totalDebit: periodDebit.toFixed(2),
                totalCredit: periodCredit.toFixed(2),
                netMovement: (periodDebit - periodCredit).toFixed(2)
            },
            transactions,
            summary: {
                totalTransactions: transactions.length,
                periodStartDate: startDate,
                periodEndDate: endDate
            }
        });
    } catch (error) {
        console.error('Error getting ledger details report:', error);
        res.status(500).json({
            error: 'Failed to retrieve ledger details report',
            details: error.message
        });
    }
};

/**
 * 9. GENERAL LEDGER REPORT
 * Purpose: Show transaction details for all active ledger accounts within a date range
 * Answers: "What happened in all accounts during this period?"
 */
exports.getGeneralLedgerReport = async (req, res) => {
    try {
        const { startDate, endDate, accountCategory } = req.query;

        // Validation
        if (!startDate || !endDate) {
            return res.status(400).json({
                error: 'Date range is required',
                message: 'Please provide both startDate and endDate parameters'
            });
        }

        // Parse dates
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);

        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        // Find active ledger accounts
        const accountWhere = { status: 'Active' };
        
        const ledgers = await LedgerAccount.findAll({
            where: accountWhere,
            include: [
                {
                    model: require('../models').AccountType,
                    as: 'AccountType',
                    attributes: ['id', 'name', 'drBehavior', 'crBehavior']
                },
                {
                    model: require('../models').AccountCategory,
                    as: 'AccountCategory',
                    attributes: ['id', 'name', 'code']
                },
                {
                    model: require('../models').ControlAccount,
                    as: 'ControlAccount',
                    attributes: ['id', 'name', 'code']
                }
            ],
            order: [['ledgerCode', 'ASC']]
        });

        const reportData = [];

        for (const ledgerAccount of ledgers) {
            // Apply category filter if set
            if (accountCategory && accountCategory !== 'all') {
                const catName = ledgerAccount.AccountCategory?.name || ledgerAccount.accountCategory?.name || '';
                if (catName.toLowerCase() !== accountCategory.toLowerCase()) {
                    continue;
                }
            }

            const ledgerAccountId = ledgerAccount.id;

            // Calculate opening balance (all transactions before start date)
            const openingBalanceData = await TransactionDetail.findAll({
                attributes: [
                    [sequelize.fn('SUM', sequelize.col('debitAmount')), 'totalDebit'],
                    [sequelize.fn('SUM', sequelize.col('creditAmount')), 'totalCredit']
                ],
                where: { ledgerAccountId },
                include: [
                    {
                        model: TransactionHeader,
                        as: 'TransactionHeader',
                        attributes: [],
                        where: {
                            status: 'Posted',
                            transactionDate: { [Op.lt]: start }
                        },
                        required: true
                    }
                ],
                raw: true
            });

            const openingDebit = parseFloat(openingBalanceData[0]?.totalDebit) || 0;
            const openingCredit = parseFloat(openingBalanceData[0]?.totalCredit) || 0;
            const ledgerOpeningBalance = parseFloat(ledgerAccount.openingBalance) || 0;

            let openingBalance = ledgerOpeningBalance;
            if (ledgerAccount.openingBalanceType === 'CR') {
                openingBalance = -ledgerOpeningBalance;
            }
            openingBalance += (openingDebit - openingCredit);

            // Get all transactions within the date range
            const transactionLines = await TransactionDetail.findAll({
                where: { ledgerAccountId },
                include: [
                    {
                        model: TransactionHeader,
                        as: 'TransactionHeader',
                        attributes: [
                            'id',
                            'transactionNumber',
                            'transactionDate',
                            'description',
                            'status',
                            'transactionModule',
                            'referenceModule',
                            'referenceNumber',
                            'referenceId'
                        ],
                        where: {
                            status: 'Posted',
                            transactionDate: { [Op.between]: [start, end] }
                        },
                        required: true,
                        include: [
                            {
                                model: User,
                                as: 'Creator',
                                attributes: ['id', 'username', 'fullName']
                            }
                        ]
                    }
                ],
                order: [
                    [sequelize.col('TransactionHeader.transactionDate'), 'ASC'],
                    [sequelize.col('TransactionHeader.id'), 'ASC'],
                    ['lineNumber', 'ASC']
                ]
            });

            // Build transaction details with running balance
            const transactions = [];
            let runningBalance = openingBalance;

            for (const line of transactionLines) {
                const debit = parseFloat(line.debitAmount) || 0;
                const credit = parseFloat(line.creditAmount) || 0;
                runningBalance += (debit - credit);

                transactions.push({
                    transactionId: line.TransactionHeader.id,
                    transactionNumber: line.TransactionHeader.transactionNumber,
                    transactionDate: line.TransactionHeader.transactionDate,
                    module: line.TransactionHeader.transactionModule,
                    referenceModule: line.TransactionHeader.referenceModule,
                    referenceNumber: line.TransactionHeader.referenceNumber,
                    referenceId: line.TransactionHeader.referenceId,
                    description: line.description || line.TransactionHeader.description,
                    debit: debit.toFixed(2),
                    credit: credit.toFixed(2),
                    balance: runningBalance.toFixed(2),
                    balanceType: runningBalance >= 0 ? 'DR' : 'CR',
                    createdBy: line.TransactionHeader.Creator ? {
                        id: line.TransactionHeader.Creator.id,
                        username: line.TransactionHeader.Creator.username,
                        fullName: line.TransactionHeader.Creator.fullName
                    } : null
                });
            }

            // Calculate period totals
            const periodDebit = transactions.reduce((sum, t) => sum + parseFloat(t.debit), 0);
            const periodCredit = transactions.reduce((sum, t) => sum + parseFloat(t.credit), 0);
            const closingBalance = runningBalance;

            // Only include in General Ledger if there is activity or non-zero balances
            if (transactions.length > 0 || openingBalance !== 0 || closingBalance !== 0) {
                reportData.push({
                    ledgerAccount: {
                        id: ledgerAccount.id,
                        ledgerCode: ledgerAccount.ledgerCode,
                        name: ledgerAccount.name,
                        accountType: ledgerAccount.AccountType?.name,
                        accountCategory: ledgerAccount.AccountCategory?.name,
                        controlAccount: ledgerAccount.ControlAccount?.name,
                        description: ledgerAccount.description
                    },
                    balances: {
                        openingBalance: Math.abs(openingBalance).toFixed(2),
                        openingBalanceType: openingBalance >= 0 ? 'DR' : 'CR',
                        closingBalance: Math.abs(closingBalance).toFixed(2),
                        closingBalanceType: closingBalance >= 0 ? 'DR' : 'CR'
                    },
                    periodTotals: {
                        totalDebit: periodDebit.toFixed(2),
                        totalCredit: periodCredit.toFixed(2),
                        netMovement: (periodDebit - periodCredit).toFixed(2)
                    },
                    transactions,
                    summary: {
                        totalTransactions: transactions.length
                    }
                });
            }
        }

        res.json({
            success: true,
            period: {
                startDate: start,
                endDate: end
            },
            generalLedger: reportData,
            summary: {
                totalAccounts: reportData.length,
                periodStartDate: startDate,
                periodEndDate: endDate
            }
        });

    } catch (error) {
        console.error('Error getting general ledger report:', error);
        res.status(500).json({
            error: 'Failed to retrieve general ledger report',
            details: error.message
        });
    }
};
