/**
 * AUTO-POSTING SERVICE
 * 
 * This service handles automatic journal entry creation from inventory and sales transactions.
 * It bridges the inventory management system with the accounting module.
 * 
 * Transaction Types:
 * - GRN (Goods Receipt Note)
 * - Purchase Invoice
 * - Sales Invoice
 * - Stock Adjustment (Increase/Decrease)
 * - Customer Payment
 * - Supplier Payment
 * - Stock Transfer
 * - COGS (Cost of Goods Sold)
 */

const {
    AutoPostingRule,
    JournalEntry,
    JournalEntryLine,
    LedgerAccount,
    ControlAccount,
    sequelize
} = require('../models');
const { Op } = require('sequelize');

class AutoPostingService {
    /**
     * Generate unique Journal Number
     */
    static async generateJournalNumber() {
        try {
            const lastJournal = await JournalEntry.findOne({
                order: [['id', 'DESC']]
            });

            const nextNumber = (lastJournal ? parseInt(lastJournal.journalNumber.substring(2)) : 0) + 1;
            return `JN${String(nextNumber).padStart(6, '0')}`;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get Applicable Rules for a Transaction
     */
    static async getApplicableRules(triggerModule, triggerEvent) {
        try {
            const rules = await AutoPostingRule.findAll({
                where: {
                    triggerModule,
                    triggerEvent,
                    isEnabled: true
                },
                include: [
                    { model: LedgerAccount, as: 'DebitLedger' },
                    { model: LedgerAccount, as: 'CreditLedger' }
                ],
                order: [['ruleOrder', 'ASC']]
            });

            return rules;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Process GRN Auto-Posting
     * 
     * Entry: 
     * DR Inventory Asset (GRN total)
     * CR Supplier Control Account / GRN Clearing
     */
    static async processGRNPosting(grnId, grnNumber, supplierId, totalAmount, userId) {
        try {
            const rules = await this.getApplicableRules('PURCHASE_GRN', 'RECEIVE');

            if (rules.length === 0) {
                console.log('No auto-posting rules for GRN');
                return null;
            }

            const rule = rules[0]; // Use first rule if multiple exist

            const journalNumber = await this.generateJournalNumber();

            const journalEntry = await JournalEntry.create({
                journalNumber,
                journalDate: new Date(),
                description: `GRN Receipt - ${grnNumber} from Supplier #${supplierId}`,
                referenceModule: 'PURCHASE_GRN',
                referenceId: grnId,
                referenceNumber: grnNumber,
                totalDebit: totalAmount,
                totalCredit: totalAmount,
                status: 'Draft',
                isAutoPosted: true,
                createdBy: userId
            }, { transaction: sequelize });

            // Create debit line (Inventory)
            await JournalEntryLine.create({
                journalEntryId: journalEntry.id,
                ledgerAccountId: rule.debitLedgerId,
                debitAmount: totalAmount,
                creditAmount: 0,
                description: `Inventory receipt from Supplier #${supplierId}`,
                lineNumber: 1,
                createdBy: userId
            }, { transaction: sequelize });

            // Create credit line (Supplier Control)
            await JournalEntryLine.create({
                journalEntryId: journalEntry.id,
                ledgerAccountId: rule.creditLedgerId,
                debitAmount: 0,
                creditAmount: totalAmount,
                description: `Supplier payable for GRN ${grnNumber}`,
                lineNumber: 2,
                createdBy: userId
            }, { transaction: sequelize });

            return journalEntry;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Process Sales Invoice Auto-Posting
     * 
     * Entry:
     * DR Customer Control Account (Invoice total)
     * CR Sales Income
     * CR Tax Payable (if applicable)
     */
    static async processSalesInvoicePosting(invoiceId, invoiceNumber, customerId, saleAmount, taxAmount, userId) {
        try {
            const rules = await this.getApplicableRules('SALES_INVOICE', 'APPROVE');

            if (rules.length === 0) {
                console.log('No auto-posting rules for Sales Invoice');
                return null;
            }

            const rule = rules[0];

            const journalNumber = await this.generateJournalNumber();
            const totalAmount = saleAmount + (taxAmount || 0);

            const journalEntry = await JournalEntry.create({
                journalNumber,
                journalDate: new Date(),
                description: `Sales Invoice - ${invoiceNumber} to Customer #${customerId}`,
                referenceModule: 'SALES_INVOICE',
                referenceId: invoiceId,
                referenceNumber: invoiceNumber,
                totalDebit: totalAmount,
                totalCredit: totalAmount,
                status: 'Draft',
                isAutoPosted: true,
                createdBy: userId
            }, { transaction: sequelize });

            let lineNumber = 1;

            // Create debit line (Customer Control)
            await JournalEntryLine.create({
                journalEntryId: journalEntry.id,
                ledgerAccountId: rule.debitLedgerId,
                debitAmount: totalAmount,
                creditAmount: 0,
                description: `Customer receivable for Invoice ${invoiceNumber}`,
                lineNumber: lineNumber++,
                createdBy: userId
            }, { transaction: sequelize });

            // Create credit line (Sales Income)
            await JournalEntryLine.create({
                journalEntryId: journalEntry.id,
                ledgerAccountId: rule.creditLedgerId,
                debitAmount: 0,
                creditAmount: saleAmount,
                description: `Sales income from Invoice ${invoiceNumber}`,
                lineNumber: lineNumber++,
                createdBy: userId
            }, { transaction: sequelize });

            // Create tax line if applicable
            if (taxAmount && taxAmount > 0) {
                const taxRules = await this.getApplicableRules('SALES_INVOICE', 'TAX');
                if (taxRules.length > 0) {
                    await JournalEntryLine.create({
                        journalEntryId: journalEntry.id,
                        ledgerAccountId: taxRules[0].creditLedgerId,
                        debitAmount: 0,
                        creditAmount: taxAmount,
                        description: `Sales tax payable for Invoice ${invoiceNumber}`,
                        lineNumber: lineNumber++,
                        createdBy: userId
                    }, { transaction: sequelize });
                }
            }

            return journalEntry;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Process COGS Auto-Posting (when inventory is sold)
     * 
     * Entry:
     * DR COGS Expense
     * CR Inventory Asset
     */
    static async processCOGSPosting(deliveryOrderId, deliveryOrderNumber, costOfGoods, userId) {
        try {
            const rules = await this.getApplicableRules('COGS', 'RECEIPT');

            if (rules.length === 0) {
                console.log('No auto-posting rules for COGS');
                return null;
            }

            const rule = rules[0];

            const journalNumber = await this.generateJournalNumber();

            const journalEntry = await JournalEntry.create({
                journalNumber,
                journalDate: new Date(),
                description: `Cost of Goods Sold - Delivery Order ${deliveryOrderNumber}`,
                referenceModule: 'COGS',
                referenceId: deliveryOrderId,
                referenceNumber: deliveryOrderNumber,
                totalDebit: costOfGoods,
                totalCredit: costOfGoods,
                status: 'Draft',
                isAutoPosted: true,
                createdBy: userId
            }, { transaction: sequelize });

            // Create debit line (COGS Expense)
            await JournalEntryLine.create({
                journalEntryId: journalEntry.id,
                ledgerAccountId: rule.debitLedgerId,
                debitAmount: costOfGoods,
                creditAmount: 0,
                description: `Cost of goods sold - DO ${deliveryOrderNumber}`,
                lineNumber: 1,
                createdBy: userId
            }, { transaction: sequelize });

            // Create credit line (Inventory)
            await JournalEntryLine.create({
                journalEntryId: journalEntry.id,
                ledgerAccountId: rule.creditLedgerId,
                debitAmount: 0,
                creditAmount: costOfGoods,
                description: `Inventory reduction from Delivery Order ${deliveryOrderNumber}`,
                lineNumber: 2,
                createdBy: userId
            }, { transaction: sequelize });

            return journalEntry;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Process Stock Adjustment Auto-Posting
     * 
     * Increase:
     * DR Inventory
     * CR Stock Adjustment Gain (Income)
     * 
     * Decrease:
     * DR Stock Adjustment Loss (Expense)
     * CR Inventory
     */
    static async processStockAdjustmentPosting(adjustmentId, adjustmentNumber, adjustmentType, quantity, costPerUnit, userId) {
        try {
            const totalAmount = quantity * costPerUnit;
            const ruleType = adjustmentType === 'INCREASE' ? 'STOCK_ADJUSTMENT_INCREASE' : 'STOCK_ADJUSTMENT_DECREASE';
            const rules = await this.getApplicableRules(ruleType, 'APPROVE');

            if (rules.length === 0) {
                console.log(`No auto-posting rules for ${ruleType}`);
                return null;
            }

            const rule = rules[0];

            const journalNumber = await this.generateJournalNumber();

            const journalEntry = await JournalEntry.create({
                journalNumber,
                journalDate: new Date(),
                description: `Stock ${adjustmentType} - ${adjustmentNumber}`,
                referenceModule: 'INVENTORY',
                referenceId: adjustmentId,
                referenceNumber: adjustmentNumber,
                totalDebit: totalAmount,
                totalCredit: totalAmount,
                status: 'Draft',
                isAutoPosted: true,
                createdBy: userId
            }, { transaction: sequelize });

            // Create debit and credit lines based on type
            if (adjustmentType === 'INCREASE') {
                // DR Inventory, CR Gain
                await JournalEntryLine.create({
                    journalEntryId: journalEntry.id,
                    ledgerAccountId: rule.debitLedgerId,
                    debitAmount: totalAmount,
                    creditAmount: 0,
                    description: `Stock increase adjustment - ${adjustmentNumber}`,
                    lineNumber: 1,
                    createdBy: userId
                }, { transaction: sequelize });

                await JournalEntryLine.create({
                    journalEntryId: journalEntry.id,
                    ledgerAccountId: rule.creditLedgerId,
                    debitAmount: 0,
                    creditAmount: totalAmount,
                    description: `Stock adjustment gain - ${adjustmentNumber}`,
                    lineNumber: 2,
                    createdBy: userId
                }, { transaction: sequelize });
            } else {
                // DR Loss, CR Inventory
                await JournalEntryLine.create({
                    journalEntryId: journalEntry.id,
                    ledgerAccountId: rule.debitLedgerId,
                    debitAmount: totalAmount,
                    creditAmount: 0,
                    description: `Stock adjustment loss - ${adjustmentNumber}`,
                    lineNumber: 1,
                    createdBy: userId
                }, { transaction: sequelize });

                await JournalEntryLine.create({
                    journalEntryId: journalEntry.id,
                    ledgerAccountId: rule.creditLedgerId,
                    debitAmount: 0,
                    creditAmount: totalAmount,
                    description: `Stock decrease adjustment - ${adjustmentNumber}`,
                    lineNumber: 2,
                    createdBy: userId
                }, { transaction: sequelize });
            }

            return journalEntry;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Process Customer Payment Auto-Posting
     * 
     * Entry:
     * DR Cash/Bank
     * CR Customer Control Account
     */
    static async processCustomerPaymentPosting(paymentId, paymentNumber, amount, paymentMethodLedgerId, userId) {
        try {
            const rules = await this.getApplicableRules('CUSTOMER_PAYMENT', 'APPROVE');

            if (rules.length === 0) {
                console.log('No auto-posting rules for Customer Payment');
                return null;
            }

            const rule = rules[0];

            const journalNumber = await this.generateJournalNumber();

            const journalEntry = await JournalEntry.create({
                journalNumber,
                journalDate: new Date(),
                description: `Customer Payment - ${paymentNumber}`,
                referenceModule: 'CUSTOMER_PAYMENT',
                referenceId: paymentId,
                referenceNumber: paymentNumber,
                totalDebit: amount,
                totalCredit: amount,
                status: 'Draft',
                isAutoPosted: true,
                createdBy: userId
            }, { transaction: sequelize });

            // Create debit line (Cash/Bank)
            await JournalEntryLine.create({
                journalEntryId: journalEntry.id,
                ledgerAccountId: paymentMethodLedgerId,
                debitAmount: amount,
                creditAmount: 0,
                description: `Cash/Bank receipt - ${paymentNumber}`,
                lineNumber: 1,
                createdBy: userId
            }, { transaction: sequelize });

            // Create credit line (Customer Control)
            await JournalEntryLine.create({
                journalEntryId: journalEntry.id,
                ledgerAccountId: rule.creditLedgerId,
                debitAmount: 0,
                creditAmount: amount,
                description: `Customer payment received - ${paymentNumber}`,
                lineNumber: 2,
                createdBy: userId
            }, { transaction: sequelize });

            return journalEntry;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Process Supplier Payment Auto-Posting
     * 
     * Entry:
     * DR Supplier Control Account
     * CR Cash/Bank
     */
    static async processSupplierPaymentPosting(paymentId, paymentNumber, amount, paymentMethodLedgerId, userId) {
        try {
            const rules = await this.getApplicableRules('SUPPLIER_PAYMENT', 'APPROVE');

            if (rules.length === 0) {
                console.log('No auto-posting rules for Supplier Payment');
                return null;
            }

            const rule = rules[0];

            const journalNumber = await this.generateJournalNumber();

            const journalEntry = await JournalEntry.create({
                journalNumber,
                journalDate: new Date(),
                description: `Supplier Payment - ${paymentNumber}`,
                referenceModule: 'SUPPLIER_PAYMENT',
                referenceId: paymentId,
                referenceNumber: paymentNumber,
                totalDebit: amount,
                totalCredit: amount,
                status: 'Draft',
                isAutoPosted: true,
                createdBy: userId
            }, { transaction: sequelize });

            // Create debit line (Supplier Control)
            await JournalEntryLine.create({
                journalEntryId: journalEntry.id,
                ledgerAccountId: rule.debitLedgerId,
                debitAmount: amount,
                creditAmount: 0,
                description: `Supplier payment made - ${paymentNumber}`,
                lineNumber: 1,
                createdBy: userId
            }, { transaction: sequelize });

            // Create credit line (Cash/Bank)
            await JournalEntryLine.create({
                journalEntryId: journalEntry.id,
                ledgerAccountId: paymentMethodLedgerId,
                debitAmount: 0,
                creditAmount: amount,
                description: `Cash/Bank payment - ${paymentNumber}`,
                lineNumber: 2,
                createdBy: userId
            }, { transaction: sequelize });

            return journalEntry;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Process Bill Entry Posting
     * Creates journal entry from bill entry details:
     * - Debit lines: From each bill entry detail's ledger ID
     * - Credit line: Supplier's ledger account (payable)
     */
    static async processBillEntryPosting(billId, billNumber, supplierId, details, supplierLedgerId, userId) {
        try {
            const { BillEntry } = require('../models');

            // Get bill entry with details
            const billEntry = await BillEntry.findByPk(billId, {
                include: [{
                    model: require('../models/billEntryDetail'),
                    as: 'Details'
                }]
            });

            if (!billEntry) {
                throw new Error(`Bill Entry ${billId} not found`);
            }

            // Use provided details or fetch from bill entry
            const billDetails = details || billEntry.Details;

            if (!billDetails || billDetails.length === 0) {
                throw new Error('Bill Entry must have at least one detail line');
            }

            // Find tax account if bill has tax
            let taxAccount = null;
            const totalTaxAmount = parseFloat(billEntry.taxAmount) || 0;

            if (totalTaxAmount > 0) {
                taxAccount = await LedgerAccount.findOne({
                    where: {
                        [Op.or]: [
                            { name: { [Op.like]: '%Tax Receivable%' } },
                            { name: { [Op.like]: '%Input Tax%' } },
                            { name: { [Op.like]: '%Input VAT%' } },
                            { name: { [Op.like]: '%Tax Recoverable%' } },
                            { name: { [Op.like]: '%VAT%' } },
                            { ledgerCode: { [Op.like]: '%TAX%' } },
                            { ledgerCode: { [Op.like]: '%VAT%' } }
                        ]
                    }
                });
            }

            // Calculate total debit/credit amount
            const totalEntryAmount = parseFloat(billEntry.totalAmount) || 0;

            const journalNumber = await this.generateJournalNumber();

            // Create journal entry
            const journalEntry = await JournalEntry.create({
                journalNumber,
                journalDate: new Date(),
                description: `Bill Entry - ${billNumber} from Supplier #${supplierId}`,
                referenceModule: 'BILL_ENTRY',
                referenceId: billId,
                referenceNumber: billNumber,
                totalDebit: totalEntryAmount,
                totalCredit: totalEntryAmount,
                status: 'Posted',
                isAutoPosted: true,
                approvalStatus: 'Approved',
                approvedAt: new Date(),
                approvedBy: userId,
                postedAt: new Date(),
                postedBy: userId,
                createdBy: userId
            });

            let lineNumber = 1;

            // Create debit lines from bill entry details
            for (const detail of billDetails) {
                // If tax account is found, we subtract tax from detail line to post it separately
                const detailAmount = (taxAccount && totalTaxAmount > 0)
                    ? parseFloat(detail.amount)
                    : (parseFloat(detail.totalAmount) || parseFloat(detail.amount) || 0);

                await JournalEntryLine.create({
                    journalEntryId: journalEntry.id,
                    ledgerAccountId: detail.ledgerId,
                    debitAmount: detailAmount,
                    creditAmount: 0,
                    description: detail.description || `Bill Entry line - ${billNumber}`,
                    lineNumber: lineNumber++,
                    createdBy: userId
                });
            }

            // Add separate tax journal line if applicable
            if (totalTaxAmount > 0 && taxAccount) {
                await JournalEntryLine.create({
                    journalEntryId: journalEntry.id,
                    ledgerAccountId: taxAccount.id,
                    debitAmount: totalTaxAmount,
                    creditAmount: 0,
                    description: `Purchase Tax Input - ${billNumber}`,
                    lineNumber: lineNumber++,
                    createdBy: userId
                });
            }

            // Create credit line for supplier payable
            if (!supplierLedgerId) {
                // Fallback: Try to find supplier control account
                const supplierControlAccount = await LedgerAccount.findOne({
                    where: {
                        [Op.or]: [
                            { ledgerCode: { [Op.like]: '%SUPPLIER%' } },
                            { ledgerCode: { [Op.like]: '%PAYABLE%' } },
                            { name: { [Op.like]: '%Supplier%' } },
                            { name: { [Op.like]: '%Payable%' } }
                        ]
                    }
                });

                if (supplierControlAccount) {
                    supplierLedgerId = supplierControlAccount.id;
                } else {
                    throw new Error('Supplier ledger account not found. Please provide supplierLedgerId or create a supplier payable account.');
                }
            }

            await JournalEntryLine.create({
                journalEntryId: journalEntry.id,
                ledgerAccountId: supplierLedgerId,
                debitAmount: 0,
                creditAmount: totalEntryAmount,
                description: `Supplier Payable - ${billNumber}`,
                lineNumber: lineNumber,
                createdBy: userId
            });

            return journalEntry;
        } catch (error) {
            console.error('Error in processBillEntryPosting:', error);
            throw error;
        }
    }

    /**
     * Process Bill Payment Posting
     * Creates journal entry:
     * - Debit: Supplier Control Account (reduces payable)
     * - Credit: Bank/Cash Account from payment method (reduces cash)
     */
    static async processBillPaymentPosting(paymentId, paymentNumber, supplierId, amount, userId) {
        try {
            const { BillPayment, Supplier, LedgerAccount, BillPaymentDetail, BillPaymentEntry } = require('../models');

            // Get bill payment with supplier, details and entries (for tax)
            const billPayment = await BillPayment.findByPk(paymentId, {
                include: [
                    {
                        model: Supplier,
                        as: 'Supplier'
                    },
                    {
                        model: BillPaymentDetail,
                        as: 'Details'
                    },
                    {
                        model: BillPaymentEntry,
                        as: 'Entries'
                    }
                ]
            });

            if (!billPayment) {
                throw new Error(`Bill Payment ${paymentId} not found`);
            }

            // Get supplier's ledger account
            let supplierLedgerId = null;
            if (billPayment.Supplier && billPayment.Supplier.ledgerAccountId) {
                supplierLedgerId = billPayment.Supplier.ledgerAccountId;
            } else {
                // Fallback: Find supplier control account
                const supplierControlAccount = await LedgerAccount.findOne({
                    where: {
                        [Op.or]: [
                            { ledgerCode: { [Op.like]: '%SUPPLIER%' } },
                            { ledgerCode: { [Op.like]: '%PAYABLE%' } },
                            { ledgerCode: { [Op.like]: '%AP%' } },
                            { name: { [Op.like]: '%Supplier%' } },
                            { name: { [Op.like]: '%Payable%' } },
                            { name: { [Op.like]: '%Accounts Payable%' } }
                        ]
                    }
                });

                if (supplierControlAccount) {
                    supplierLedgerId = supplierControlAccount.id;
                } else {
                    throw new Error('Supplier ledger account not found. Please configure supplier ledger account.');
                }
            }

            // Find tax account if applicable
            const totalTaxAmount = billPayment.Entries ? billPayment.Entries.reduce((sum, entry) => sum + parseFloat(entry.taxAmount || 0), 0) : 0;
            let taxAccount = null;

            if (totalTaxAmount > 0) {
                taxAccount = await LedgerAccount.findOne({
                    where: {
                        [Op.or]: [
                            { name: { [Op.like]: '%Tax Payable%' } },
                            { name: { [Op.like]: '%WHT%' } },
                            { name: { [Op.like]: '%Withholding%' } },
                            { name: { [Op.like]: '%VAT%' } },
                            { ledgerCode: { [Op.like]: '%TAX%' } },
                            { ledgerCode: { [Op.like]: '%WHT%' } }
                        ]
                    }
                });
            }

            const journalNumber = await this.generateJournalNumber();
            const totalAmount = parseFloat(amount);

            // Create journal entry
            const journalEntry = await JournalEntry.create({
                journalNumber,
                journalDate: new Date(),
                description: `Bill Payment - ${paymentNumber} to Supplier #${supplierId}`,
                referenceModule: 'BILL_PAYMENT',
                referenceId: paymentId,
                referenceNumber: paymentNumber,
                totalDebit: totalAmount,
                totalCredit: totalAmount,
                status: 'Posted',
                isAutoPosted: true,
                approvalStatus: 'Approved',
                approvedAt: new Date(),
                approvedBy: userId,
                postedAt: new Date(),
                postedBy: userId,
                createdBy: userId
            });

            let lineNumber = 1;

            // Create debit line - Supplier Control Account (reduces payable)
            await JournalEntryLine.create({
                journalEntryId: journalEntry.id,
                ledgerAccountId: supplierLedgerId,
                debitAmount: totalAmount,
                creditAmount: 0,
                description: `Supplier Payable cleared - ${paymentNumber}`,
                lineNumber: lineNumber++,
                createdBy: userId
            });

            // Create credit lines for each payment detail (Bank/Cash Accounts)
            if (billPayment.Details && billPayment.Details.length > 0) {
                for (const detail of billPayment.Details) {
                    const detailAmount = parseFloat(detail.amount);
                    if (detailAmount <= 0) continue;

                    await JournalEntryLine.create({
                        journalEntryId: journalEntry.id,
                        ledgerAccountId: detail.ledgerAccountId,
                        debitAmount: 0,
                        creditAmount: detailAmount,
                        description: `Payment via detail line - ${paymentNumber}`,
                        lineNumber: lineNumber++,
                        createdBy: userId
                    });
                }
            }

            // Create credit line for tax if applicable
            if (totalTaxAmount > 0 && taxAccount) {
                await JournalEntryLine.create({
                    journalEntryId: journalEntry.id,
                    ledgerAccountId: taxAccount.id,
                    debitAmount: 0,
                    creditAmount: totalTaxAmount,
                    description: `Tax Deduction - ${paymentNumber}`,
                    lineNumber: lineNumber++,
                    createdBy: userId
                });
            } else {
                // Fallback: If no details, try to find a default cash/bank account (though this shouldn't happen with the new structure)
                const cashAccount = await LedgerAccount.findOne({
                    where: {
                        [Op.or]: [
                            { ledgerCode: { [Op.like]: '%CASH%' } },
                            { ledgerCode: { [Op.like]: '%BANK%' } },
                            { name: { [Op.like]: '%Cash%' } },
                            { name: { [Op.like]: '%Bank%' } }
                        ]
                    }
                });

                if (cashAccount) {
                    await JournalEntryLine.create({
                        journalEntryId: journalEntry.id,
                        ledgerAccountId: cashAccount.id,
                        debitAmount: 0,
                        creditAmount: totalAmount,
                        description: `Default Cash/Bank payment - ${paymentNumber}`,
                        lineNumber: lineNumber++,
                        createdBy: userId
                    });
                } else {
                    throw new Error('No payment details found and no default Bank/Cash ledger account configured.');
                }
            }

            return journalEntry;
        } catch (error) {
            console.error('Error in processBillPaymentPosting:', error);
            throw error;
        }
    }

    /**
     * Process One-Payment Posting
     */
    static async processOnePaymentPosting(paymentId, paymentNumber, supplierId, totalAmount, allocatedAmount, userId, bankAccountId = null) {
        try {
            const journalNumber = await this.generateJournalNumber();
            const unallocatedAmount = totalAmount - allocatedAmount;

            const journalEntry = await JournalEntry.create({
                journalNumber,
                journalDate: new Date(),
                description: `One-Payment - ${paymentNumber} to Supplier #${supplierId}`,
                referenceModule: 'PAYMENT',
                referenceId: paymentId,
                referenceNumber: paymentNumber,
                totalDebit: totalAmount,
                totalCredit: totalAmount,
                status: 'Posted',
                isAutoPosted: true,
                approvalStatus: 'Approved',
                approvedAt: new Date(),
                approvedBy: userId,
                postedAt: new Date(),
                postedBy: userId,
                createdBy: userId
            });

            let lineNumber = 1;

            // If there's allocated amount, create allocation entry
            if (allocatedAmount > 0) {
                let allocatedLedgerId = null;

                const rules = await this.getApplicableRules('BILL_PAYMENT', 'PAY');
                if (rules && rules.length > 0) {
                    allocatedLedgerId = rules[0].debitLedgerId;
                } else {
                    // Fallback: Get Supplier Control Account
                    const supplierControlAcct = await LedgerAccount.findOne({
                        where: { ledgerCode: ['AP', 'SUP_PAY', 'SUPP_CTL'].filter(code => code) },
                        order: [['ledgerCode', 'ASC']]
                    });
                    if (supplierControlAcct) {
                        allocatedLedgerId = supplierControlAcct.id;
                    }
                }

                if (allocatedLedgerId) {
                    await JournalEntryLine.create({
                        journalEntryId: journalEntry.id,
                        ledgerAccountId: allocatedLedgerId,
                        debitAmount: allocatedAmount,
                        creditAmount: 0,
                        description: `Supplier Payable - allocated ${paymentNumber}`,
                        lineNumber,
                        createdBy: userId
                    });
                    lineNumber++;
                }
            }

            // If there's unallocated amount, create advance entry
            if (unallocatedAmount > 0) {
                let unallocatedLedgerId = null;

                const rules = await this.getApplicableRules('ONE_PAYMENT_ADV', 'CREATE');
                if (rules && rules.length > 0) {
                    unallocatedLedgerId = rules[0].debitLedgerId;
                } else {
                    // Fallback: Get Advance Payment/Expense Account
                    const advanceAcct = await LedgerAccount.findOne({
                        where: {
                            ledgerCode: { [Op.in]: ['ADV_PAY', 'ADVANCE', 'EXP', 'EXPENSE'] }
                        },
                        order: [['ledgerCode', 'ASC']]
                    });
                    if (advanceAcct) {
                        unallocatedLedgerId = advanceAcct.id;
                    }
                }

                if (unallocatedLedgerId) {
                    await JournalEntryLine.create({
                        journalEntryId: journalEntry.id,
                        ledgerAccountId: unallocatedLedgerId,
                        debitAmount: unallocatedAmount,
                        creditAmount: 0,
                        description: `Advance payment - ${paymentNumber}`,
                        lineNumber,
                        createdBy: userId
                    });
                    lineNumber++;
                }
            }

            // Credit: Bank/Cash (always at the end)
            let bankLedgerId = null;

            const bankRules = await this.getApplicableRules('ONE_PAYMENT_ADV', 'PAY');
            if (bankRules && bankRules.length > 0) {
                bankLedgerId = bankRules[0].creditLedgerId;
            } else if (bankAccountId) {
                // Fallback: Get bank account's associated ledger
                const bankAccount = await LedgerAccount.findByPk(bankAccountId);
                if (bankAccount) {
                    bankLedgerId = bankAccount.id;
                } else {
                    // Get default bank account
                    const defBankAcct = await LedgerAccount.findOne({
                        where: {
                            ledgerCode: { [Op.in]: ['BANK', 'CASH', 'BANK_ACC'] }
                        },
                        order: [['ledgerCode', 'ASC']]
                    });
                    if (defBankAcct) {
                        bankLedgerId = defBankAcct.id;
                    }
                }
            } else {
                // Fallback: Get any bank/cash account
                const bankAcct = await LedgerAccount.findOne({
                    where: {
                        ledgerCode: { [Op.in]: ['BANK', 'CASH', 'BANK_ACC'] }
                    },
                    order: [['ledgerCode', 'ASC']]
                });
                if (bankAcct) {
                    bankLedgerId = bankAcct.id;
                }
            }

            if (bankLedgerId) {
                await JournalEntryLine.create({
                    journalEntryId: journalEntry.id,
                    ledgerAccountId: bankLedgerId,
                    debitAmount: 0,
                    creditAmount: totalAmount,
                    description: `Bank payment - ${paymentNumber}`,
                    lineNumber,
                    createdBy: userId
                });
            }

            return journalEntry;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Process Funds Transfer Posting
     */
    static async processFundsTransferPosting(transferId, transferNumber, sourceBankAccountId, destinationBankAccountId, amount, userId) {
        try {
            const journalNumber = await this.generateJournalNumber();

            const journalEntry = await JournalEntry.create({
                journalNumber,
                journalDate: new Date(),
                description: `Funds Transfer - ${transferNumber} between bank accounts`,
                referenceModule: 'FUNDS_TRANSFER',
                referenceId: transferId,
                referenceNumber: transferNumber,
                totalDebit: amount,
                totalCredit: amount,
                status: 'Posted',
                isAutoPosted: true,
                approvalStatus: 'Approved',
                approvedAt: new Date(),
                approvedBy: userId,
                postedAt: new Date(),
                postedBy: userId,
                createdBy: userId
            });

            // Get bank account ledgers
            const sourceAccount = await LedgerAccount.findByPk(sourceBankAccountId);
            const destAccount = await LedgerAccount.findByPk(destinationBankAccountId);

            if (!sourceAccount || !destAccount) {
                throw new Error('Bank account ledger not found');
            }

            // Create debit line (Destination Bank)
            await JournalEntryLine.create({
                journalEntryId: journalEntry.id,
                ledgerAccountId: destinationBankAccountId,
                debitAmount: amount,
                creditAmount: 0,
                description: `Transfer in - ${transferNumber}`,
                lineNumber: 1,
                createdBy: userId
            });

            // Create credit line (Source Bank)
            await JournalEntryLine.create({
                journalEntryId: journalEntry.id,
                ledgerAccountId: sourceBankAccountId,
                debitAmount: 0,
                creditAmount: amount,
                description: `Transfer out - ${transferNumber}`,
                lineNumber: 2,
                createdBy: userId
            });

            return journalEntry;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Reverse Journal Entry
     */
    static async reverseJournalEntry(journalEntryId, reversalReason, userId) {
        try {
            const originalJournal = await JournalEntry.findByPk(journalEntryId, {
                include: [{ model: JournalEntryLine, as: 'Lines' }]
            });

            if (!originalJournal) {
                throw new Error('Original journal entry not found');
            }

            // Create reversing journal
            const journalNumber = await this.generateJournalNumber();
            const reversalJournal = await JournalEntry.create({
                journalNumber,
                journalDate: new Date(),
                description: `Reversal of ${originalJournal.journalNumber} - ${reversalReason}`,
                referenceModule: originalJournal.referenceModule,
                referenceId: originalJournal.referenceId,
                referenceNumber: originalJournal.referenceNumber,
                totalDebit: originalJournal.totalCredit,
                totalCredit: originalJournal.totalDebit,
                status: 'Posted',
                isAutoPosted: true,
                approvalStatus: 'Approved',
                approvedAt: new Date(),
                approvedBy: userId,
                postedAt: new Date(),
                postedBy: userId,
                createdBy: userId
            });

            // Create reversed lines
            let lineNumber = 1;
            for (const line of originalJournal.Lines) {
                await JournalEntryLine.create({
                    journalEntryId: reversalJournal.id,
                    ledgerAccountId: line.ledgerAccountId,
                    debitAmount: line.creditAmount,
                    creditAmount: line.debitAmount,
                    description: `Reversal - ${line.description}`,
                    lineNumber,
                    createdBy: userId
                });
                lineNumber++;
            }

            return reversalJournal;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Auto-approve and post journal entries
     */
    static async autoApproveAndPostJournal(journalEntryId, userId) {
        try {
            const journalEntry = await JournalEntry.findByPk(journalEntryId);
            if (!journalEntry) return null;

            await journalEntry.update({
                status: 'Posted',
                approvalStatus: 'Approved',
                approvedAt: new Date(),
                approvedBy: userId,
                postedAt: new Date(),
                postedBy: userId
            });

            return journalEntry;
        } catch (error) {
            throw error;
        }
    }
}

module.exports = AutoPostingService;
