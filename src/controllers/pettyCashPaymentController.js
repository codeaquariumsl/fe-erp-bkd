const { PettyCashBook, PettyCashCategory, LedgerAccount, DocumentSequence, sequelize } = require('../models');
const PettyCashPayment = require('../models/pettyCashPayment');
const PettyCashPaymentLine = require('../models/pettyCashPaymentLine');
const TransactionService = require('../utils/transactionService');

exports.createPayment = async (req, res) => {
    let transaction;
    try {
        transaction = await sequelize.transaction();
        const { paymentDate, pettyCashBookId, description, lines, locationId } = req.body;

        // Generate payment number
        let sequence = await DocumentSequence.findOne({
            where: { documentType: 'PCP' },
            lock: transaction.LOCK.UPDATE,
            transaction
        });

        if (!sequence) {
            sequence = await DocumentSequence.create({
                documentType: 'PCP',
                prefix: 'PCP',
                currentNumber: 0,
                numberLength: 5,
                locationId,
            }, { transaction });
        }

        sequence.currentNumber += 1;
        await sequence.save({ transaction });
        const numberStr = String(sequence.currentNumber).padStart(sequence.numberLength, '0');
        const paymentNumber = `${sequence.prefix}-${numberStr}`;

        // Calculate total amount
        const totalAmount = lines.reduce((sum, line) => sum + parseFloat(line.amount), 0);

        const payment = await PettyCashPayment.create({
            paymentNumber,
            paymentDate,
            pettyCashBookId,
            totalAmount,
            description,
            status: 'Draft',
            locationId,
            createdBy: req.user.id
        }, { transaction });

        const linesToCreate = lines.map((line, index) => ({
            pettyCashPaymentId: payment.id,
            lineNumber: index + 1,
            categoryId: line.categoryId,
            ledgerAccountId: line.ledgerAccountId,
            amount: line.amount,
            description: line.description,
            createdBy: req.user.id
        }));

        await PettyCashPaymentLine.bulkCreate(linesToCreate, { transaction });

        await transaction.commit();
        res.status(201).json(payment);
    } catch (error) {
        if (transaction) await transaction.rollback();
        res.status(400).json({ error: error.message });
    }
};

exports.getPayments = async (req, res) => {
    try {
        const payments = await PettyCashPayment.findAll({
            include: [
                { model: PettyCashBook, as: 'PettyCashBook' },
                { model: PettyCashPaymentLine, as: 'Lines' }
            ],
            order: [['createdAt', 'DESC']]
        });
        res.json(payments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getPaymentById = async (req, res) => {
    try {
        const payment = await PettyCashPayment.findByPk(req.params.id, {
            include: [
                { model: PettyCashBook, as: 'PettyCashBook' },
                {
                    model: PettyCashPaymentLine,
                    as: 'Lines',
                    include: [
                        { model: PettyCashCategory, as: 'Category' },
                        { model: LedgerAccount, as: 'LedgerAccount' }
                    ]
                }
            ]
        });
        if (!payment) return res.status(404).json({ error: 'Payment not found' });
        res.json(payment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.approvePayment = async (req, res) => {
    try {
        const payment = await PettyCashPayment.findByPk(req.params.id);
        if (!payment) return res.status(404).json({ error: 'Payment not found' });
        if (payment.status !== 'Draft') return res.status(400).json({ error: 'Only draft payments can be approved' });

        await payment.update({
            status: 'Approved',
            approvedAt: new Date(),
            approvedBy: req.user.id,
            updatedBy: req.user.id
        });
        res.json(payment);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.postPayment = async (req, res) => {
    let transaction;
    try {
        transaction = await sequelize.transaction();

        const payment = await PettyCashPayment.findByPk(req.params.id, {
            include: [
                { model: PettyCashBook, as: 'PettyCashBook' },
                { model: PettyCashPaymentLine, as: 'Lines' }
            ],
            transaction
        });

        if (!payment) return res.status(404).json({ error: 'Payment not found' });
        if (payment.status !== 'Approved') return res.status(400).json({ error: 'Only approved payments can be posted' });

        // Update Petty Cash Book balance
        const book = payment.PettyCashBook;
        if (parseFloat(book.currentBalance) < parseFloat(payment.totalAmount)) {
            throw new Error('Insufficient balance in Petty Cash Book');
        }

        book.currentBalance = parseFloat(book.currentBalance) - parseFloat(payment.totalAmount);
        await book.save({ transaction });

        // Prepare transaction details for TransactionService
        const transactionDetails = [];

        // Debit each expense line
        payment.Lines.forEach((line, index) => {
            transactionDetails.push({
                ledgerAccountId: line.ledgerAccountId,
                debitAmount: line.amount,
                creditAmount: 0,
                description: line.description || `Petty Cash Payment Line ${index + 1}`,
                lineNumber: index + 1
            });
        });

        // Credit Petty Cash Book ledger account
        transactionDetails.push({
            ledgerAccountId: book.ledgerAccountId,
            debitAmount: 0,
            creditAmount: payment.totalAmount,
            description: `Petty Cash Payment - ${payment.paymentNumber}`,
            lineNumber: payment.Lines.length + 1
        });

        // Log transaction
        const txnHeader = await TransactionService.logPettyCashPaymentTransaction(payment, transactionDetails, req.user.id);

        await payment.update({
            status: 'Posted',
            transactionHeaderId: txnHeader.id,
            postedAt: new Date(),
            postedBy: req.user.id,
            updatedBy: req.user.id
        }, { transaction });

        await transaction.commit();
        res.json({ message: 'Payment posted successfully', payment });
    } catch (error) {
        if (transaction) await transaction.rollback();
        res.status(400).json({ error: error.message });
    }
};

exports.deletePayment = async (req, res) => {
    try {
        const payment = await PettyCashPayment.findByPk(req.params.id);
        if (!payment) return res.status(404).json({ error: 'Payment not found' });
        if (payment.status !== 'Draft') return res.status(400).json({ error: 'Only draft payments can be deleted' });

        await PettyCashPaymentLine.destroy({ where: { pettyCashPaymentId: payment.id } });
        await payment.destroy();
        res.json({ message: 'Payment deleted successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
