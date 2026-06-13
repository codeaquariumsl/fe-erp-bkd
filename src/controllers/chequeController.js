const { ReceiptPayment, Receipt, Customer, Bank, LedgerAccount, TransactionHeader, TransactionDetail, DocumentSequence, ReceiptInvoice, Invoice, BankDeposit, sequelize } = require('../models');
const { Op } = require('sequelize');
const TransactionService = require('../utils/transactionService');

exports.getChequesInHand = async (req, res) => {
    try {
        const ledgerAccount = await LedgerAccount.findOne({
            where: { name: { [Op.like]: '%CHEQUES%IN%HAND%' } }
        });

        if (!ledgerAccount) return res.status(404).json({ message: "CHEQUES IN HAND ledger account not found." });

        const cheques = await ReceiptPayment.findAll({
            where: {
                status: 'RECEIVED',
                isCancelled: false,
                chequeNo: { [Op.ne]: null },
                ledgerAccountId: ledgerAccount.id
            },
            include: [
                {
                    model: Receipt,
                    as: 'receipt',
                    include: [
                        { model: Customer, as: 'Customer', attributes: ['id', 'name'] },
                        { model: ReceiptInvoice, as: 'invoices', include: [{ model: Invoice, as: 'invoice', attributes: ['invoiceNumber'] }] }
                    ]
                },
                { model: Bank, as: 'bank', attributes: ['id', 'name'] }
            ]
        });

        const formattedCheques = cheques.map(c => {
            const invoices = (c.receipt && c.receipt.invoices) ? c.receipt.invoices.map(ri => ri.invoice.invoiceNumber).join(', ') : '';
            return {
                id: c.id,
                chequeNo: c.chequeNo,
                chequeDate: c.chequeDate,
                amount: c.paymentAmount,
                bankName: c.bank ? c.bank.name : '',
                customerName: (c.receipt && c.receipt.Customer) ? c.receipt.Customer.name : '',
                invoices: invoices
            };
        });

        res.status(200).json(formattedCheques);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.cancelCheque = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id, cancelDate, cancelReason } = req.body;
        const cancelledBy = req.user ? req.user.id : null;

        if (!id || !cancelDate || !cancelReason) {
            return res.status(400).json({ message: "ID, cancelDate, and cancelReason are required." });
        }

        const cheque = await ReceiptPayment.findByPk(id, {
            include: [
                { 
                    model: Receipt, 
                    as: 'receipt', 
                    include: [{ model: Customer, as: 'Customer' }] 
                }
            ], 
            transaction: t 
        });

        if (!cheque) throw new Error("Cheque not found");
        if (cheque.isDeposited || cheque.isCancelled) {
            throw new Error(`Cannot cancel a ${cheque.status} cheque`);
        }

        // Use Customer's ledger account or fallback to general AR account
        let debitAccountId = cheque.receipt?.Customer?.ledgerAccountId;
        if (!debitAccountId) {
            const arAccount = await LedgerAccount.findOne({ where: { name: { [Op.like]: '%ACCOUNTS RECEIVABLE%' } }, transaction: t });
            if (!arAccount) throw new Error("Accounts Receivable ledger account not found and customer has no ledger account assigned.");
            debitAccountId = arAccount.id;
        }

        const creditAccount = await LedgerAccount.findByPk(cheque.ledgerAccountId, { transaction: t });
        if (!creditAccount) throw new Error("Credit account not found");

        cheque.status = 'CANCELLED';
        cheque.isCancelled = true;
        cheque.cancelDate = cancelDate;
        cheque.cancelReason = cancelReason;
        cheque.cancelledBy = cancelledBy;
        await cheque.save({ transaction: t });

        const transactionNumber = await TransactionService.generateTransactionNumber();

        const transactionHeader = await TransactionHeader.create({
            transactionNumber,
            transactionDate: cheque.cancelDate,
            transactionModule: 'CHEQUE_CANCEL',
            referenceModule: 'RECEIPT',
            referenceNumber: cheque.chequeNo,
            referenceId: cheque.id,
            description: `Cancellation of Cheque ${cheque.chequeNo} for Receipt ${cheque.receipt ? cheque.receipt.receiptNo : ''}`,
            totalDebit: cheque.paymentAmount,
            totalCredit: cheque.paymentAmount,
            createdBy: cancelledBy
        }, { transaction: t });

        await TransactionDetail.create({
            transactionHeaderId: transactionHeader.id,
            ledgerAccountId: debitAccountId,
            lineNumber: 1,
            debitAmount: cheque.paymentAmount,
            creditAmount: 0,
            description: `Cancel Cheque Debit (Cheque ${cheque.chequeNo})`,
            createdBy: cancelledBy
        }, { transaction: t });

        await TransactionDetail.create({
            transactionHeaderId: transactionHeader.id,
            ledgerAccountId: creditAccount.id,
            lineNumber: 2,
            debitAmount: 0,
            creditAmount: cheque.paymentAmount,
            description: `Cancel Cheque Credit ${creditAccount.name} (Cheque ${cheque.chequeNo})`,
            createdBy: cancelledBy
        }, { transaction: t });

        await t.commit();
        res.status(200).json({
            message: "Cheque cancelled successfully",
            referenceNo: transactionNumber,
            chequeNo: cheque.chequeNo,
            cancelledAmount: cheque.paymentAmount
        });
    } catch (err) {
        await t.rollback();
        res.status(500).json({ message: err.message });
    }
};

exports.getDepositedCheques = async (req, res) => {
    try {
        const cheques = await ReceiptPayment.findAll({
            where: {
                isDeposited: true,
                isCancelled: false,
                isReturned: false,
                chequeNo: { [Op.ne]: null }
            },
            include: [
                {
                    model: Receipt,
                    as: 'receipt',
                    include: [
                        { model: Customer, as: 'Customer', attributes: ['id', 'name'] },
                        { model: ReceiptInvoice, as: 'invoices', include: [{ model: Invoice, as: 'invoice', attributes: ['invoiceNumber'] }] }
                    ]
                },
                { model: Bank, as: 'bank', attributes: ['id', 'name'] }
            ]
        });

        const formattedCheques = cheques.map(c => {
            const invoices = (c.receipt && c.receipt.invoices) ? c.receipt.invoices.map(ri => ri.invoice.invoiceNumber).join(', ') : '';
            return {
                id: c.id,
                chequeNo: c.chequeNo,
                chequeDate: c.chequeDate,
                depositDate: c.updatedAt,
                amount: c.paymentAmount,
                bankName: c.bank ? c.bank.name : '',
                customerName: (c.receipt && c.receipt.Customer) ? c.receipt.Customer.name : '',
                invoices: invoices
            };
        });

        res.status(200).json(formattedCheques);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.returnCheque = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { receiptId, returnDate, reason, bankCharge, penalty } = req.body;
        const returnedBy = req.user ? req.user.id : null;

        if (!receiptId || !returnDate || !reason) {
            return res.status(400).json({ message: "receiptId, returnDate, and reason are required." });
        }

        const cheque = await ReceiptPayment.findByPk(receiptId, {
            include: [
                {
                    model: Receipt,
                    as: 'receipt',
                    include: [
                        { model: Customer, as: 'Customer' },
                        { model: ReceiptInvoice, as: 'invoices', include: [{ model: Invoice, as: 'invoice', attributes: ['invoiceNumber'] }] }
                    ]
                },
                { model: Bank, as: 'bank' },
                { model: BankDeposit, as: 'BankDeposit', include: [{ model: LedgerAccount, as: 'BankAccount' }] }
            ],
            transaction: t
        });

        if (!cheque) throw new Error("Cheque not found");
        if (cheque.isDeposited !== true) {
            throw new Error(`Cannot return a non-deposited cheque. Only deposited cheques can be returned.`);
        }
        if (cheque.isReturned) {
            throw new Error(`Cheque is already returned.`);
        }
        if (cheque.isCancelled) {
            throw new Error(`Cheque is cancelled.`);
        }

        // Use Customer's ledger account or fallback to general AR account
        let debitAccountId = cheque.receipt?.Customer?.ledgerAccountId;
        if (!debitAccountId) {
            const arAccount = await LedgerAccount.findOne({ where: { name: { [Op.like]: '%ACCOUNTS RECEIVABLE%' } }, transaction: t });
            if (!arAccount) throw new Error("Accounts Receivable ledger account not found and customer has no ledger account assigned.");
            debitAccountId = arAccount.id;
        }

        // Use the bank account from the deposit or fallback to the cheque's ledger account
        let creditAccountId = cheque.BankDeposit?.bankAccountId;
        if (!creditAccountId) {
            creditAccountId = cheque.ledgerAccountId;
        }

        if (!creditAccountId) throw new Error("Bank ledger account not found for the cheque or deposit");

        let penaltyIncomeAccount = null;
        if (penalty) {
            penaltyIncomeAccount = await LedgerAccount.findOne({ where: { name: { [Op.like]: '%PENALTY%' } }, transaction: t });
        }

        cheque.status = 'RETURNED';
        cheque.isReturned = true;
        cheque.returnDate = returnDate;
        cheque.returnReason = reason;
        cheque.returnedBy = returnedBy;
        await cheque.save({ transaction: t });

        const transactionNumber = await TransactionService.generateTransactionNumber();

        let chargeAmt = Number(bankCharge) || 0;
        let penaltyAmt = Number(penalty) || 0;
        let originalAmt = Number(cheque.paymentAmount);

        let totalDebitAmt = originalAmt + chargeAmt + penaltyAmt;
        let totalCreditAmt = originalAmt + chargeAmt + penaltyAmt;

        const transactionHeader = await TransactionHeader.create({
            transactionNumber,
            transactionDate: cheque.returnDate,
            transactionModule: 'CHEQUE_RETURN',
            referenceModule: 'RECEIPT',
            referenceNumber: cheque.chequeNo,
            referenceId: cheque.id,
            description: `Return of Cheque ${cheque.chequeNo} for Receipt ${cheque.receipt ? cheque.receipt.receiptNo : ''}`,
            totalDebit: totalDebitAmt,
            totalCredit: totalCreditAmt,
            createdBy: returnedBy
        }, { transaction: t });

        let lineNo = 1;
        // 1. Debit Account (Usually Customer's Ledger Account)
        await TransactionDetail.create({
            transactionHeaderId: transactionHeader.id,
            ledgerAccountId: debitAccountId,
            lineNumber: lineNo++,
            debitAmount: totalDebitAmt,
            creditAmount: 0,
            description: `Return Cheque Debit (Cheque ${cheque.chequeNo})`,
            createdBy: returnedBy
        }, { transaction: t });

        // 2. Credit Bank (From Deposit)
        await TransactionDetail.create({
            transactionHeaderId: transactionHeader.id,
            ledgerAccountId: creditAccountId,
            lineNumber: lineNo++,
            debitAmount: 0,
            creditAmount: originalAmt + chargeAmt,
            description: `Return Cheque Credit (Cheque ${cheque.chequeNo})`,
            createdBy: returnedBy
        }, { transaction: t });

        // Optional Charges
        if (penaltyAmt > 0 && penaltyIncomeAccount) {
            await TransactionDetail.create({
                transactionHeaderId: transactionHeader.id,
                ledgerAccountId: penaltyIncomeAccount.id,
                lineNumber: lineNo++,
                debitAmount: 0,
                creditAmount: penaltyAmt,
                description: `Return Cheque Penalty Credit (Cheque ${cheque.chequeNo})`,
                createdBy: returnedBy
            }, { transaction: t });
        }

        await t.commit();

        const invoices = (cheque.receipt && cheque.receipt.invoices) ? cheque.receipt.invoices.map(ri => ri.invoice.invoiceNumber) : [];

        res.status(200).json({
            message: "Cheque returned successfully",
            referenceNo: transactionNumber,
            customer: cheque.receipt?.Customer?.name || '',
            chequeNo: cheque.chequeNo,
            bank: cheque.bank?.name || '',
            amount: originalAmt,
            charges: chargeAmt,
            invoices: invoices
        });
    } catch (err) {
        await t.rollback();
        res.status(500).json({ message: err.message });
    }
};

exports.getCustomerChequesForSettlement = async (req, res) => {
    try {
        const { customerId } = req.params;
        if (!customerId) return res.status(400).json({ message: "customerId is required" });

        const cheques = await ReceiptPayment.findAll({
            where: {
                status: {
                    [Op.in]: ['RETURNED', 'CANCELLED']
                },
                paymentAmount: {
                    [Op.gt]: sequelize.col('settledAmount')
                }
            },
            include: [
                {
                    model: Receipt,
                    as: 'receipt',
                    where: { customerId },
                    required: true,
                    include: [
                        { model: Customer, as: 'Customer', attributes: ['name'] }
                    ]
                },
                { model: Bank, as: 'bank', attributes: ['name'] }
            ]
        });

        const formattedCheques = cheques.map(c => {
            const amount = Number(c.paymentAmount) || 0;
            const settled = Number(c.settledAmount) || 0;
            return {
                id: c.id,
                chequeNo: c.chequeNo,
                chequeDate: c.chequeDate,
                returnDate: c.returnDate || c.cancelDate,
                amount: amount,
                settledAmount: settled,
                outstandingAmount: amount - settled,
                bankName: c.bank ? c.bank.name : '',
                status: c.status
            };
        });

        res.status(200).json(formattedCheques);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
