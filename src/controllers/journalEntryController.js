const { JournalEntry, JournalEntryLine, LedgerAccount, AutoPostingRule, User, sequelize } = require('../models');
const { Op } = require('sequelize');

/**
 * Generate unique Journal Number
 */
const generateJournalNumber = async () => {
    try {
        const lastJournal = await JournalEntry.findOne({
            order: [['id', 'DESC']]
        });

        const nextNumber = (lastJournal ? parseInt(lastJournal.journalNumber.substring(2)) : 0) + 1;
        return `JN${String(nextNumber).padStart(6, '0')}`;
    } catch (error) {
        throw error;
    }
};

/**
 * Create Manual Journal Entry
 */
exports.createManualJournalEntry = async (req, res) => {
    try {
        const { journalDate, description, lines } = req.body;

        // Validation
        if (!journalDate || !lines || lines.length < 2) {
            return res.status(400).json({
                error: 'Journal date and at least 2 lines (one DR, one CR) are required'
            });
        }

        // Validate double-entry
        let totalDebit = 0;
        let totalCredit = 0;

        for (const line of lines) {
            if (!line.ledgerAccountId || (line.debitAmount === undefined && line.creditAmount === undefined)) {
                return res.status(400).json({ error: 'Each line must have a ledgerAccountId and either debitAmount or creditAmount' });
            }

            // Verify ledger exists
            const ledger = await LedgerAccount.findByPk(line.ledgerAccountId);
            if (!ledger) {
                return res.status(400).json({ error: `Ledger with ID ${line.ledgerAccountId} not found` });
            }

            totalDebit += line.debitAmount ? parseFloat(line.debitAmount) : 0;
            totalCredit += line.creditAmount ? parseFloat(line.creditAmount) : 0;
        }

        // Check double-entry balance
        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            return res.status(400).json({
                error: `Journal does not balance. Total Debit: ${totalDebit}, Total Credit: ${totalCredit}`
            });
        }

        // Create journal entry
        const journalNumber = await generateJournalNumber();

        const journalEntry = await JournalEntry.create({
            journalNumber,
            journalDate,
            description,
            referenceModule: 'MANUAL',
            totalDebit,
            totalCredit,
            status: 'Draft',
            createdBy: req.user.id
        });

        // Create journal lines
        let lineNumber = 1;
        const createdLines = [];

        for (const line of lines) {
            const journalLine = await JournalEntryLine.create({
                journalEntryId: journalEntry.id,
                ledgerAccountId: line.ledgerAccountId,
                debitAmount: line.debitAmount ? parseFloat(line.debitAmount) : 0,
                creditAmount: line.creditAmount ? parseFloat(line.creditAmount) : 0,
                description: line.description,
                lineNumber,
                createdBy: req.user.id
            });

            createdLines.push(journalLine);
            lineNumber++;
        }

        // Fetch complete journal with lines
        const completeJournal = await JournalEntry.findByPk(journalEntry.id, {
            include: [
                {
                    model: JournalEntryLine,
                    as: 'Lines',
                    include: [
                        { model: LedgerAccount, as: 'LedgerAccount', attributes: ['id', 'ledgerCode', 'name'] }
                    ]
                }
            ]
        });

        res.status(201).json({
            message: 'Manual Journal Entry created successfully',
            data: completeJournal
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Update Journal Entry
 */
exports.updateJournalEntry = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { journalDate, description, lines } = req.body;

        // Find existing journal entry
        const journalEntry = await JournalEntry.findByPk(id);
        if (!journalEntry) {
            await t.rollback();
            return res.status(404).json({ error: 'Journal Entry not found' });
        }

        // Check if journal can be updated
        if (!['Draft', 'Rejected'].includes(journalEntry.status)) {
            await t.rollback();
            return res.status(400).json({
                error: `Cannot update journal with status: ${journalEntry.status}. Only Draft or Rejected journals can be updated.`
            });
        }

        // Validation
        if (!journalDate || !lines || lines.length < 2) {
            await t.rollback();
            return res.status(400).json({
                error: 'Journal date and at least 2 lines (one DR, one CR) are required'
            });
        }

        // Validate double-entry
        let totalDebit = 0;
        let totalCredit = 0;

        for (const line of lines) {
            if (!line.ledgerAccountId || (line.debitAmount === undefined && line.creditAmount === undefined)) {
                await t.rollback();
                return res.status(400).json({ error: 'Each line must have a ledgerAccountId and either debitAmount or creditAmount' });
            }

            // Verify ledger exists
            const ledger = await LedgerAccount.findByPk(line.ledgerAccountId);
            if (!ledger) {
                await t.rollback();
                return res.status(400).json({ error: `Ledger with ID ${line.ledgerAccountId} not found` });
            }

            totalDebit += line.debitAmount ? parseFloat(line.debitAmount) : 0;
            totalCredit += line.creditAmount ? parseFloat(line.creditAmount) : 0;
        }

        // Check double-entry balance
        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            await t.rollback();
            return res.status(400).json({
                error: `Journal does not balance. Total Debit: ${totalDebit}, Total Credit: ${totalCredit}`
            });
        }

        // Update journal entry header
        await journalEntry.update({
            journalDate,
            description,
            totalDebit,
            totalCredit,
            // If it was rejected, move it back to draft or keep it draft-able
            status: 'Draft',
            rejectionReason: null,
            updatedBy: req.user.id
        }, { transaction: t });

        // Delete existing lines
        await JournalEntryLine.destroy({
            where: { journalEntryId: id },
            transaction: t
        });

        // Recreate journal lines
        let lineNumber = 1;
        for (const line of lines) {
            await JournalEntryLine.create({
                journalEntryId: journalEntry.id,
                ledgerAccountId: line.ledgerAccountId,
                debitAmount: line.debitAmount ? parseFloat(line.debitAmount) : 0,
                creditAmount: line.creditAmount ? parseFloat(line.creditAmount) : 0,
                description: line.description,
                lineNumber,
                createdBy: req.user.id
            }, { transaction: t });

            lineNumber++;
        }

        await t.commit();

        // Fetch complete updated journal with lines
        const updatedJournal = await JournalEntry.findByPk(id, {
            include: [
                {
                    model: JournalEntryLine,
                    as: 'Lines',
                    include: [
                        { model: LedgerAccount, as: 'LedgerAccount', attributes: ['id', 'ledgerCode', 'name'] }
                    ]
                }
            ]
        });

        res.json({
            message: 'Journal Entry updated successfully',
            data: updatedJournal
        });
    } catch (error) {
        if (t) await t.rollback();
        console.error('Update Journal Entry Error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get all Journal Entries
 */
exports.getAllJournalEntries = async (req, res) => {
    try {
        const { referenceModule, status, dateFrom, dateTo, page = 1, limit = 10 } = req.query;
        const where = {};

        if (referenceModule) where.referenceModule = referenceModule;
        if (status) where.status = status;
        if (dateFrom || dateTo) {
            where.journalDate = {};
            if (dateFrom) where.journalDate[Op.gte] = new Date(dateFrom);
            if (dateTo) where.journalDate[Op.lte] = new Date(dateTo);
        }

        const offset = (page - 1) * limit;

        const { count, rows } = await JournalEntry.findAndCountAll({
            where,
            include: [
                { model: User, as: 'Creator', attributes: ['id', 'fullName', 'email'] },
                { model: User, as: 'PostedByUser', attributes: ['id', 'fullName', 'email'] },
                { model: User, as: 'ApprovedByUser', attributes: ['id', 'fullName', 'email'] },
                {
                    model: JournalEntryLine,
                    as: 'Lines',
                    attributes: ['id', 'ledgerAccountId', 'debitAmount', 'creditAmount'],
                    include: [
                        { model: LedgerAccount, as: 'LedgerAccount', attributes: ['ledgerCode', 'name'] }
                    ]
                }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['journalNumber', 'DESC']],
            distinct: true
        });

        res.json({
            message: 'Journal Entries retrieved successfully',
            data: rows,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get Journal Entry by ID
 */
exports.getJournalEntryById = async (req, res) => {
    try {
        const { id } = req.params;

        const journalEntry = await JournalEntry.findByPk(id, {
            include: [
                {
                    model: JournalEntryLine,
                    as: 'Lines',
                    include: [
                        { model: LedgerAccount, as: 'LedgerAccount' }
                    ]
                },
                { model: User, as: 'Creator', attributes: ['id', 'fullName', 'email'] },
                { model: User, as: 'PostedByUser', attributes: ['id', 'fullName', 'email'] },
                { model: User, as: 'ApprovedByUser', attributes: ['id', 'fullName', 'email'] }
            ]
        });

        if (!journalEntry) {
            return res.status(404).json({ error: 'Journal Entry not found' });
        }

        res.json({
            message: 'Journal Entry retrieved successfully',
            data: journalEntry
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Submit Journal Entry for Approval
 */
exports.submitJournalEntry = async (req, res) => {
    try {
        const { id } = req.params;

        const journalEntry = await JournalEntry.findByPk(id);
        if (!journalEntry) {
            return res.status(404).json({ error: 'Journal Entry not found' });
        }

        if (journalEntry.status !== 'Draft') {
            return res.status(400).json({ error: 'Only Draft journals can be submitted' });
        }

        await journalEntry.update({
            status: 'Submitted',
            updatedBy: req.user.id
        });

        res.json({
            message: 'Journal Entry submitted for approval',
            data: journalEntry
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Approve Journal Entry
 */
exports.approveJournalEntry = async (req, res) => {
    try {
        const { id } = req.params;

        const journalEntry = await JournalEntry.findByPk(id);
        if (!journalEntry) {
            return res.status(404).json({ error: 'Journal Entry not found' });
        }

        if (!['Submitted'].includes(journalEntry.status)) {
            return res.status(400).json({ error: 'Only Submitted journals can be approved' });
        }

        await journalEntry.update({
            status: 'Approved',
            approvalStatus: 'Approved',
            approvedAt: new Date(),
            approvedBy: req.user.id,
            updatedBy: req.user.id
        });

        res.json({
            message: 'Journal Entry approved successfully',
            data: journalEntry
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Post Journal Entry (Final posting)
 * Creates Transaction Header and Transaction Details for audit trail
 */
exports.postJournalEntry = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;

        const journalEntry = await JournalEntry.findByPk(id, {
            include: [
                {
                    model: JournalEntryLine,
                    as: 'Lines',
                    include: [
                        { model: LedgerAccount, as: 'LedgerAccount' }
                    ]
                }
            ],
            transaction: t
        });

        if (!journalEntry) {
            await t.rollback();
            return res.status(404).json({ error: 'Journal Entry not found' });
        }

        if (journalEntry.status !== 'Approved') {
            await t.rollback();
            return res.status(400).json({ error: 'Only Approved journals can be posted' });
        }

        // Get user ID
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        // Update journal entry status
        await journalEntry.update({
            status: 'Posted',
            postedAt: new Date(),
            postedBy: currentUserId,
            updatedBy: currentUserId
        }, { transaction: t });

        // Commit the transaction first
        await t.commit();

        // Prepare transaction details from journal lines
        const transactionDetails = [];
        if (journalEntry.Lines && journalEntry.Lines.length > 0) {
            for (let i = 0; i < journalEntry.Lines.length; i++) {
                const line = journalEntry.Lines[i];
                const ledgerAccount = line.LedgerAccount;
                const accountName = ledgerAccount ? ledgerAccount.name : 'Unknown Account';

                let description = line.description || '';
                if (line.debitAmount > 0) {
                    description = `DR: ${accountName} - ${journalEntry.journalNumber}${description ? ' - ' + description : ''}`;
                } else if (line.creditAmount > 0) {
                    description = `CR: ${accountName} - ${journalEntry.journalNumber}${description ? ' - ' + description : ''}`;
                }

                transactionDetails.push({
                    ledgerAccountId: line.ledgerAccountId,
                    debitAmount: line.debitAmount || 0,
                    creditAmount: line.creditAmount || 0,
                    description: description,
                    lineNumber: line.lineNumber || (i + 1)
                });
            }
        }

        // Log to transaction tables AFTER commit
        if (transactionDetails.length > 0) {
            try {
                const TransactionService = require('../utils/transactionService');

                console.log('Logging journal entry transaction with:', {
                    journalId: journalEntry.id,
                    journalNumber: journalEntry.journalNumber,
                    transactionDetails: transactionDetails.length,
                    userId: currentUserId
                });

                await TransactionService.logJournalEntryPosting(journalEntry, transactionDetails, currentUserId);

                console.log('Transaction logged for journal entry:', journalEntry.journalNumber);
            } catch (logError) {
                console.error('Transaction logging error:', logError.message);
                console.error('Stack trace:', logError.stack);
                // Don't fail the whole process if logging fails
            }
        }

        // Fetch updated journal entry
        const updatedJournal = await JournalEntry.findByPk(id, {
            include: [
                {
                    model: JournalEntryLine,
                    as: 'Lines',
                    include: [
                        { model: LedgerAccount, as: 'LedgerAccount' }
                    ]
                },
                { model: User, as: 'Creator', attributes: ['id', 'fullName', 'email'] },
                { model: User, as: 'PostedByUser', attributes: ['id', 'fullName', 'email'] }
            ]
        });

        res.json({
            message: 'Journal Entry posted successfully',
            data: updatedJournal
        });
    } catch (error) {
        if (!t.finished) {
            await t.rollback();
        }
        console.error('Post journal entry error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.approveAndPostJournalEntry = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;

        const journalEntry = await JournalEntry.findByPk(id, {
            include: [
                {
                    model: JournalEntryLine,
                    as: 'Lines',
                    include: [
                        { model: LedgerAccount, as: 'LedgerAccount' }
                    ]
                }
            ],
            transaction: t
        });

        if (!journalEntry) {
            await t.rollback();
            return res.status(404).json({ error: 'Journal Entry not found' });
        }

        if (!['Submitted'].includes(journalEntry.status)) {
            return res.status(400).json({ error: 'Only Submitted journals can be approved' });
        }

        // Get user ID
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        // Update journal entry status
        await journalEntry.update({
            approvalStatus: 'Approved',
            approvedAt: new Date(),
            approvedBy: req.user.id,
            status: 'Posted',
            postedAt: new Date(),
            postedBy: currentUserId,
            updatedBy: currentUserId
        }, { transaction: t });

        // Commit the transaction first
        await t.commit();

        // Prepare transaction details from journal lines
        const transactionDetails = [];
        if (journalEntry.Lines && journalEntry.Lines.length > 0) {
            for (let i = 0; i < journalEntry.Lines.length; i++) {
                const line = journalEntry.Lines[i];
                const ledgerAccount = line.LedgerAccount;
                const accountName = ledgerAccount ? ledgerAccount.name : 'Unknown Account';

                let description = line.description || '';
                if (line.debitAmount > 0) {
                    description = `DR: ${accountName} - ${journalEntry.journalNumber}${description ? ' - ' + description : ''}`;
                } else if (line.creditAmount > 0) {
                    description = `CR: ${accountName} - ${journalEntry.journalNumber}${description ? ' - ' + description : ''}`;
                }

                transactionDetails.push({
                    ledgerAccountId: line.ledgerAccountId,
                    debitAmount: line.debitAmount || 0,
                    creditAmount: line.creditAmount || 0,
                    description: description,
                    lineNumber: line.lineNumber || (i + 1)
                });
            }
        }

        // Log to transaction tables AFTER commit
        if (transactionDetails.length > 0) {
            try {
                const TransactionService = require('../utils/transactionService');

                console.log('Logging journal entry transaction with:', {
                    journalId: journalEntry.id,
                    journalNumber: journalEntry.journalNumber,
                    transactionDetails: transactionDetails.length,
                    userId: currentUserId
                });

                await TransactionService.logJournalEntryPosting(journalEntry, transactionDetails, currentUserId);

                console.log('Transaction logged for journal entry:', journalEntry.journalNumber);
            } catch (logError) {
                console.error('Transaction logging error:', logError.message);
                console.error('Stack trace:', logError.stack);
                // Don't fail the whole process if logging fails
            }
        }

        // Fetch updated journal entry
        const updatedJournal = await JournalEntry.findByPk(id, {
            include: [
                {
                    model: JournalEntryLine,
                    as: 'Lines',
                    include: [
                        { model: LedgerAccount, as: 'LedgerAccount' }
                    ]
                },
                { model: User, as: 'Creator', attributes: ['id', 'fullName', 'email'] },
                { model: User, as: 'PostedByUser', attributes: ['id', 'fullName', 'email'] }
            ]
        });

        res.json({
            message: 'Journal Entry posted successfully',
            data: updatedJournal
        });
    } catch (error) {
        if (!t.finished) {
            await t.rollback();
        }
        console.error('Post journal entry error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Unpost Journal Entry (Only admins)
 */
exports.unpostJournalEntry = async (req, res) => {
    try {
        const { id } = req.params;

        // Check admin permission
        if (req.user.role !== 'Admin') {
            return res.status(403).json({ error: 'Only admins can unpost journals' });
        }

        const journalEntry = await JournalEntry.findByPk(id);
        if (!journalEntry) {
            return res.status(404).json({ error: 'Journal Entry not found' });
        }

        if (journalEntry.status !== 'Posted') {
            return res.status(400).json({ error: 'Only Posted journals can be unposted' });
        }

        await journalEntry.update({
            status: 'Approved',
            postedAt: null,
            postedBy: null,
            updatedBy: req.user.id
        });

        res.json({
            message: 'Journal Entry unposted successfully',
            data: journalEntry
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Reject Journal Entry
 */
exports.rejectJournalEntry = async (req, res) => {
    try {
        const { id } = req.params;
        const { rejectionReason } = req.body;

        const journalEntry = await JournalEntry.findByPk(id);
        if (!journalEntry) {
            return res.status(404).json({ error: 'Journal Entry not found' });
        }

        if (!['Draft', 'Submitted'].includes(journalEntry.status)) {
            return res.status(400).json({ error: 'Only Draft or Submitted journals can be rejected' });
        }

        await journalEntry.update({
            status: 'Rejected',
            approvalStatus: 'Rejected',
            rejectionReason,
            updatedBy: req.user.id
        });

        res.json({
            message: 'Journal Entry rejected',
            data: journalEntry
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get Journal Audit Trail
 */
exports.getJournalAuditTrail = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        const { count, rows } = await JournalEntry.findAndCountAll({
            where: {
                isAutoPosted: true
            },
            include: [
                { model: User, as: 'Creator', attributes: ['id', 'fullName', 'email'] },
                { model: User, as: 'PostedByUser', attributes: ['id', 'fullName', 'email'] }
            ],
            attributes: ['id', 'journalNumber', 'journalDate', 'referenceModule', 'referenceId', 'referenceNumber', 'status', 'isAutoPosted', 'createdAt'],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']],
            distinct: true
        });

        res.json({
            message: 'Journal Audit Trail retrieved successfully',
            data: rows,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Delete Draft Journal Entry
 */
exports.deleteDraftJournal = async (req, res) => {
    try {
        const { id } = req.params;

        const journalEntry = await JournalEntry.findByPk(id);
        if (!journalEntry) {
            return res.status(404).json({ error: 'Journal Entry not found' });
        }

        if (journalEntry.status !== 'Draft') {
            return res.status(400).json({ error: 'Only Draft journals can be deleted' });
        }

        // Delete lines first
        await JournalEntryLine.destroy({
            where: { journalEntryId: id }
        });

        // Delete journal
        await journalEntry.destroy();

        res.json({
            message: 'Draft Journal Entry deleted successfully'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
