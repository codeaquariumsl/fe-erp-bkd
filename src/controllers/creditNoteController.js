const { CreditNote, CreditNoteItem, Customer, Invoice, InvoiceItem, CustomerReturn, CustomerReturnItem, Item, Location, User, sequelize } = require('../models');
const { Op } = require('sequelize');
const { generateDocumentNumber } = require('./documentControllerClient');

// Create Credit Note
exports.createCreditNote = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const {
            customerId,
            invoiceId,
            customerReturnId,
            creditNoteDate,
            reason,
            isTaxCreditNote,
            taxRate,
            notes,
            locationId,
            items // Array of { itemId, invoiceItemId, customerReturnItemId, code, qty, unitPrice, discount, isTaxItem, reason }
        } = req.body;

        const userId = req.user?.id;

        if (!userId) {
            await transaction.rollback();
            return res.status(401).json({ message: 'User not authenticated' });
        }

        // Validate required fields
        if (!customerId || !locationId || !items || items.length === 0) {
            await transaction.rollback();
            return res.status(400).json({ message: 'Customer, location, and items are required' });
        }

        // Generate credit note number
        const creditNoteNumber = await generateDocumentNumber('CN', locationId);

        // Calculate totals
        let subtotal = 0;
        let taxAmount = 0;

        const itemsWithCalculations = items.map(item => {
            const itemSubtotal = item.qty * item.unitPrice;
            const discountAmount = (itemSubtotal * (item.discount || 0)) / 100;
            const discountedAmount = itemSubtotal - discountAmount;

            let excludingTaxAmount = discountedAmount;
            let itemTotal = discountedAmount;

            if (isTaxCreditNote && item.isTaxItem) {
                const itemTaxAmount = (discountedAmount * (taxRate || 0)) / 100;
                itemTotal = discountedAmount + itemTaxAmount;
                excludingTaxAmount = discountedAmount;
            }

            subtotal += discountedAmount;
            if (isTaxCreditNote && item.isTaxItem) {
                taxAmount += (discountedAmount * (taxRate || 0)) / 100;
            }

            return {
                ...item,
                discountedAmount,
                excludingTaxAmount,
                total: itemTotal,
                createdBy: userId
            };
        });

        const total = subtotal + taxAmount;

        // Create credit note
        const creditNote = await CreditNote.create({
            creditNoteNumber,
            customerId,
            invoiceId: invoiceId || null,
            customerReturnId: customerReturnId || null,
            creditNoteDate: creditNoteDate || new Date(),
            reason,
            isTaxCreditNote: isTaxCreditNote || false,
            taxRate: taxRate || 0,
            taxAmount,
            subtotal,
            total,
            appliedAmount: 0,
            status: 'Draft',
            notes,
            locationId,
            createdBy: userId,
            updatedBy: userId
        }, { transaction });

        // Create credit note items
        const creditNoteItems = await Promise.all(
            itemsWithCalculations.map(item =>
                CreditNoteItem.create({
                    creditNoteId: creditNote.id,
                    ...item
                }, { transaction })
            )
        );

        await transaction.commit();

        // Fetch complete credit note with associations
        const completeCreditNote = await CreditNote.findByPk(creditNote.id, {
            include: [
                { model: Customer, as: 'Customer' },
                { model: Invoice, as: 'Invoice' },
                { model: CustomerReturn, as: 'CustomerReturn' },
                { model: Location, as: 'Location' },
                { model: User, as: 'Creator' },
                {
                    model: CreditNoteItem,
                    as: 'CreditNoteItems',
                    include: [{ model: Item, as: 'Item' }]
                }
            ]
        });

        res.status(201).json({
            message: 'Credit note created successfully',
            creditNote: completeCreditNote
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error creating credit note:', error);
        res.status(500).json({ message: 'Error creating credit note', error: error.message });
    }
};

// Get all Credit Notes
exports.getAllCreditNotes = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, customerId, locationId } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;

        const whereClause = {};
        if (status) whereClause.status = status;
        if (customerId) whereClause.customerId = customerId;
        if (locationId) whereClause.locationId = locationId;

        const { count, rows: creditNotes } = await CreditNote.findAndCountAll({
            where: whereClause,
            limit: limitNum,
            offset: offset,
            include: [
                { model: Customer, as: 'Customer' },
                { model: Invoice, as: 'Invoice' },
                { model: CustomerReturn, as: 'CustomerReturn' },
                { model: Location, as: 'Location' },
                { model: User, as: 'Creator' },
                { model: User, as: 'ApprovedByUser' },
                {
                    model: CreditNoteItem,
                    as: 'CreditNoteItems',
                    include: [{ model: Item, as: 'Item' }]
                }
            ],
            distinct: true,
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({
            creditNotes,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: count,
                pages: Math.ceil(count / limitNum)
            }
        });
    } catch (error) {
        console.error('Error fetching credit notes:', error);
        res.status(500).json({ message: 'Error fetching credit notes', error: error.message });
    }
};

// Get Credit Note by ID
exports.getCreditNoteById = async (req, res) => {
    try {
        const { id } = req.params;

        const creditNote = await CreditNote.findByPk(id, {
            include: [
                { model: Customer, as: 'Customer' },
                { model: Invoice, as: 'Invoice' },
                { model: CustomerReturn, as: 'CustomerReturn' },
                { model: Location, as: 'Location' },
                { model: User, as: 'Creator' },
                { model: User, as: 'Updater' },
                { model: User, as: 'ApprovedByUser' },
                {
                    model: CreditNoteItem,
                    as: 'CreditNoteItems',
                    include: [
                        { model: Item, as: 'Item' },
                        { model: InvoiceItem, as: 'InvoiceItem' },
                        { model: CustomerReturnItem, as: 'CustomerReturnItem' }
                    ]
                }
            ]
        });

        if (!creditNote) {
            return res.status(404).json({ message: 'Credit note not found' });
        }

        res.status(200).json(creditNote);
    } catch (error) {
        console.error('Error fetching credit note:', error);
        res.status(500).json({ message: 'Error fetching credit note', error: error.message });
    }
};

// Get Credit Notes by Customer ID
exports.getCreditNotesByCustomerId = async (req, res) => {
    try {
        const { customerId } = req.params;
        const { status } = req.query;

        const whereClause = { customerId };
        if (status) whereClause.status = status;

        const creditNotes = await CreditNote.findAll({
            where: whereClause,
            include: [
                { model: Customer, as: 'Customer' },
                { model: Invoice, as: 'Invoice' },
                { model: CustomerReturn, as: 'CustomerReturn' },
                { model: Location, as: 'Location' },
                {
                    model: CreditNoteItem,
                    as: 'CreditNoteItems',
                    include: [{ model: Item, as: 'Item' }]
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json(creditNotes);
    } catch (error) {
        console.error('Error fetching credit notes by customer:', error);
        res.status(500).json({ message: 'Error fetching credit notes', error: error.message });
    }
};

// Update Credit Note (only if Draft)
exports.updateCreditNote = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { id } = req.params;
        const {
            reason,
            isTaxCreditNote,
            taxRate,
            notes,
            items
        } = req.body;

        const userId = req.user?.id;

        const creditNote = await CreditNote.findByPk(id, { transaction });

        if (!creditNote) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Credit note not found' });
        }

        if (creditNote.status !== 'Draft') {
            await transaction.rollback();
            return res.status(400).json({ message: 'Only draft credit notes can be updated' });
        }

        // If items are provided, recalculate totals
        if (items && items.length > 0) {
            // Delete existing items
            await CreditNoteItem.destroy({
                where: { creditNoteId: id },
                transaction
            });

            // Calculate new totals
            let subtotal = 0;
            let taxAmount = 0;

            const itemsWithCalculations = items.map(item => {
                const itemSubtotal = item.qty * item.unitPrice;
                const discountAmount = (itemSubtotal * (item.discount || 0)) / 100;
                const discountedAmount = itemSubtotal - discountAmount;

                let excludingTaxAmount = discountedAmount;
                let itemTotal = discountedAmount;

                if (isTaxCreditNote && item.isTaxItem) {
                    const itemTaxAmount = (discountedAmount * (taxRate || 0)) / 100;
                    itemTotal = discountedAmount + itemTaxAmount;
                    excludingTaxAmount = discountedAmount;
                }

                subtotal += discountedAmount;
                if (isTaxCreditNote && item.isTaxItem) {
                    taxAmount += (discountedAmount * (taxRate || 0)) / 100;
                }

                return {
                    ...item,
                    discountedAmount,
                    excludingTaxAmount,
                    total: itemTotal,
                    createdBy: userId
                };
            });

            const total = subtotal + taxAmount;

            // Create new items
            await Promise.all(
                itemsWithCalculations.map(item =>
                    CreditNoteItem.create({
                        creditNoteId: id,
                        ...item
                    }, { transaction })
                )
            );

            // Update credit note totals
            await creditNote.update({
                reason,
                isTaxCreditNote: isTaxCreditNote !== undefined ? isTaxCreditNote : creditNote.isTaxCreditNote,
                taxRate: taxRate !== undefined ? taxRate : creditNote.taxRate,
                taxAmount,
                subtotal,
                total,
                notes,
                updatedBy: userId
            }, { transaction });
        } else {
            // Update only metadata
            await creditNote.update({
                reason,
                notes,
                updatedBy: userId
            }, { transaction });
        }

        await transaction.commit();

        // Fetch updated credit note
        const updatedCreditNote = await CreditNote.findByPk(id, {
            include: [
                { model: Customer, as: 'Customer' },
                { model: Invoice, as: 'Invoice' },
                { model: CustomerReturn, as: 'CustomerReturn' },
                {
                    model: CreditNoteItem,
                    as: 'CreditNoteItems',
                    include: [{ model: Item, as: 'Item' }]
                }
            ]
        });

        res.status(200).json({
            message: 'Credit note updated successfully',
            creditNote: updatedCreditNote
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error updating credit note:', error);
        res.status(500).json({ message: 'Error updating credit note', error: error.message });
    }
};

// Delete Credit Note (only if Draft)
exports.deleteCreditNote = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { id } = req.params;

        const creditNote = await CreditNote.findByPk(id, { transaction });

        if (!creditNote) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Credit note not found' });
        }

        if (creditNote.status !== 'Draft') {
            await transaction.rollback();
            return res.status(400).json({ message: 'Only draft credit notes can be deleted' });
        }

        // Delete items first
        await CreditNoteItem.destroy({
            where: { creditNoteId: id },
            transaction
        });

        // Delete credit note
        await creditNote.destroy({ transaction });

        await transaction.commit();

        res.status(200).json({ message: 'Credit note deleted successfully' });
    } catch (error) {
        await transaction.rollback();
        console.error('Error deleting credit note:', error);
        res.status(500).json({ message: 'Error deleting credit note', error: error.message });
    }
};

// Approve or Reject Credit Note
exports.approveOrRejectCreditNote = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { action, rejectionReason } = req.body; // action: 'approve' or 'reject'

        const userId = req.user?.id;

        if (!userId) {
            await transaction.rollback();
            return res.status(401).json({ message: 'User not authenticated' });
        }

        const creditNote = await CreditNote.findByPk(id, { transaction });

        if (!creditNote) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Credit note not found' });
        }

        if (creditNote.status !== 'Draft' && creditNote.status !== 'Pending') {
            await transaction.rollback();
            return res.status(400).json({ message: 'Credit note cannot be approved/rejected in current status' });
        }

        if (action === 'approve') {
            await creditNote.update({
                status: 'Approved',
                approvedBy: userId,
                approvedDate: new Date(),
                updatedBy: userId
            }, { transaction });

            // If linked to a customer return, update the return status and utilized amount
            if (creditNote.customerReturnId) {
                const customerReturn = await CustomerReturn.findByPk(creditNote.customerReturnId, { transaction });
                if (customerReturn) {
                    const newUtilizedAmount = parseFloat(customerReturn.utilizedAmount || 0) + parseFloat(creditNote.total);
                    const isFullyUtilized = newUtilizedAmount >= parseFloat(customerReturn.totalAmount);

                    await customerReturn.update({
                        utilizedAmount: newUtilizedAmount,
                        status: isFullyUtilized ? 'Completed' : customerReturn.status,
                        refundStatus: isFullyUtilized ? 'Completed' : customerReturn.refundStatus,
                        updatedBy: userId
                    }, { transaction });
                    console.log(`Updated CustomerReturn ${customerReturn.returnNumber} utilizedAmount to ${newUtilizedAmount}`);
                }
            }

            await transaction.commit();

            res.status(200).json({
                message: 'Credit note approved successfully',
                creditNote
            });
        } else if (action === 'reject') {
            await creditNote.update({
                status: 'Rejected',
                notes: rejectionReason ? `${creditNote.notes || ''}\nRejection Reason: ${rejectionReason}` : creditNote.notes,
                updatedBy: userId
            }, { transaction });

            await transaction.commit();

            res.status(200).json({
                message: 'Credit note rejected successfully',
                creditNote
            });
        } else {
            await transaction.rollback();
            return res.status(400).json({ message: 'Invalid action. Use "approve" or "reject"' });
        }
    } catch (error) {
        await transaction.rollback();
        console.error('Error approving/rejecting credit note:', error);
        res.status(500).json({ message: 'Error processing credit note', error: error.message });
    }
};

// Apply Credit Note to Invoice
exports.applyCreditNoteToInvoice = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { invoiceId, amount } = req.body;

        const userId = req.user?.id;

        const creditNote = await CreditNote.findByPk(id, { transaction });

        if (!creditNote) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Credit note not found' });
        }

        if (creditNote.status !== 'Approved') {
            await transaction.rollback();
            return res.status(400).json({ message: 'Only approved credit notes can be applied' });
        }

        const availableAmount = parseFloat(creditNote.total) - parseFloat(creditNote.appliedAmount);

        if (amount > availableAmount) {
            await transaction.rollback();
            return res.status(400).json({
                message: 'Amount exceeds available credit',
                availableAmount
            });
        }

        const invoice = await Invoice.findByPk(invoiceId, { transaction });

        if (!invoice) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Invoice not found' });
        }

        if (invoice.customerId !== creditNote.customerId) {
            await transaction.rollback();
            return res.status(400).json({ message: 'Credit note and invoice must belong to the same customer' });
        }

        // Update invoice paid amount
        const newPaidAmount = parseFloat(invoice.paidAmount) + parseFloat(amount);
        await invoice.update({
            paidAmount: newPaidAmount
        }, { transaction });

        // Update credit note applied amount
        const newAppliedAmount = parseFloat(creditNote.appliedAmount) + parseFloat(amount);
        const newStatus = newAppliedAmount >= parseFloat(creditNote.total) ? 'Applied' : 'Approved';

        await creditNote.update({
            appliedAmount: newAppliedAmount,
            status: newStatus,
            updatedBy: userId
        }, { transaction });

        await transaction.commit();

        res.status(200).json({
            message: 'Credit note applied to invoice successfully',
            creditNote,
            invoice
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error applying credit note:', error);
        res.status(500).json({ message: 'Error applying credit note', error: error.message });
    }
};

// Get Credit Note Items by Credit Note ID
exports.getCreditNoteItems = async (req, res) => {
    try {
        const { id } = req.params;

        const items = await CreditNoteItem.findAll({
            where: { creditNoteId: id },
            include: [
                { model: Item, as: 'Item' },
                { model: InvoiceItem, as: 'InvoiceItem' },
                { model: CustomerReturnItem, as: 'CustomerReturnItem' }
            ]
        });

        res.status(200).json(items);
    } catch (error) {
        console.error('Error fetching credit note items:', error);
        res.status(500).json({ message: 'Error fetching credit note items', error: error.message });
    }
};

// Create Credit Note from Customer Return
exports.createCreditNoteFromReturn = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { customerReturnId } = req.body;
        const userId = req.user?.id;

        if (!userId) {
            await transaction.rollback();
            return res.status(401).json({ message: 'User not authenticated' });
        }

        // Fetch customer return with items
        const customerReturn = await CustomerReturn.findByPk(customerReturnId, {
            include: [
                {
                    model: CustomerReturnItem,
                    as: 'CustomerReturnItems',
                    include: [{ model: Item, as: 'Item' }]
                }
            ],
            transaction
        });

        if (!customerReturn) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Customer return not found' });
        }

        if (customerReturn.status !== 'Approved') {
            await transaction.rollback();
            return res.status(400).json({ message: 'Only approved customer returns can generate credit notes' });
        }

        // Check if credit note already exists for this return
        const existingCreditNote = await CreditNote.findOne({
            where: { customerReturnId },
            transaction
        });

        if (existingCreditNote) {
            await transaction.rollback();
            return res.status(400).json({
                message: 'Credit note already exists for this customer return',
                creditNoteId: existingCreditNote.id
            });
        }

        // Generate credit note number
        const creditNoteNumber = await generateDocumentNumber('CN', customerReturn.locationId);

        // Prepare items from customer return (direct mapping, no recalculation)
        const itemsWithCalculations = customerReturn.CustomerReturnItems.map(returnItem => ({
            itemId: returnItem.itemId,
            customerReturnItemId: returnItem.id,
            qty: returnItem.quantity,
            unitPrice: returnItem.unitPrice || 0,
            discount: returnItem.discount || 0,
            discountedAmount: returnItem.excludingTaxAmount || 0,
            excludingTaxAmount: returnItem.excludingTaxAmount || 0,
            isTaxItem: returnItem.isTaxItem || false,
            taxAmount: returnItem.taxAmount || 0,
            total: returnItem.totalPrice || 0,
            reason: returnItem.reason,
            createdBy: userId
        }));

        // Header totals from customer return (Net totals)
        const subtotal = (parseFloat(customerReturn.subTotal || 0) - parseFloat(customerReturn.discountAmount || 0));
        const taxAmount = parseFloat(customerReturn.taxAmount || 0);
        const total = parseFloat(customerReturn.totalAmount || 0);

        // Create credit note
        const creditNote = await CreditNote.create({
            creditNoteNumber,
            customerId: customerReturn.customerId,
            invoiceId: customerReturn.invoiceId,
            customerReturnId: customerReturn.id,
            creditNoteDate: new Date(),
            reason: customerReturn.reason,
            isTaxCreditNote: customerReturn.isTaxReturn || false,
            taxRate: customerReturn.taxRate || 0,
            taxAmount,
            subtotal,
            total,
            appliedAmount: 0,
            status: 'Approved', // Auto-approve credit notes from approved returns
            approvedBy: userId,
            approvedDate: new Date(),
            notes: `Auto-generated from Customer Return ${customerReturn.returnNumber}`,
            locationId: customerReturn.locationId,
            createdBy: userId,
            updatedBy: userId
        }, { transaction });

        // Create credit note items
        await Promise.all(
            itemsWithCalculations.map(item =>
                CreditNoteItem.create({
                    creditNoteId: creditNote.id,
                    ...item
                }, { transaction })
            )
        );

        // Update customer return status and utilized amount
        await customerReturn.update({
            status: 'Completed',
            utilizedAmount: total,
            refundStatus: 'Completed',
            updatedBy: userId
        }, { transaction });

        await transaction.commit();

        // Fetch complete credit note
        const completeCreditNote = await CreditNote.findByPk(creditNote.id, {
            include: [
                { model: Customer, as: 'Customer' },
                { model: Invoice, as: 'Invoice' },
                { model: CustomerReturn, as: 'CustomerReturn' },
                {
                    model: CreditNoteItem,
                    as: 'CreditNoteItems',
                    include: [{ model: Item, as: 'Item' }]
                }
            ]
        });

        res.status(201).json({
            message: 'Credit note created from customer return successfully',
            creditNote: completeCreditNote
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error creating credit note from return:', error);
        res.status(500).json({ message: 'Error creating credit note', error: error.message });
    }
};

// Get available credit for a customer
exports.getCustomerAvailableCredit = async (req, res) => {
    try {
        const { customerId } = req.params;

        const creditNotes = await CreditNote.findAll({
            where: {
                customerId,
                status: 'Approved'
            },
            attributes: [
                'id',
                'creditNoteNumber',
                'creditNoteDate',
                'total',
                'appliedAmount',
                [sequelize.literal('total - appliedAmount'), 'availableAmount']
            ]
        });

        const totalAvailableCredit = creditNotes.reduce((sum, cn) => {
            return sum + (parseFloat(cn.total) - parseFloat(cn.appliedAmount));
        }, 0);

        res.status(200).json({
            customerId,
            totalAvailableCredit,
            creditNotes
        });
    } catch (error) {
        console.error('Error fetching customer available credit:', error);
        res.status(500).json({ message: 'Error fetching available credit', error: error.message });
    }
};
