const Receipt = require('../models/receipt');
const ReceiptPayment = require('../models/receiptPayment');
const ReceiptInvoice = require('../models/receiptInvoice');
const PaymentType = require('../models/paymentType');
const Customer = require('../models/customer');
const User = require('../models/user');
const Invoice = require('../models/invoice');
const CustomerReturn = require('../models/customerReturn');
const CreditNote = require('../models/creditNote');
const { sequelize, JournalEntry, JournalEntryLine, LedgerAccount, ControlAccount, ReceiptCreditNote, ReceiptSettledCheque } = require('../models');
const { Op } = require('sequelize');
const { generateDocumentNumber } = require('./documentControllerClient');
const TransactionService = require('../utils/transactionService');

// Create a new receipt
exports.createReceipt = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const {
            receiptNo,
            receiptDate,
            userId,
            customerId,
            totalPaid,
            locationId,
            remarks,
            printedCount,
            receiptPayments,
            receiptInvoices,
            customerReturnSetOffs,
            totalReturnAmount,
            creditNoteSetOffs,
            totalCreditNoteAmount,
            returnedChequeSettlements
        } = req.body;
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }
        if ((!Array.isArray(receiptPayments) || receiptPayments.length === 0) &&
            (!Array.isArray(customerReturnSetOffs) || customerReturnSetOffs.length === 0) &&
            (!Array.isArray(creditNoteSetOffs) || creditNoteSetOffs.length === 0)) {
            throw new Error('Receipt must have at least one payment entry, return set-off, or credit note set-off');
        }
        if (!Array.isArray(receiptInvoices) || receiptInvoices.length === 0) {
            if (!Array.isArray(returnedChequeSettlements) || returnedChequeSettlements.length === 0) {
                throw new Error('Receipt must have at least one invoice or returned cheque settlement');
            }
        }

        // Calculate totals from invoices
        let totalAmount = 0;
        let totalBalance = 0;

        for (const inv of (receiptInvoices || [])) {
            totalAmount += parseFloat(inv.invoiceAmount) || 0;
            totalBalance += parseFloat(inv.balanceAmount) || 0;
        }

        let totalChequeSettlement = 0;
        if (Array.isArray(returnedChequeSettlements)) {
            for (const chq of returnedChequeSettlements) {
                totalChequeSettlement += parseFloat(chq.amount) || 0;
            }
        }

        totalAmount += totalChequeSettlement;
        // Generate receipt number if not provided
        let receiptNumber = await generateDocumentNumber('RE', locationId);

        const receipt = await Receipt.create({
            receiptNo: receiptNumber,
            receiptDate,
            userId,
            customerId,
            totalAmount,
            totalPaid,
            totalBalance,
            totalReturnAmount,
            totalCreditNoteAmount,
            remarks,
            printedCount,
            locationId,
            // status: 'Posted', // Set status to Posted immediately
            createdBy: currentUserId,
            updatedBy: currentUserId
        }, { transaction: t });

        // Create receipt invoice relationships
        console.log(`Creating receipt invoices for ${receiptInvoices.length} invoices:`, JSON.stringify(receiptInvoices, null, 2));

        for (const invoiceData of (receiptInvoices || [])) {
            console.log(`Processing invoice ${invoiceData.invoiceId}:`, invoiceData);

            const receiptInvoiceRecord = await ReceiptInvoice.create({
                receiptId: receipt.id,
                invoiceId: invoiceData.invoiceId,
                invoiceAmount: invoiceData.invoiceAmount,
                paidAmount: invoiceData.paidAmount,
                balanceAmount: invoiceData.balanceAmount,
            }, { transaction: t });

            console.log(`Created ReceiptInvoice record:`, receiptInvoiceRecord.toJSON());

            let invoice = await Invoice.findByPk(invoiceData.invoiceId, { transaction: t });
            if (invoice) {
                const currentPaidAmount = parseFloat(invoice.paidAmount) || 0;
                const currentSetoffAmount = parseFloat(invoice.setoffAmount) || 0;
                const addingPaidAmount = parseFloat(invoiceData.paidAmount) || 0;
                console.log(`Updating invoice ${invoiceData.invoiceId}, current paidAmount: ${currentPaidAmount}, adding: ${addingPaidAmount}`);

                const totalSettlement = (parseFloat(totalPaid) || 0) + (parseFloat(totalReturnAmount) || 0) + (parseFloat(totalCreditNoteAmount) || 0);

                let paidPortion = 0;
                let setoffPortion = 0;

                if (totalSettlement > 0) {
                    const paidRatio = (parseFloat(totalPaid) || 0) / totalSettlement;
                    paidPortion = addingPaidAmount * paidRatio;
                    setoffPortion = addingPaidAmount - paidPortion; // Ensure it adds up exactly
                }

                await invoice.update({
                    paidAmount: currentPaidAmount + paidPortion,
                    setoffAmount: currentSetoffAmount + setoffPortion,
                }, { transaction: t });

                console.log(`Updated invoice ${invoiceData.invoiceId}, new total applied: ${currentPaidAmount + currentSetoffAmount + addingPaidAmount}`);
            } else {
                throw new Error(`Invoice with ID ${invoiceData.invoiceId} not found`);
            }
        }

        console.log(`Finished creating ${(receiptInvoices || []).length} receipt invoice records`);

        // Create receipt payments
        for (const payment of receiptPayments) {
            await ReceiptPayment.create({
                receiptId: receipt.id,
                paymentTypeId: payment.paymentTypeId,
                paymentAmount: payment.paymentAmount,
                ledgerAccountId: payment.ledgerAccountId,
                referenceNo: payment.referenceNo,
                bankId: payment.bankId,
                bankBranchId: payment.bankBranchId,
                cardType: payment.cardType,
                chequeNo: payment.chequeNo,
                chequeDate: payment.chequeDate,
            }, { transaction: t });
        }

        // Handle Customer Return set-offs
        if (Array.isArray(customerReturnSetOffs) && customerReturnSetOffs.length > 0) {
            for (const setOff of customerReturnSetOffs) {
                const ret = await CustomerReturn.findByPk(setOff.id, { transaction: t });
                if (ret) {
                    const newUtilizedAmount = parseFloat(ret.utilizedAmount || 0) + parseFloat(setOff.amount);
                    const isFullyUtilized = newUtilizedAmount >= parseFloat(ret.totalAmount);

                    await ret.update({
                        utilizedAmount: newUtilizedAmount,
                        status: isFullyUtilized ? 'Completed' : ret.status,
                        refundStatus: isFullyUtilized ? 'Completed' : ret.refundStatus,
                        notes: (ret.notes || '') + `\n- Set-off ${setOff.amount} in Receipt ${receipt.receiptNo}`
                    }, { transaction: t });
                }
            }
        }

        // Handle Returned Cheque Settlements
        if (Array.isArray(returnedChequeSettlements) && returnedChequeSettlements.length > 0) {
            for (const settlement of returnedChequeSettlements) {
                const retCheque = await ReceiptPayment.findByPk(settlement.id, { transaction: t });
                if (retCheque) {
                    const newSettledAmount = parseFloat(retCheque.settledAmount || 0) + parseFloat(settlement.amount);

                    await retCheque.update({
                        settledAmount: newSettledAmount
                    }, { transaction: t });

                    // Log the set-off in ReceiptSettledCheque table
                    await ReceiptSettledCheque.create({
                        receiptId: receipt.id,
                        receiptPaymentId: retCheque.id,
                        amount: settlement.amount
                    }, { transaction: t });
                }
            }
        }

        // Handle Credit Note set-offs
        if (Array.isArray(creditNoteSetOffs) && creditNoteSetOffs.length > 0) {
            for (const setOff of creditNoteSetOffs) {
                const cn = await CreditNote.findByPk(setOff.id, { transaction: t });
                if (cn) {
                    const newAppliedAmount = parseFloat(cn.appliedAmount || 0) + parseFloat(setOff.amount);
                    const isFullyApplied = newAppliedAmount >= parseFloat(cn.total);

                    await cn.update({
                        appliedAmount: newAppliedAmount,
                        status: isFullyApplied ? 'Applied' : cn.status,
                        notes: (cn.notes || '') + `\n- Set-off ${setOff.amount} in Receipt ${receipt.receiptNo}`
                    }, { transaction: t });

                    // Log the set-off in ReceiptCreditNote table
                    await ReceiptCreditNote.create({
                        receiptId: receipt.id,
                        creditNoteId: cn.id,
                        amount: setOff.amount
                    }, { transaction: t });
                }
            }
        }

        // Fetch customer receivable account OUTSIDE transaction to avoid lock timeout
        // Fetch customer ledger account
        const customer = await Customer.findByPk(customerId, {
            include: [{ model: LedgerAccount, as: 'LedgerAccount' }],
            transaction: t
        });

        let customerAccount = customer?.LedgerAccount;

        // If customer doesn't have a ledger account, create one
        if (!customerAccount && customer) {
            const controlAccount = await ControlAccount.findOne({
                where: { controlType: 'CUSTOMER', status: 'Active' },
                transaction: t
            });

            if (controlAccount) {
                const prefixCode = controlAccount.code;
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

                customerAccount = await LedgerAccount.create({
                    ledgerCode,
                    name: `Customer - ${customer.name}`,
                    description: `Auto-generated ledger for customer ${customer.name}`,
                    accountTypeId: controlAccount.accountTypeId,
                    accountCategoryId: controlAccount.accountCategoryId,
                    isUseControlAccount: true,
                    controlAccountId: controlAccount.id,
                    ledgerType: 'GENERAL',
                    createdBy: currentUserId
                }, { transaction: t });

                // Update customer with new ledger account
                await customer.update({ ledgerAccountId: customerAccount.id }, { transaction: t });
            }
        }

        if (!customerAccount) {
            customerAccount = await LedgerAccount.findOne({
                where: { accountType: { [Op.like]: '%Asset%' } }
            });
        }

        // Prepare transaction details for logging (no journal entry)
        // Use ledgerAccountId from each ReceiptPayment for accurate account mapping
        const transactionDetails = [];

        if (customerAccount && totalPaid > 0) { // Added totalPaid > 0 condition
            let lineNumber = 1;

            // DR: Create separate debit entries for each payment method using their specific ledger accounts
            for (const payment of receiptPayments) {
                if (payment.ledgerAccountId && payment.paymentAmount > 0) {
                    // Fetch ledger account details for description
                    const ledgerAccount = await LedgerAccount.findByPk(payment.ledgerAccountId);
                    const accountName = ledgerAccount ? ledgerAccount.accountName : 'Payment Account';

                    transactionDetails.push({
                        ledgerAccountId: payment.ledgerAccountId,
                        debitAmount: payment.paymentAmount,
                        creditAmount: 0,
                        description: `DR: ${accountName} - Receipt ${receipt.receiptNo}${payment.referenceNo ? ' - Ref: ' + payment.referenceNo : ''}`,
                        lineNumber: lineNumber++
                    });
                }
            }

            // DR: Debit Sales Return Account for Customer Returns
            if (receipt.totalReturnAmount > 0) {
                let salesReturnAccount = await LedgerAccount.findOne({
                    where: {
                        [Op.or]: [
                            { name: { [Op.like]: '%Sales Return%' } },
                            { name: { [Op.like]: '%Return%' } },
                            { ledgerCode: { [Op.like]: '%SR%' } }
                        ]
                    }
                });

                if (salesReturnAccount) {
                    transactionDetails.push({
                        ledgerAccountId: salesReturnAccount.id,
                        debitAmount: receipt.totalReturnAmount,
                        creditAmount: 0,
                        description: `DR: Sales Return Set-off - Receipt ${receipt.receiptNo}`,
                        lineNumber: lineNumber++
                    });
                }
            }

            // DR: Debit Credit Notes/Allowance Account for Credit Notes
            if (receipt.totalCreditNoteAmount > 0) {
                let creditNoteAccount = await LedgerAccount.findOne({
                    where: {
                        [Op.or]: [
                            { name: { [Op.like]: '%Credit Note%' } },
                            { name: { [Op.like]: '%Allowance%' } },
                            { ledgerCode: { [Op.like]: '%CN%' } }
                        ]
                    }
                });

                // Fallback to Sales Return if not found
                if (!creditNoteAccount) {
                    creditNoteAccount = await LedgerAccount.findOne({
                        where: { name: { [Op.like]: '%Return%' } }
                    });
                }

                if (creditNoteAccount) {
                    transactionDetails.push({
                        ledgerAccountId: creditNoteAccount.id,
                        debitAmount: receipt.totalCreditNoteAmount,
                        creditAmount: 0,
                        description: `DR: Credit Note Set-off - Receipt ${receipt.receiptNo}`,
                        lineNumber: lineNumber++
                    });
                }
            }

            // CR: Customer Receivable Account (reduces AR) - single credit entry for total (paid + returns + credit notes)
            const totalCreditToAR = parseFloat(receipt.totalPaid || 0) + parseFloat(receipt.totalReturnAmount || 0) + parseFloat(receipt.totalCreditNoteAmount || 0);
            transactionDetails.push({
                ledgerAccountId: customerAccount.id,
                debitAmount: 0,
                creditAmount: totalCreditToAR,
                description: `CR: ${customerAccount.accountName || 'Customer Receivable'} - Receipt ${receipt.receiptNo}`,
                lineNumber: lineNumber
            });
        }

        // Commit transaction BEFORE logging to transaction tables
        await t.commit();

        // Log to transaction tables AFTER commit (no journal entry)
        if (transactionDetails.length > 0) {
            try {
                console.log('Logging receipt transaction with:', {
                    receiptId: receipt.id,
                    receiptNo: receipt.receiptNo,
                    transactionDetails: transactionDetails.length,
                    userId: currentUserId
                });

                await TransactionService.logReceiptTransaction(receipt, transactionDetails, currentUserId);

                console.log('Transaction logged for receipt:', receipt.receiptNo);
            } catch (logError) {
                console.error('Transaction logging error:', logError.message);
                console.error('Stack trace:', logError.stack);
                // Don't fail the whole process if logging fails
            }
        }

        const result = await Receipt.findByPk(receipt.id, {
            include: [
                { model: Customer },
                {
                    model: ReceiptInvoice,
                    as: 'invoices',
                    include: [{ model: Invoice, as: 'invoice' }]
                },
                {
                    model: ReceiptPayment,
                    as: 'payments',
                    include: [
                        { model: PaymentType },
                        { model: LedgerAccount, as: 'ledgerAccount' }
                    ]
                },
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] },
                {
                    model: ReceiptCreditNote,
                    as: 'creditNoteSetOffs',
                    include: [{ model: CreditNote, as: 'CreditNote' }]
                },
                {
                    model: ReceiptSettledCheque,
                    as: 'settledCheques',
                    include: [{ model: ReceiptPayment, as: 'cheque' }]
                }
            ]
        });
        res.status(201).json(result);
    } catch (error) {
        console.log(error);
        if (!t.finished) {
            await t.rollback();
        }
        res.status(400).json({ error: error.message });
    }
};

// Get all receipts
exports.getReceipts = async (req, res) => {
    try {
        const receipts = await Receipt.findAll({
            include: [
                { model: Customer },
                {
                    model: ReceiptInvoice,
                    as: 'invoices',
                    include: [{ model: Invoice, as: 'invoice' }]
                },
                {
                    model: ReceiptPayment,
                    as: 'payments',
                    include: [
                        { model: PaymentType },
                        { model: LedgerAccount, as: 'ledgerAccount' }
                    ]
                },
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] },
                {
                    model: ReceiptCreditNote,
                    as: 'creditNoteSetOffs',
                    include: [{ model: CreditNote, as: 'CreditNote' }]
                },
                {
                    model: ReceiptSettledCheque,
                    as: 'settledCheques',
                    include: [{ model: ReceiptPayment, as: 'cheque' }]
                }
            ],
            order: [['createdAt', 'DESC']]
        });
        // Format response to include creator/updater usernames
        const result = receipts.map(receipt => {
            const obj = receipt.toJSON();
            obj.createdByUsername = obj.Creator ? obj.Creator.username : null;
            obj.updatedByUsername = obj.Updater ? obj.Updater.username : null;
            delete obj.Creator;
            delete obj.Updater;
            return obj;
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Delete a receipt
exports.deleteReceipt = async (req, res) => {
    try {
        const receipt = await Receipt.findByPk(req.params.id);
        if (!receipt) return res.status(404).json({ error: 'Receipt not found' });
        await receipt.destroy();
        res.json({ message: 'Receipt deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update a receipt
exports.updateReceipt = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const {
            receiptDate,
            customerId,
            totalPaid,
            remarks,
            printedCount,
            receiptPayments,
            receiptInvoices,
            totalReturnAmount,
            totalCreditNoteAmount
        } = req.body;
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const receipt = await Receipt.findByPk(id);
        if (!receipt) {
            return res.status(404).json({ error: 'Receipt not found' });
        }

        // Calculate totals from invoices if provided
        let totalAmount = receipt.totalAmount;
        let totalBalance = receipt.totalBalance;

        if (receiptInvoices && Array.isArray(receiptInvoices)) {
            totalAmount = 0;
            totalBalance = 0;
            for (const inv of receiptInvoices) {
                totalAmount += parseFloat(inv.invoiceAmount) || 0;
                totalBalance += parseFloat(inv.balanceAmount) || 0;
            }

            // Delete existing receipt invoices and create new ones
            await ReceiptInvoice.destroy({ where: { receiptId: id }, transaction: t });

            for (const invoiceData of receiptInvoices) {
                await ReceiptInvoice.create({
                    receiptId: receipt.id,
                    invoiceId: invoiceData.invoiceId,
                    invoiceAmount: invoiceData.invoiceAmount,
                    paidAmount: invoiceData.paidAmount,
                    balanceAmount: invoiceData.balanceAmount,
                }, { transaction: t });
            }
        }

        // Update receipt payments if provided
        if (receiptPayments && Array.isArray(receiptPayments) && receiptPayments.length > 0) {
            // Delete existing receipt payments and create new ones
            await ReceiptPayment.destroy({ where: { receiptId: id }, transaction: t });

            for (const payment of receiptPayments) {
                await ReceiptPayment.create({
                    receiptId: receipt.id,
                    paymentTypeId: payment.paymentTypeId,
                    paymentAmount: payment.paymentAmount,
                    ledgerAccountId: payment.ledgerAccountId,
                    referenceNo: payment.referenceNo,
                    bankId: payment.bankId,
                    bankBranchId: payment.bankBranchId,
                    cardType: payment.cardType,
                    chequeNo: payment.chequeNo,
                    chequeDate: payment.chequeDate,
                }, { transaction: t });
            }
        }

        // Update receipt fields
        await receipt.update({
            receiptDate: receiptDate || receipt.receiptDate,
            customerId: customerId || receipt.customerId,
            totalAmount,
            totalPaid: totalPaid || receipt.totalPaid,
            totalReturnAmount: totalReturnAmount !== undefined ? totalReturnAmount : receipt.totalReturnAmount,
            totalCreditNoteAmount: totalCreditNoteAmount !== undefined ? totalCreditNoteAmount : receipt.totalCreditNoteAmount,
            totalBalance,
            remarks: remarks || receipt.remarks,
            printedCount: printedCount || receipt.printedCount,
            updatedBy: currentUserId
        }, { transaction: t });

        await t.commit();

        const result = await Receipt.findByPk(receipt.id, {
            include: [
                { model: Customer },
                {
                    model: ReceiptInvoice,
                    as: 'invoices',
                    include: [{ model: Invoice, as: 'invoice' }]
                },
                {
                    model: ReceiptPayment,
                    as: 'payments',
                    include: [
                        { model: PaymentType },
                        { model: LedgerAccount, as: 'ledgerAccount' }
                    ]
                },
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] },
                {
                    model: ReceiptCreditNote,
                    as: 'creditNoteSetOffs',
                    include: [{ model: CreditNote, as: 'CreditNote' }]
                },
                {
                    model: ReceiptSettledCheque,
                    as: 'settledCheques',
                    include: [{ model: ReceiptPayment, as: 'cheque' }]
                }
            ]
        });
        res.json(result);
    } catch (error) {
        await t.rollback();
        res.status(400).json({ error: error.message });
    }
};

/**
 * Post Receipt - Create GL entries and log transaction
 * GL Pattern:
 * DR: Cash/Bank Account (increases cash/bank)
 * CR: Customer Receivable Account (reduces AR)
 */

// Get receipt by ID
exports.getReceiptById = async (req, res) => {
    try {
        const receipt = await Receipt.findByPk(req.params.id, {
            include: [
                { model: Customer },
                {
                    model: ReceiptInvoice,
                    as: 'invoices',
                    include: [{ model: Invoice, as: 'invoice' }]
                },
                {
                    model: ReceiptPayment,
                    as: 'payments',
                    include: [
                        { model: PaymentType },
                        { model: LedgerAccount, as: 'ledgerAccount' }
                    ]
                },
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] },
                {
                    model: ReceiptCreditNote,
                    as: 'creditNoteSetOffs',
                    include: [{ model: CreditNote, as: 'CreditNote' }]
                },
                {
                    model: ReceiptSettledCheque,
                    as: 'settledCheques',
                    include: [{ model: ReceiptPayment, as: 'cheque' }]
                }
            ]
        });
        if (!receipt) {
            return res.status(404).json({ error: 'Receipt not found' });
        }
        const obj = receipt.toJSON();
        obj.createdByUsername = obj.Creator ? obj.Creator.username : null;
        obj.updatedByUsername = obj.Updater ? obj.Updater.username : null;
        delete obj.Creator;
        delete obj.Updater;
        res.json(obj);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

