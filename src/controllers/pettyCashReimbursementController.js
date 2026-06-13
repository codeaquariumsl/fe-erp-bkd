const { PettyCashReimbursement, PettyCashBook, LedgerAccount, TransactionHeader, DocumentSequence, sequelize } = require('../models');
const TransactionService = require('../utils/transactionService');

exports.createReimbursement = async (req, res) => {
    let transaction;
    try {
        transaction = await sequelize.transaction();
        const { reimbursementDate, pettyCashBookId, sourceLedgerAccountId, amount, description, locationId } = req.body;

        // Generate reimbursement number
        let sequence = await DocumentSequence.findOne({
            where: { documentType: 'PCR', locationId: locationId || null },
            lock: transaction.LOCK.UPDATE,
            transaction
        });

        if (!sequence) {
            sequence = await DocumentSequence.create({
                documentType: 'PCR',
                prefix: 'PCR',
                currentNumber: 0,
                numberLength: 5,
                locationId: locationId || null
            }, { transaction });
        }

        sequence.currentNumber += 1;
        await sequence.save({ transaction });

        const reimbursementNumber = `${sequence.prefix}-${String(sequence.currentNumber).padStart(sequence.numberLength, '0')}`;

        const reimbursement = await PettyCashReimbursement.create({
            reimbursementNumber,
            reimbursementDate,
            pettyCashBookId,
            sourceLedgerAccountId,
            amount: parseFloat(amount) || 0,
            description,
            status: 'Draft',
            locationId,
            createdBy: req.user.id
        }, { transaction });

        await transaction.commit();
        res.status(201).json(reimbursement);
    } catch (error) {
        if (transaction) await transaction.rollback();
        res.status(400).json({ error: error.message });
    }
};

exports.getReimbursements = async (req, res) => {
    try {
        const reimbursements = await PettyCashReimbursement.findAll({
            include: [
                { model: PettyCashBook, as: 'PettyCashBook' },
                { model: LedgerAccount, as: 'SourceAccount' }
            ],
            order: [['createdAt', 'DESC']]
        });
        res.json(reimbursements);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getReimbursementById = async (req, res) => {
    try {
        const reimbursement = await PettyCashReimbursement.findByPk(req.params.id, {
            include: [
                { model: PettyCashBook, as: 'PettyCashBook' },
                { model: LedgerAccount, as: 'SourceAccount' },
                { model: TransactionHeader, as: 'TransactionHeader' }
            ]
        });
        if (!reimbursement) return res.status(404).json({ error: 'Reimbursement not found' });
        res.json(reimbursement);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.approveReimbursement = async (req, res) => {
    try {
        const reimbursement = await PettyCashReimbursement.findByPk(req.params.id);
        if (!reimbursement) return res.status(404).json({ error: 'Reimbursement not found' });
        if (reimbursement.status !== 'Draft') return res.status(400).json({ error: 'Only draft reimbursements can be approved' });

        await reimbursement.update({
            status: 'Approved',
            approvedAt: new Date(),
            approvedBy: req.user.id,
            updatedBy: req.user.id
        });
        res.json(reimbursement);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.postReimbursement = async (req, res) => {
    let transaction;
    try {
        transaction = await sequelize.transaction();
        const reimbursement = await PettyCashReimbursement.findByPk(req.params.id, {
            include: [{ model: PettyCashBook, as: 'PettyCashBook' }]
        });

        if (!reimbursement) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Reimbursement not found' });
        }
        if (reimbursement.status !== 'Approved') {
            await transaction.rollback();
            return res.status(400).json({ error: 'Only approved reimbursements can be posted' });
        }

        const book = reimbursement.PettyCashBook;
        if (!book) {
            await transaction.rollback();
            return res.status(400).json({ error: 'Petty Cash Book not found for this reimbursement' });
        }

        // 1. Update PettyCashBook currentBalance
        const newBalance = parseFloat(book.currentBalance) + parseFloat(reimbursement.amount);
        await book.update({ currentBalance: newBalance }, { transaction });

        // 2. Prepare Ledger Postings
        // Debit: Petty Cash Ledger
        // Credit: Source Account (Bank/Cash)
        const transactionDetails = [
            {
                ledgerAccountId: book.ledgerAccountId, // Petty Cash Ledger
                debitAmount: parseFloat(reimbursement.amount),
                creditAmount: 0,
                description: `Reimbursement to ${book.name} - ${reimbursement.reimbursementNumber}`,
                lineNumber: 1
            },
            {
                ledgerAccountId: reimbursement.sourceLedgerAccountId, // Bank/Cash Source
                debitAmount: 0,
                creditAmount: parseFloat(reimbursement.amount),
                description: `Replenishing Petty Cash ${book.name} - ${reimbursement.reimbursementNumber}`,
                lineNumber: 2
            }
        ];

        // 3. Log Transaction
        const txnHeader = await TransactionService.logPettyCashReimbursementTransaction(reimbursement, transactionDetails, req.user.id);

        // 4. Update Reimbursement Status
        await reimbursement.update({
            status: 'Posted',
            postedAt: new Date(),
            postedBy: req.user.id,
            transactionHeaderId: txnHeader.id,
            updatedBy: req.user.id
        }, { transaction });

        await transaction.commit();
        res.json({ message: 'Reimbursement posted successfully', reimbursement });
    } catch (error) {
        if (transaction) await transaction.rollback();
        res.status(400).json({ error: error.message });
    }
};

exports.deleteReimbursement = async (req, res) => {
    try {
        const reimbursement = await PettyCashReimbursement.findByPk(req.params.id);
        if (!reimbursement) return res.status(404).json({ error: 'Reimbursement not found' });
        if (reimbursement.status !== 'Draft') return res.status(400).json({ error: 'Only draft reimbursements can be deleted' });

        await reimbursement.destroy();
        res.json({ message: 'Reimbursement deleted successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
