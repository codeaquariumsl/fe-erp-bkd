
/**
 * Add Bill Entry Detail
 */
exports.addBillEntryDetail = async (req, res) => {
    try {
        const { billEntryId } = req.params;
        const { ledgerId, description, quantity, unitPrice, amount, taxAmount, taxPercentage, remarks } = req.body;

        // Validate bill entry exists
        const billEntry = await BillEntry.findByPk(billEntryId);
        if (!billEntry) {
            return res.status(404).json({ error: 'Bill Entry not found' });
        }

        // Only allow adding details to Draft bills
        if (billEntry.status !== 'Draft') {
            return res.status(400).json({ error: 'Can only add details to Draft bills' });
        }

        if (!ledgerId || !amount) {
            return res.status(400).json({ error: 'Ledger ID and amount are required' });
        }

        // Validate ledger exists
        const ledger = await LedgerAccount.findByPk(ledgerId);
        if (!ledger) {
            return res.status(404).json({ error: `Ledger account with ID ${ledgerId} not found` });
        }

        // Get next line number
        const lastDetail = await BillEntryDetail.findOne({
            where: { billEntryId },
            order: [['lineNumber', 'DESC']]
        });
        const nextLineNumber = (lastDetail ? lastDetail.lineNumber : 0) + 1;

        const detail = await BillEntryDetail.create({
            billEntryId,
            ledgerId,
            description,
            quantity: quantity || 0,
            unitPrice: unitPrice || 0,
            amount: parseFloat(amount),
            taxAmount: parseFloat(taxAmount) || 0,
            totalAmount: parseFloat(amount) + (parseFloat(taxAmount) || 0),
            taxPercentage: taxPercentage || 0,
            lineNumber: nextLineNumber,
            remarks,
            createdBy: req.user.id
        });

        const completeDetail = await BillEntryDetail.findByPk(detail.id, {
            include: [
                { model: LedgerAccount, as: 'LedgerAccount', attributes: ['id', 'code', 'name'] },
                { model: User, as: 'Creator', attributes: ['id', 'fullName'] }
            ]
        });

        res.status(201).json({
            message: 'Bill Entry detail added successfully',
            data: completeDetail
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Update Bill Entry Detail
 */
exports.updateBillEntryDetail = async (req, res) => {
    try {
        const { billEntryId, detailId } = req.params;
        const { ledgerId, description, quantity, unitPrice, amount, taxAmount, taxPercentage, remarks } = req.body;

        const detail = await BillEntryDetail.findByPk(detailId);
        if (!detail || detail.billEntryId !== parseInt(billEntryId)) {
            return res.status(404).json({ error: 'Bill Entry Detail not found' });
        }

        const billEntry = await BillEntry.findByPk(billEntryId);
        if (billEntry.status !== 'Draft') {
            return res.status(400).json({ error: 'Can only update details in Draft bills' });
        }

        const updates = {};
        if (ledgerId) {
            const ledger = await LedgerAccount.findByPk(ledgerId);
            if (!ledger) {
                return res.status(404).json({ error: `Ledger account with ID ${ledgerId} not found` });
            }
            updates.ledgerId = ledgerId;
        }
        if (description !== undefined) updates.description = description;
        if (quantity !== undefined) updates.quantity = quantity;
        if (unitPrice !== undefined) updates.unitPrice = unitPrice;
        if (amount !== undefined) {
            updates.amount = parseFloat(amount);
            if (!taxAmount && !updates.taxAmount) {
                updates.totalAmount = parseFloat(amount) + (detail.taxAmount || 0);
            }
        }
        if (taxAmount !== undefined) {
            updates.taxAmount = parseFloat(taxAmount);
            if (!amount && !updates.amount) {
                updates.totalAmount = (detail.amount || 0) + parseFloat(taxAmount);
            }
        }
        if (amount && taxAmount) {
            updates.totalAmount = parseFloat(amount) + parseFloat(taxAmount);
        }
        if (taxPercentage !== undefined) updates.taxPercentage = taxPercentage;
        if (remarks !== undefined) updates.remarks = remarks;
        
        updates.updatedBy = req.user.id;

        await detail.update(updates);

        const updatedDetail = await BillEntryDetail.findByPk(detailId, {
            include: [
                { model: LedgerAccount, as: 'LedgerAccount', attributes: ['id', 'code', 'name'] },
                { model: User, as: 'Creator', attributes: ['id', 'fullName'] },
                { model: User, as: 'Updater', attributes: ['id', 'fullName'] }
            ]
        });

        res.json({
            message: 'Bill Entry detail updated successfully',
            data: updatedDetail
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Delete Bill Entry Detail
 */
exports.deleteBillEntryDetail = async (req, res) => {
    try {
        const { billEntryId, detailId } = req.params;

        const detail = await BillEntryDetail.findByPk(detailId);
        if (!detail || detail.billEntryId !== parseInt(billEntryId)) {
            return res.status(404).json({ error: 'Bill Entry Detail not found' });
        }

        const billEntry = await BillEntry.findByPk(billEntryId);
        if (billEntry.status !== 'Draft') {
            return res.status(400).json({ error: 'Can only delete details from Draft bills' });
        }

        await detail.destroy();

        res.json({
            message: 'Bill Entry detail deleted successfully'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get Bill Entry Details
 */
exports.getBillEntryDetails = async (req, res) => {
    try {
        const { billEntryId } = req.params;

        const billEntry = await BillEntry.findByPk(billEntryId);
        if (!billEntry) {
            return res.status(404).json({ error: 'Bill Entry not found' });
        }

        const details = await BillEntryDetail.findAll({
            where: { billEntryId },
            include: [
                { model: LedgerAccount, as: 'LedgerAccount', attributes: ['id', 'code', 'name', 'description'] },
                { model: User, as: 'Creator', attributes: ['id', 'fullName'] },
                { model: User, as: 'Updater', attributes: ['id', 'fullName'] }
            ],
            order: [['lineNumber', 'ASC']]
        });

        res.json({
            message: 'Bill Entry details retrieved successfully',
            billNumber: billEntry.billNumber,
            billEntryId: billEntry.id,
            data: details
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
