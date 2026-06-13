const { OnePayment, OnePaymentLine, OnePaymentMethod, LedgerAccount, Bank, BankBranch, User, sequelize } = require('../models');
const { Op } = require('sequelize');
const TransactionService = require('../utils/transactionService');

/**
 * Generate unique Payment Number
 */
const generatePaymentNumber = async () => {
    try {
        const lastPayment = await OnePayment.findOne({
            order: [['id', 'DESC']]
        });

        let nextNumber = 1;
        if (lastPayment && lastPayment.paymentNumber) {
            try {
                // Extract number from paymentNumber (format: OP000001)
                const numStr = lastPayment.paymentNumber.substring(2); // Remove 'OP' prefix
                const parsed = parseInt(numStr, 10);
                if (!isNaN(parsed)) {
                    nextNumber = parsed + 1;
                }
            } catch (parseError) {
                console.warn('Could not parse last payment number:', lastPayment.paymentNumber);
            }
        }

        return `OP${String(nextNumber).padStart(6, '0')}`;
    } catch (error) {
        throw error;
    }
};

/**
 * Create One-Payment with multiple lines and payment methods
 */
exports.createOnePayment = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { paymentDate, description, referenceNumber, currencyCode, lines, paymentMethods } = req.body;

        // Validation
        if (!paymentDate) {
            return res.status(400).json({ error: 'Payment date is required' });
        }
        if (!lines || !Array.isArray(lines) || lines.length === 0) {
            return res.status(400).json({ error: 'At least one payment line is required' });
        }
        if (!paymentMethods || !Array.isArray(paymentMethods) || paymentMethods.length === 0) {
            return res.status(400).json({ error: 'At least one payment method is required' });
        }

        // Calculate totals
        // Logic: lines are always Debit, paymentMethods are always Credit
        let totalDebitAmount = 0;
        let totalCreditAmount = 0;
        let totalPaymentAmount = 0;

        for (const line of lines) {
            totalDebitAmount += parseFloat(line.amount);
            line.lineType = 'Debit'; // Ensure line type is Debit
        }

        for (const method of paymentMethods) {
            const amount = parseFloat(method.amount);
            totalCreditAmount += amount;
            totalPaymentAmount += amount;
        }

        // Validate: Debit must equal Credit (Payment Amount)
        if (Math.abs(totalDebitAmount - totalCreditAmount) > 0.01) {
            return res.status(400).json({
                error: `Total debit amount (${totalDebitAmount.toFixed(2)}) must equal total payment amount (${totalCreditAmount.toFixed(2)})`
            });
        }

        const paymentNumber = await generatePaymentNumber();

        // Create payment header
        const onePayment = await OnePayment.create({
            paymentNumber,
            paymentDate,
            totalDebitAmount,
            totalCreditAmount,
            totalPaymentAmount,
            currencyCode: currencyCode || 'LKR',
            description,
            referenceNumber: referenceNumber || null,
            status: 'Draft',
            createdBy: req.user.id
        }, { transaction: t });

        // Create payment lines
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Verify ledger account exists
            const ledgerAccount = await LedgerAccount.findByPk(line.ledgerAccountId);
            if (!ledgerAccount) {
                throw new Error(`Ledger account with ID ${line.ledgerAccountId} not found`);
            }

            await OnePaymentLine.create({
                onePaymentId: onePayment.id,
                lineNumber: i + 1,
                lineType: line.lineType,
                ledgerAccountId: line.ledgerAccountId,
                amount: parseFloat(line.amount),
                description: line.description || null,
                referenceType: line.referenceType || null,
                referenceId: line.referenceId || null,
                referenceNumber: line.referenceNumber || null,
                createdBy: req.user.id
            }, { transaction: t });
        }

        // Create payment methods
        for (let i = 0; i < paymentMethods.length; i++) {
            const method = paymentMethods[i];

            // Verify bank account if provided
            if (method.bankAccountId) {
                const bankAccount = await LedgerAccount.findByPk(method.bankAccountId);
                if (!bankAccount) {
                    throw new Error(`Bank account with ID ${method.bankAccountId} not found`);
                }
                if (!bankAccount.isBankLedger) {
                    throw new Error(`Account with ID ${method.bankAccountId} is not a valid bank ledger`);
                }
            }

            await OnePaymentMethod.create({
                onePaymentId: onePayment.id,
                lineNumber: i + 1,
                paymentMethod: method.paymentMethod,
                ledgerAccountId: method.ledgerAccountId,
                bankAccountId: method.bankAccountId || null,
                amount: parseFloat(method.amount),
                referenceNumber: method.referenceNumber || null,
                chequeNumber: method.chequeNumber || null,
                chequeDate: method.chequeDate || null,
                bankName: method.bankName || null,
                cardType: method.cardType || null,
                description: method.description || null,
                createdBy: req.user.id
            }, { transaction: t });
        }

        await t.commit();

        // Fetch complete payment with relationships
        const completePayment = await OnePayment.findByPk(onePayment.id, {
            include: [
                {
                    model: OnePaymentLine,
                    as: 'Lines',
                    include: [{ model: LedgerAccount, as: 'LedgerAccount' }]
                },
                {
                    model: OnePaymentMethod,
                    as: 'PaymentMethods',
                    include: [{ model: LedgerAccount, as: 'LedgerAccount' }]
                },
                { model: User, as: 'Creator', attributes: ['id', 'fullName', 'email'] }
            ]
        });

        res.status(201).json({
            message: 'One-Payment created successfully',
            data: completePayment
        });
    } catch (error) {
        if (!t.finished) {
            await t.rollback();
        }
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get all One-Payments
 */
exports.getAllOnePayments = async (req, res) => {
    try {
        const { status, dateFrom, dateTo, search, page = 1, limit = 10 } = req.query;
        const where = {};

        if (status && status !== 'All') where.status = status;
        if (dateFrom || dateTo) {
            where.paymentDate = {};
            if (dateFrom) where.paymentDate[Op.gte] = new Date(dateFrom);
            if (dateTo) where.paymentDate[Op.lte] = new Date(dateTo);
        }

        if (search) {
            where[Op.or] = [
                { paymentNumber: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } },
                { referenceNumber: { [Op.like]: `%${search}%` } }
            ];
        }

        const offset = (page - 1) * parseInt(limit);

        const { count, rows } = await OnePayment.findAndCountAll({
            where,
            include: [
                {
                    model: OnePaymentLine,
                    as: 'Lines',
                    include: [{ model: LedgerAccount, as: 'LedgerAccount', attributes: ['id', 'ledgerCode', 'name'] }]
                },
                {
                    model: OnePaymentMethod,
                    as: 'PaymentMethods',
                    include: [{ model: LedgerAccount, as: 'LedgerAccount', attributes: ['id', 'ledgerCode', 'name'] }]
                },
                { model: User, as: 'Creator', attributes: ['id', 'fullName', 'email'] },
                { model: User, as: 'ApprovedByUser', attributes: ['id', 'fullName', 'email'] },
                { model: User, as: 'PostedByUser', attributes: ['id', 'fullName', 'email'] }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['paymentDate', 'DESC'], ['paymentNumber', 'DESC']],
            distinct: true
        });

        res.json({
            message: 'One-Payments retrieved successfully',
            data: rows,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / parseInt(limit)),
                totalPages: Math.ceil(count / parseInt(limit))
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get One-Payment by ID
 */
exports.getOnePaymentById = async (req, res) => {
    try {
        const { id } = req.params;

        const onePayment = await OnePayment.findByPk(id, {
            include: [
                {
                    model: OnePaymentLine,
                    as: 'Lines',
                    include: [{ model: LedgerAccount, as: 'LedgerAccount' }],
                    order: [['lineNumber', 'ASC']]
                },
                {
                    model: OnePaymentMethod,
                    as: 'PaymentMethods',
                    include: [{ model: LedgerAccount, as: 'LedgerAccount' }],
                    order: [['lineNumber', 'ASC']]
                },
                { model: User, as: 'Creator', attributes: ['id', 'fullName', 'email'] },
                { model: User, as: 'ApprovedByUser', attributes: ['id', 'fullName', 'email'] },
                { model: User, as: 'PostedByUser', attributes: ['id', 'fullName', 'email'] },
                { model: User, as: 'ReversedByUser', attributes: ['id', 'fullName', 'email'] }
            ]
        });

        if (!onePayment) {
            return res.status(404).json({ error: 'One-Payment not found' });
        }

        res.json({
            message: 'One-Payment retrieved successfully',
            data: onePayment
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Update One-Payment (Draft only)
 */
exports.updateOnePayment = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { paymentDate, description, referenceNumber, currencyCode, lines, paymentMethods } = req.body;

        const onePayment = await OnePayment.findByPk(id, { transaction: t });
        if (!onePayment) {
            return res.status(404).json({ error: 'One-Payment not found' });
        }

        if (onePayment.status !== 'Draft') {
            return res.status(400).json({ error: 'Only Draft payments can be updated' });
        }

        // If lines or payment methods are provided, recalculate totals
        let totalDebitAmount = onePayment.totalDebitAmount;
        let totalCreditAmount = onePayment.totalCreditAmount;
        let totalPaymentAmount = onePayment.totalPaymentAmount;

        if (lines && Array.isArray(lines)) {
            totalDebitAmount = 0;

            for (const line of lines) {
                totalDebitAmount += parseFloat(line.amount);
                line.lineType = 'Debit';
            }

            // If paymentMethods are also provided in this update, we'll validate later
            // Otherwise validate against current totalCreditAmount
            if (!paymentMethods && Math.abs(totalDebitAmount - totalCreditAmount) > 0.01) {
                return res.status(400).json({
                    error: `Total debit (${totalDebitAmount.toFixed(2)}) must equal total credit (${totalCreditAmount.toFixed(2)})`
                });
            }

            // Delete existing lines and create new ones
            await OnePaymentLine.destroy({ where: { onePaymentId: id }, transaction: t });

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                await OnePaymentLine.create({
                    onePaymentId: onePayment.id,
                    lineNumber: i + 1,
                    lineType: line.lineType,
                    ledgerAccountId: line.ledgerAccountId,
                    amount: parseFloat(line.amount),
                    description: line.description || null,
                    referenceType: line.referenceType || null,
                    referenceId: line.referenceId || null,
                    referenceNumber: line.referenceNumber || null,
                    createdBy: req.user.id
                }, { transaction: t });
            }
        }

        if (paymentMethods && Array.isArray(paymentMethods)) {
            totalPaymentAmount = 0;
            totalCreditAmount = 0;

            for (const method of paymentMethods) {
                const amount = parseFloat(method.amount);
                totalPaymentAmount += amount;
                totalCreditAmount += amount;
            }

            // Validate: Debit must equal Credit (if lines also updated, we use the new totalDebitAmount)
            if (Math.abs(totalDebitAmount - totalCreditAmount) > 0.01) {
                return res.status(400).json({
                    error: `Total debit (${totalDebitAmount.toFixed(2)}) must equal total payment amount (${totalCreditAmount.toFixed(2)})`
                });
            }

            // Delete existing payment methods and create new ones
            await OnePaymentMethod.destroy({ where: { onePaymentId: id }, transaction: t });

            for (let i = 0; i < paymentMethods.length; i++) {
                const method = paymentMethods[i];
                await OnePaymentMethod.create({
                    onePaymentId: onePayment.id,
                    lineNumber: i + 1,
                    paymentMethod: method.paymentMethod,
                    ledgerAccountId: method.ledgerAccountId,
                    bankAccountId: method.bankAccountId || null,
                    amount: parseFloat(method.amount),
                    referenceNumber: method.referenceNumber || null,
                    chequeNumber: method.chequeNumber || null,
                    chequeDate: method.chequeDate || null,
                    bankName: method.bankName || null,
                    cardType: method.cardType || null,
                    description: method.description || null,
                    createdBy: req.user.id
                }, { transaction: t });
            }
        }

        // Update payment header
        await onePayment.update({
            paymentDate: paymentDate || onePayment.paymentDate,
            totalDebitAmount,
            totalCreditAmount,
            totalPaymentAmount,
            currencyCode: currencyCode || onePayment.currencyCode,
            description: description !== undefined ? description : onePayment.description,
            referenceNumber: referenceNumber !== undefined ? referenceNumber : onePayment.referenceNumber,
            updatedBy: req.user.id
        }, { transaction: t });

        await t.commit();

        const updatedPayment = await OnePayment.findByPk(id, {
            include: [
                {
                    model: OnePaymentLine,
                    as: 'Lines',
                    include: [{ model: LedgerAccount, as: 'LedgerAccount' }]
                },
                {
                    model: OnePaymentMethod,
                    as: 'PaymentMethods',
                    include: [{ model: LedgerAccount, as: 'LedgerAccount' }]
                }
            ]
        });

        res.json({
            message: 'One-Payment updated successfully',
            data: updatedPayment
        });
    } catch (error) {
        if (!t.finished) {
            await t.rollback();
        }
        res.status(500).json({ error: error.message });
    }
};

/**
 * Submit One-Payment for Approval
 */
exports.submitOnePayment = async (req, res) => {
    try {
        const { id } = req.params;

        const onePayment = await OnePayment.findByPk(id);
        if (!onePayment) {
            return res.status(404).json({ error: 'One-Payment not found' });
        }

        if (onePayment.status !== 'Draft') {
            return res.status(400).json({ error: 'Only Draft payments can be submitted' });
        }

        await onePayment.update({
            status: 'Submitted',
            updatedBy: req.user.id
        });

        res.json({
            message: 'One-Payment submitted for approval',
            data: onePayment
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Approve One-Payment
 */
exports.approveOnePayment = async (req, res) => {
    try {
        const { id } = req.params;

        const onePayment = await OnePayment.findByPk(id);
        if (!onePayment) {
            return res.status(404).json({ error: 'One-Payment not found' });
        }

        if (onePayment.status !== 'Submitted') {
            return res.status(400).json({ error: 'Only Submitted payments can be approved' });
        }

        await onePayment.update({
            status: 'Approved',
            approvalStatus: 'Approved',
            approvedAt: new Date(),
            approvedBy: req.user.id,
            updatedBy: req.user.id
        });

        res.json({
            message: 'One-Payment approved successfully',
            data: onePayment
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Approve and Post One-Payment (Create Transaction Entries)
 */
exports.approveAndPostOnePayment = async (req, res) => {
    try {
        const { id } = req.params;

        const onePayment = await OnePayment.findByPk(id, {
            include: [
                { model: OnePaymentLine, as: 'Lines' },
                { model: OnePaymentMethod, as: 'PaymentMethods' }
            ]
        });

        if (!onePayment) {
            return res.status(404).json({ error: 'One-Payment not found' });
        }

        if (onePayment.status !== 'Submitted') {
            return res.status(400).json({ error: 'Only Submitted payments can be approved' });
        }

        await onePayment.update({
            status: 'Approved',
            approvalStatus: 'Approved',
            approvedAt: new Date(),
            approvedBy: req.user.id,
            updatedBy: req.user.id
        });

        // Prepare transaction details
        // Debit entries come from payment lines
        const debitEntries = onePayment.Lines.map((line, index) => ({
            ledgerAccountId: line.ledgerAccountId,
            debitAmount: line.amount,
            creditAmount: 0,
            description: line.description || `Debit - ${onePayment.paymentNumber}`,
            lineNumber: index + 1
        }));

        // Credit entries come from payment methods
        const creditEntries = onePayment.PaymentMethods.map((method, index) => ({
            ledgerAccountId: method.ledgerAccountId,
            debitAmount: 0,
            creditAmount: method.amount,
            description: method.description || `${method.paymentMethod} - ${onePayment.paymentNumber}`,
            lineNumber: debitEntries.length + index + 1
        }));

        const transactionDetails = [...debitEntries, ...creditEntries];

        // Update payment status to Posted
        await onePayment.update({
            status: 'Posted',
            postedAt: new Date(),
            postedBy: req.user.id,
            updatedBy: req.user.id
        });

        // Log transaction AFTER posting
        try {
            await TransactionService.logOnePaymentTransaction(
                onePayment,
                transactionDetails,
                req.user.id
            );
        } catch (logError) {
            console.error('Warning: Transaction logging failed for one-payment:', logError.message);
            // Don't fail the entire process if logging fails
        }

        const updatedPayment = await OnePayment.findByPk(id, {
            include: [
                {
                    model: OnePaymentLine,
                    as: 'Lines',
                    include: [{ model: LedgerAccount, as: 'LedgerAccount' }]
                },
                {
                    model: OnePaymentMethod,
                    as: 'PaymentMethods',
                    include: [{ model: LedgerAccount, as: 'LedgerAccount' }]
                }
            ]
        });

        res.json({
            message: 'One-Payment posted successfully',
            data: updatedPayment
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Post One-Payment (Create Transaction Entries)
 */
exports.postOnePayment = async (req, res) => {
    try {
        const { id } = req.params;

        const onePayment = await OnePayment.findByPk(id, {
            include: [
                { model: OnePaymentLine, as: 'Lines' },
                { model: OnePaymentMethod, as: 'PaymentMethods' }
            ]
        });

        if (!onePayment) {
            return res.status(404).json({ error: 'One-Payment not found' });
        }

        if (onePayment.status !== 'Approved') {
            return res.status(400).json({ error: 'Only Approved payments can be posted' });
        }

        // Prepare transaction details
        // Debit entries come from payment lines
        const debitEntries = onePayment.Lines.map((line, index) => ({
            ledgerAccountId: line.ledgerAccountId,
            debitAmount: line.amount,
            creditAmount: 0,
            description: line.description || `Debit - ${onePayment.paymentNumber}`,
            lineNumber: index + 1
        }));

        // Credit entries come from payment methods
        const creditEntries = onePayment.PaymentMethods.map((method, index) => ({
            ledgerAccountId: method.ledgerAccountId,
            debitAmount: 0,
            creditAmount: method.amount,
            description: method.description || `${method.paymentMethod} - ${onePayment.paymentNumber}`,
            lineNumber: debitEntries.length + index + 1
        }));

        const transactionDetails = [...debitEntries, ...creditEntries];

        // Update payment status to Posted
        await onePayment.update({
            status: 'Posted',
            postedAt: new Date(),
            postedBy: req.user.id,
            updatedBy: req.user.id
        });

        // Log transaction AFTER posting
        try {
            await TransactionService.logOnePaymentTransaction(
                onePayment,
                transactionDetails,
                req.user.id
            );
        } catch (logError) {
            console.error('Warning: Transaction logging failed for one-payment:', logError.message);
            // Don't fail the entire process if logging fails
        }

        const updatedPayment = await OnePayment.findByPk(id, {
            include: [
                {
                    model: OnePaymentLine,
                    as: 'Lines',
                    include: [{ model: LedgerAccount, as: 'LedgerAccount' }]
                },
                {
                    model: OnePaymentMethod,
                    as: 'PaymentMethods',
                    include: [{ model: LedgerAccount, as: 'LedgerAccount' }]
                }
            ]
        });

        res.json({
            message: 'One-Payment posted successfully',
            data: updatedPayment
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Reject One-Payment
 */
exports.rejectOnePayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { rejectionReason } = req.body;

        const onePayment = await OnePayment.findByPk(id);
        if (!onePayment) {
            return res.status(404).json({ error: 'One-Payment not found' });
        }

        if (!['Draft', 'Submitted'].includes(onePayment.status)) {
            return res.status(400).json({ error: 'Only Draft or Submitted payments can be rejected' });
        }

        await onePayment.update({
            status: 'Rejected',
            approvalStatus: 'Rejected',
            rejectionReason,
            updatedBy: req.user.id
        });

        res.json({
            message: 'One-Payment rejected',
            data: onePayment
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Reverse One-Payment (Posted only)
 */
exports.reverseOnePayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { reversalReason } = req.body;

        const onePayment = await OnePayment.findByPk(id, {
            include: [
                { model: OnePaymentLine, as: 'Lines' },
                { model: OnePaymentMethod, as: 'PaymentMethods' }
            ]
        });

        if (!onePayment) {
            return res.status(404).json({ error: 'One-Payment not found' });
        }

        if (onePayment.status !== 'Posted') {
            return res.status(400).json({ error: 'Only Posted payments can be reversed' });
        }

        // Create reversal transaction details (swap debit/credit)
        const debitReversal = onePayment.Lines.map((line, index) => ({
            ledgerAccountId: line.ledgerAccountId,
            debitAmount: 0,
            creditAmount: line.amount,
            description: `Reversal - Debit: ${line.description || onePayment.paymentNumber}`,
            lineNumber: index + 1
        }));

        const creditReversal = onePayment.PaymentMethods.map((method, index) => ({
            ledgerAccountId: method.ledgerAccountId,
            debitAmount: method.amount,
            creditAmount: 0,
            description: `Reversal - Credit: ${method.description || onePayment.paymentNumber}`,
            lineNumber: debitReversal.length + index + 1
        }));

        const reversalDetails = [...debitReversal, ...creditReversal];

        // Log reversal transaction
        try {
            await TransactionService.logOnePaymentTransaction(
                {
                    ...onePayment.toJSON(),
                    paymentNumber: `${onePayment.paymentNumber}-REV`,
                    description: `Reversal: ${reversalReason}`
                },
                reversalDetails,
                req.user.id
            );
        } catch (logError) {
            console.error('Warning: Reversal transaction logging failed:', logError.message);
        }

        await onePayment.update({
            status: 'Reversed',
            reversalReason,
            reversedAt: new Date(),
            reversedBy: req.user.id,
            updatedBy: req.user.id
        });

        res.json({
            message: 'One-Payment reversed successfully',
            data: onePayment
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Cancel One-Payment (Draft/Submitted only)
 */
exports.cancelOnePayment = async (req, res) => {
    try {
        const { id } = req.params;

        const onePayment = await OnePayment.findByPk(id);
        if (!onePayment) {
            return res.status(404).json({ error: 'One-Payment not found' });
        }

        if (!['Draft', 'Submitted'].includes(onePayment.status)) {
            return res.status(400).json({ error: 'Only Draft or Submitted payments can be cancelled' });
        }

        await onePayment.update({
            status: 'Cancelled',
            updatedBy: req.user.id
        });

        res.json({
            message: 'One-Payment cancelled',
            data: onePayment
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Delete Draft One-Payment
 */
exports.deleteOnePayment = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;

        const onePayment = await OnePayment.findByPk(id, { transaction: t });
        if (!onePayment) {
            return res.status(404).json({ error: 'One-Payment not found' });
        }

        if (onePayment.status !== 'Draft') {
            return res.status(400).json({ error: 'Only Draft payments can be deleted' });
        }

        // Delete lines and payment methods
        await OnePaymentLine.destroy({ where: { onePaymentId: id }, transaction: t });
        await OnePaymentMethod.destroy({ where: { onePaymentId: id }, transaction: t });

        // Delete payment
        await onePayment.destroy({ transaction: t });

        await t.commit();

        res.json({
            message: 'Draft One-Payment deleted successfully'
        });
    } catch (error) {
        if (!t.finished) {
            await t.rollback();
        }
        res.status(500).json({ error: error.message });
    }
};

module.exports = exports;
