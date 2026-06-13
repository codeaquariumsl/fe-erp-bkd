const { AutoPostingRule, LedgerAccount, JournalEntry, JournalEntryLine, User, sequelize } = require('../models');
const { Op } = require('sequelize');

/**
 * Create Auto-Posting Rule
 */
exports.createAutoPostingRule = async (req, res) => {
    try {
        const { 
            ruleName, description, triggerModule, triggerEvent, 
            debitLedgerId, creditLedgerId, debitAmount, creditAmount,
            useControlAccount, controlAccountType, ruleOrder
        } = req.body;

        // Validation
        if (!ruleName || !triggerModule || !triggerEvent || !debitLedgerId || !creditLedgerId) {
            return res.status(400).json({ 
                error: 'ruleName, triggerModule, triggerEvent, debitLedgerId, and creditLedgerId are required' 
            });
        }

        // Verify ledgers exist
        const debitLedger = await LedgerAccount.findByPk(debitLedgerId);
        if (!debitLedger) {
            return res.status(404).json({ error: 'Debit Ledger not found' });
        }

        const creditLedger = await LedgerAccount.findByPk(creditLedgerId);
        if (!creditLedger) {
            return res.status(404).json({ error: 'Credit Ledger not found' });
        }

        // Check unique rule name
        const existing = await AutoPostingRule.findOne({ where: { ruleName } });
        if (existing) {
            return res.status(400).json({ error: 'Auto-Posting Rule with this name already exists' });
        }

        const rule = await AutoPostingRule.create({
            ruleName,
            description,
            triggerModule,
            triggerEvent,
            debitLedgerId,
            creditLedgerId,
            debitAmount: debitAmount || 'TOTAL_AMOUNT',
            creditAmount: creditAmount || 'TOTAL_AMOUNT',
            useControlAccount: useControlAccount || false,
            controlAccountType: controlAccountType || null,
            ruleOrder: ruleOrder || 0,
            createdBy: req.user.id
        });

        res.status(201).json({
            message: 'Auto-Posting Rule created successfully',
            data: rule
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get all Auto-Posting Rules
 */
exports.getAllAutoPostingRules = async (req, res) => {
    try {
        const { triggerModule, isEnabled, page = 1, limit = 10 } = req.query;
        const where = {};

        if (triggerModule) where.triggerModule = triggerModule;
        if (isEnabled !== undefined) where.isEnabled = isEnabled === 'true';

        const offset = (page - 1) * limit;

        const { count, rows } = await AutoPostingRule.findAndCountAll({
            where,
            include: [
                { model: LedgerAccount, as: 'DebitLedger', attributes: ['id', 'ledgerCode', 'name'] },
                { model: LedgerAccount, as: 'CreditLedger', attributes: ['id', 'ledgerCode', 'name'] }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['ruleOrder', 'ASC'], ['triggerModule', 'ASC']],
            distinct: true
        });

        res.json({
            message: 'Auto-Posting Rules retrieved successfully',
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
 * Get Auto-Posting Rule by ID
 */
exports.getAutoPostingRuleById = async (req, res) => {
    try {
        const { id } = req.params;

        const rule = await AutoPostingRule.findByPk(id, {
            include: [
                { model: LedgerAccount, as: 'DebitLedger' },
                { model: LedgerAccount, as: 'CreditLedger' },
                { model: User, as: 'Creator', attributes: ['id', 'name', 'email'] }
            ]
        });

        if (!rule) {
            return res.status(404).json({ error: 'Auto-Posting Rule not found' });
        }

        res.json({
            message: 'Auto-Posting Rule retrieved successfully',
            data: rule
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Update Auto-Posting Rule
 */
exports.updateAutoPostingRule = async (req, res) => {
    try {
        const { id } = req.params;
        const { description, debitLedgerId, creditLedgerId, debitAmount, creditAmount, isEnabled, ruleOrder } = req.body;

        const rule = await AutoPostingRule.findByPk(id);
        if (!rule) {
            return res.status(404).json({ error: 'Auto-Posting Rule not found' });
        }

        // Verify ledgers if changing
        if (debitLedgerId && debitLedgerId !== rule.debitLedgerId) {
            const debitLedger = await LedgerAccount.findByPk(debitLedgerId);
            if (!debitLedger) {
                return res.status(404).json({ error: 'Debit Ledger not found' });
            }
        }

        if (creditLedgerId && creditLedgerId !== rule.creditLedgerId) {
            const creditLedger = await LedgerAccount.findByPk(creditLedgerId);
            if (!creditLedger) {
                return res.status(404).json({ error: 'Credit Ledger not found' });
            }
        }

        await rule.update({
            description: description !== undefined ? description : rule.description,
            debitLedgerId: debitLedgerId || rule.debitLedgerId,
            creditLedgerId: creditLedgerId || rule.creditLedgerId,
            debitAmount: debitAmount || rule.debitAmount,
            creditAmount: creditAmount || rule.creditAmount,
            isEnabled: isEnabled !== undefined ? isEnabled : rule.isEnabled,
            ruleOrder: ruleOrder !== undefined ? ruleOrder : rule.ruleOrder,
            updatedBy: req.user.id
        });

        res.json({
            message: 'Auto-Posting Rule updated successfully',
            data: rule
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Toggle Auto-Posting Rule
 */
exports.toggleAutoPostingRule = async (req, res) => {
    try {
        const { id } = req.params;

        const rule = await AutoPostingRule.findByPk(id);
        if (!rule) {
            return res.status(404).json({ error: 'Auto-Posting Rule not found' });
        }

        await rule.update({
            isEnabled: !rule.isEnabled,
            updatedBy: req.user.id
        });

        res.json({
            message: `Auto-Posting Rule ${rule.isEnabled ? 'enabled' : 'disabled'} successfully`,
            data: rule
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Delete Auto-Posting Rule
 */
exports.deleteAutoPostingRule = async (req, res) => {
    try {
        const { id } = req.params;

        const rule = await AutoPostingRule.findByPk(id);
        if (!rule) {
            return res.status(404).json({ error: 'Auto-Posting Rule not found' });
        }

        await rule.destroy();

        res.json({
            message: 'Auto-Posting Rule deleted successfully'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get Rules by Trigger Module
 */
exports.getRulesByTriggerModule = async (req, res) => {
    try {
        const { triggerModule } = req.params;
        const { triggerEvent } = req.query;

        const where = { triggerModule, isEnabled: true };
        if (triggerEvent) where.triggerEvent = triggerEvent;

        const rules = await AutoPostingRule.findAll({
            where,
            include: [
                { model: LedgerAccount, as: 'DebitLedger', attributes: ['id', 'ledgerCode', 'name'] },
                { model: LedgerAccount, as: 'CreditLedger', attributes: ['id', 'ledgerCode', 'name'] }
            ],
            order: [['ruleOrder', 'ASC']]
        });

        res.json({
            message: 'Rules retrieved successfully',
            data: rules
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Preview Journal Entry from Auto-Posting Rule
 */
exports.previewAutoPosting = async (req, res) => {
    try {
        const { ruleId, amount, referenceId, referenceNumber } = req.body;

        const rule = await AutoPostingRule.findByPk(ruleId, {
            include: [
                { model: LedgerAccount, as: 'DebitLedger' },
                { model: LedgerAccount, as: 'CreditLedger' }
            ]
        });

        if (!rule) {
            return res.status(404).json({ error: 'Auto-Posting Rule not found' });
        }

        const journalPreview = {
            journalNumber: 'PREVIEW',
            description: rule.description,
            referenceModule: rule.triggerModule,
            referenceId,
            referenceNumber,
            lines: [
                {
                    lineNumber: 1,
                    ledgerAccount: rule.DebitLedger,
                    debitAmount: amount || 0,
                    creditAmount: 0
                },
                {
                    lineNumber: 2,
                    ledgerAccount: rule.CreditLedger,
                    debitAmount: 0,
                    creditAmount: amount || 0
                }
            ],
            totalDebit: amount || 0,
            totalCredit: amount || 0
        };

        res.json({
            message: 'Journal preview generated successfully',
            data: journalPreview
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
