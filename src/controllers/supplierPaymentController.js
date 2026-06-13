const SupplierPayment = require('../models/supplierPayment');
const SupplierPaymentMethod = require('../models/supplierPaymentMethod');
const SupplierPaymentGRN = require('../models/supplierPaymentGRN');
const SupplierReturn = require('../models/supplierReturn');
const Supplier = require('../models/supplier');
const User = require('../models/user');
const PurchaseOrder = require('../models/purchaseOrder');
const GRN = require('../models/grn');
const Location = require('../models/location');
const { generateDocumentNumber } = require('./documentControllerClient');
const { Op } = require('sequelize');
const { LedgerAccount, PaymentType } = require('../models');
const TransactionService = require('../utils/transactionService');

// Create a new supplier payment
exports.createSupplierPayment = async (req, res) => {
    const t = await SupplierPayment.sequelize.transaction();
    try {
        const {
            supplierId,
            purchaseOrderId,
            grnId,
            supplierReturnId,
            paymentType,
            paymentMethod,
            amount,
            currency,
            exchangeRate,
            referenceNumber,
            bankDetails,
            chequeNumber,
            chequeDate,
            bankAccountId,
            supplierAccountDetails,
            dueDate,
            notes,
            attachments,
            locationId,
            paymentGRNs,  // Array of GRNs with payment details
            paymentMethods // Array of payment methods
        } = req.body;

        // Generate payment number
        const paymentNumber = await generateDocumentNumber('SP', locationId);

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        // Validate supplier exists
        const supplier = await Supplier.findByPk(supplierId, { transaction: t });
        if (!supplier) {
            await t.rollback();
            return res.status(400).json({ error: 'Supplier not found' });
        }

        // Validate payment methods sum if provided
        if (Array.isArray(paymentMethods) && paymentMethods.length > 0) {
            const totalMethodsAmount = paymentMethods.reduce((sum, pm) => sum + (parseFloat(pm.paymentAmount) || 0), 0);
            const totalPaymentAmount = parseFloat(amount);

            // Allow small float difference
            if (Math.abs(totalMethodsAmount - totalPaymentAmount) > 0.05) {
                await t.rollback();
                return res.status(400).json({
                    error: `Payment methods total (${totalMethodsAmount}) does not match payment amount (${totalPaymentAmount})`
                });
            }
        }

        // Calculate amount in base currency
        const rate = exchangeRate || 1.0;
        const amountInBaseCurrency = parseFloat(amount) * parseFloat(rate);

        // Create supplier payment
        const supplierPayment = await SupplierPayment.create({
            paymentNumber,
            supplierId,
            purchaseOrderId,
            grnId,
            supplierReturnId,
            paymentType: paymentType || 'Invoice Payment',
            paymentMethod: paymentMethod || 'Bank Transfer', // Primary/Fall back method description
            amount: parseFloat(amount),
            currency: currency || 'LKR',
            exchangeRate: rate,
            amountInBaseCurrency,
            referenceNumber,
            bankDetails,
            chequeNumber,
            chequeDate,
            bankAccountId,
            supplierAccountDetails,
            dueDate,
            notes,
            attachments,
            locationId,
            createdBy: currentUserId,
            updatedBy: currentUserId
        }, { transaction: t });

        // Handle payment methods
        if (Array.isArray(paymentMethods) && paymentMethods.length > 0) {
            for (const method of paymentMethods) {
                await SupplierPaymentMethod.create({
                    supplierPaymentId: supplierPayment.id,
                    paymentTypeId: method.paymentTypeId,
                    paymentAmount: method.paymentAmount,
                    ledgerAccountId: method.ledgerAccountId || null,
                    referenceNo: method.referenceNo || null,
                    bankId: method.bankId || null,
                    bankBranchId: method.bankBranchId || null,
                    cardType: method.cardType || null,
                    chequeNo: method.chequeNo || null,
                    chequeDate: method.chequeDate || null,
                    isActive: true
                }, { transaction: t });
            }
        }

        // Handle payment GRNs if provided
        if (Array.isArray(paymentGRNs) && paymentGRNs.length > 0) {
            for (const grnPayment of paymentGRNs) {
                const { grnId: paymentGrnId, grnAmount, paidAmount = 0, grnNotes } = grnPayment;

                if (!paymentGrnId || !grnAmount) {
                    throw new Error('Each payment GRN must have grnId and grnAmount');
                }

                // Validate GRN exists
                const grn = await GRN.findByPk(paymentGrnId, { transaction: t });
                if (!grn) {
                    throw new Error(`GRN with ID ${paymentGrnId} not found`);
                }

                // Validate amounts
                const grnAmountValue = parseFloat(grnAmount);
                const paidAmountValue = parseFloat(paidAmount);

                if (grnAmountValue <= 0) {
                    throw new Error(`GRN amount must be greater than 0 for GRN ${paymentGrnId}`);
                }

                if (paidAmountValue < 0 || paidAmountValue > grnAmountValue) {
                    throw new Error(`Paid amount must be between 0 and GRN amount for GRN ${paymentGrnId}`);
                }

                const pendingAmount = grnAmountValue - paidAmountValue;

                // Check if payment GRN already exists
                const existingPaymentGRN = await SupplierPaymentGRN.findOne({
                    where: {
                        supplierPaymentId: supplierPayment.id,
                        grnId: paymentGrnId
                    },
                    transaction: t
                });

                if (existingPaymentGRN) {
                    throw new Error(`Payment GRN already exists for GRN ${paymentGrnId}`);
                }

                // Create payment GRN
                await SupplierPaymentGRN.create({
                    supplierPaymentId: supplierPayment.id,
                    grnId: paymentGrnId,
                    grnAmount: grnAmountValue,
                    paidAmount: paidAmountValue,
                    pendingAmount: pendingAmount,
                    currency: currency || 'LKR',
                    notes: grnNotes || null,
                    createdBy: currentUserId,
                    updatedBy: currentUserId
                }, { transaction: t });
            }
        }

        await t.commit();

        // Fetch the created payment with all associations (outside transaction)
        const createdPayment = await SupplierPayment.findByPk(supplierPayment.id, {
            include: [
                {
                    model: Supplier,
                    as: 'Supplier',
                    attributes: ['id', 'name', 'type']
                },
                {
                    model: User,
                    as: 'Creator',
                    attributes: ['id', 'username']
                },
                {
                    model: SupplierPaymentGRN,
                    as: 'PaymentGRNs',
                    include: [
                        {
                            model: GRN,
                            as: 'GRN',
                            attributes: ['id', 'grnNumber', 'grnDate']
                        }
                    ]
                }
            ]
        });

        res.status(201).json(createdPayment);
    } catch (error) {
        // Only rollback if transaction hasn't been committed yet
        if (!t.finished) {
            await t.rollback();
        }
        console.error('Error creating supplier payment:', error);
        res.status(400).json({ error: error.message });
    }
};

// Get all supplier payments
exports.getSupplierPayments = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            status,
            supplierId,
            locationId,
            paymentType,
            paymentMethod,
            startDate,
            endDate
        } = req.query;
        const offset = (page - 1) * limit;

        const whereClause = {};
        if (status) whereClause.status = status;
        if (supplierId) whereClause.supplierId = supplierId;
        if (locationId) whereClause.locationId = locationId;
        if (paymentType) whereClause.paymentType = paymentType;
        if (paymentMethod) whereClause.paymentMethod = paymentMethod;

        if (startDate && endDate) {
            whereClause.paymentDate = {
                [Op.between]: [new Date(startDate), new Date(endDate)]
            };
        }

        const { count, rows: payments } = await SupplierPayment.findAndCountAll({
            where: whereClause,
            limit: parseInt(limit),
            offset: parseInt(offset),
            include: [
                {
                    model: Supplier,
                    as: 'Supplier',
                    attributes: ['id', 'name', 'type']
                },
                {
                    model: SupplierReturn,
                    as: 'SupplierReturn',
                    attributes: ['id', 'returnNumber', 'returnDate']
                },
                {
                    model: SupplierPaymentGRN,
                    as: 'PaymentGRNs',
                    attributes: ['id', 'grnId', 'grnAmount', 'paidAmount', 'pendingAmount'],
                    include: [
                        {
                            model: GRN,
                            as: 'GRN',
                            attributes: ['id', 'grnNumber', 'grnDate', 'status', 'totalAmount']
                        }
                    ]
                },
                {
                    model: SupplierPaymentMethod,
                    as: 'PaymentMethods',
                    attributes: ['id', 'paymentTypeId', 'paymentAmount', 'ledgerAccountId', 'referenceNo', 'bankId', 'bankBranchId', 'cardType', 'chequeNo', 'chequeDate', 'isActive'],
                    include: [
                        {
                            model: PaymentType,
                            as: 'PaymentType',
                            attributes: ['id', 'paymentTypeName']
                        }
                    ]
                },
                {
                    model: User,
                    as: 'Creator',
                    attributes: ['id', 'username']
                },
                {
                    model: User,
                    as: 'ApprovedByUser',
                    attributes: ['id', 'username']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json({
            payments,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count,
                pages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching supplier payments:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get a single supplier payment by ID
exports.getSupplierPaymentById = async (req, res) => {
    try {
        const supplierPayment = await SupplierPayment.findByPk(req.params.id, {
            include: [
                {
                    model: Supplier,
                    as: 'Supplier',
                    attributes: ['id', 'name', 'type', 'contactPerson', 'phone', 'email', 'address']
                },
                {
                    model: PurchaseOrder,
                    as: 'PurchaseOrder',
                    attributes: ['id', 'orderNumber', 'orderDate', 'totalAmount']
                },
                {
                    model: GRN,
                    as: 'GRN',
                    attributes: ['id', 'grnNumber', 'grnDate']
                },
                {
                    model: SupplierReturn,
                    as: 'SupplierReturn',
                    attributes: ['id', 'returnNumber', 'returnDate', 'totalAmount']
                },
                {
                    model: Location,
                    as: 'Location',
                    attributes: ['id', 'name']
                },
                {
                    model: SupplierPaymentGRN,
                    as: 'PaymentGRNs',
                    include: [
                        {
                            model: GRN,
                            as: 'GRN',
                            attributes: ['id', 'grnNumber', 'grnDate', 'status']
                        }
                    ]
                },
                {
                    model: SupplierPaymentMethod,
                    as: 'PaymentMethods',
                    include: [
                        { model: require('../models/paymentType'), as: 'PaymentType' },
                        { model: require('../models/ledgerAccount'), as: 'LedgerAccount' }
                    ]
                },
                {
                    model: User,
                    as: 'Creator',
                    attributes: ['id', 'username']
                },
                {
                    model: User,
                    as: 'Updater',
                    attributes: ['id', 'username']
                },
                {
                    model: User,
                    as: 'ApprovedByUser',
                    attributes: ['id', 'username']
                },
                {
                    model: User,
                    as: 'ProcessedByUser',
                    attributes: ['id', 'username']
                }
            ]
        });

        if (!supplierPayment) {
            return res.status(404).json({ error: 'Supplier payment not found' });
        }

        res.json(supplierPayment);
    } catch (error) {
        console.error('Error fetching supplier payment:', error);
        res.status(500).json({ error: error.message });
    }
};

// Update a supplier payment
exports.updateSupplierPayment = async (req, res) => {
    const t = await SupplierPayment.sequelize.transaction();
    try {
        const supplierPayment = await SupplierPayment.findByPk(req.params.id, { transaction: t });
        if (!supplierPayment) {
            await t.rollback();
            return res.status(404).json({ error: 'Supplier payment not found' });
        }

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        const { paymentGRNs, paymentMethods, ...updateData } = req.body;

        // Recalculate amount in base currency if amount or exchange rate changed
        if (updateData.amount || updateData.exchangeRate) {
            const amount = updateData.amount || supplierPayment.amount;
            const exchangeRate = updateData.exchangeRate || supplierPayment.exchangeRate;
            updateData.amountInBaseCurrency = parseFloat(amount) * parseFloat(exchangeRate);
        }

        // Validate payment methods sum if provided
        if (Array.isArray(paymentMethods) && paymentMethods.length > 0) {
            const targetAmount = updateData.amount ? parseFloat(updateData.amount) : parseFloat(supplierPayment.amount);
            const totalMethodsAmount = paymentMethods.reduce((sum, pm) => sum + (parseFloat(pm.paymentAmount) || 0), 0);

            if (Math.abs(totalMethodsAmount - targetAmount) > 0.05) {
                await t.rollback();
                return res.status(400).json({
                    error: `Payment methods total (${totalMethodsAmount}) does not match payment amount (${targetAmount})`
                });
            }
        }

        updateData.updatedBy = currentUserId;

        await supplierPayment.update(updateData, { transaction: t });

        // Handle payment methods
        if (Array.isArray(paymentMethods) && paymentMethods.length > 0) {
            // Delete existing payment methods
            await SupplierPaymentMethod.destroy({
                where: { supplierPaymentId: supplierPayment.id },
                transaction: t
            });

            // Create new payment methods
            for (const method of paymentMethods) {
                await SupplierPaymentMethod.create({
                    supplierPaymentId: supplierPayment.id,
                    paymentTypeId: method.paymentTypeId,
                    paymentAmount: method.paymentAmount,
                    ledgerAccountId: method.ledgerAccountId || null,
                    referenceNo: method.referenceNo || null,
                    bankId: method.bankId || null,
                    bankBranchId: method.bankBranchId || null,
                    cardType: method.cardType || null,
                    chequeNo: method.chequeNo || null,
                    chequeDate: method.chequeDate || null,
                    isActive: true
                }, { transaction: t });
            }
        }

        // Handle payment GRNs if provided
        if (Array.isArray(paymentGRNs) && paymentGRNs.length > 0) {
            // Delete existing payment GRNs for this payment
            await SupplierPaymentGRN.destroy({
                where: { supplierPaymentId: supplierPayment.id },
                transaction: t
            });

            // Create new payment GRNs
            for (const grnPayment of paymentGRNs) {
                const { grnId: paymentGrnId, grnAmount, paidAmount = 0, grnNotes } = grnPayment;

                if (!paymentGrnId || !grnAmount) {
                    throw new Error('Each payment GRN must have grnId and grnAmount');
                }

                // Validate GRN exists
                const grn = await GRN.findByPk(paymentGrnId, { transaction: t });
                if (!grn) {
                    throw new Error(`GRN with ID ${paymentGrnId} not found`);
                }

                // Validate amounts
                const grnAmountValue = parseFloat(grnAmount);
                const paidAmountValue = parseFloat(paidAmount);

                if (grnAmountValue <= 0) {
                    throw new Error(`GRN amount must be greater than 0 for GRN ${paymentGrnId}`);
                }

                if (paidAmountValue < 0 || paidAmountValue > grnAmountValue) {
                    throw new Error(`Paid amount must be between 0 and GRN amount for GRN ${paymentGrnId}`);
                }

                const pendingAmount = grnAmountValue - paidAmountValue;

                // Create payment GRN
                await SupplierPaymentGRN.create({
                    supplierPaymentId: supplierPayment.id,
                    grnId: paymentGrnId,
                    grnAmount: grnAmountValue,
                    paidAmount: paidAmountValue,
                    pendingAmount: pendingAmount,
                    currency: updateData.currency || 'LKR',
                    notes: grnNotes || null,
                    createdBy: currentUserId,
                    updatedBy: currentUserId
                }, { transaction: t });
            }
        }

        await t.commit();

        // Fetch updated payment
        const updatedPayment = await SupplierPayment.findByPk(supplierPayment.id, {
            include: [
                {
                    model: Supplier,
                    as: 'Supplier',
                    attributes: ['id', 'name', 'type']
                },
                {
                    model: SupplierPaymentGRN,
                    as: 'PaymentGRNs',
                    include: [
                        {
                            model: GRN,
                            as: 'GRN',
                            attributes: ['id', 'grnNumber', 'grnDate']
                        }
                    ]
                }
            ]
        });

        res.json(updatedPayment);
    } catch (error) {
        if (!t.finished) {
            await t.rollback();
        }
        console.error('Error updating supplier payment:', error);
        res.status(400).json({ error: error.message });
    }
};

// Approve a supplier payment
exports.approveSupplierPayment = async (req, res) => {
    try {
        const { notes } = req.body;
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        const supplierPayment = await SupplierPayment.findByPk(req.params.id);

        if (supplierPayment.status === 'Approved') {
            return res.status(400).json({ error: 'Payment is already approved' });
        }

        const approvedPayment = await supplierPayment.update({
            status: 'Approved',
            approvedBy: currentUserId,
            approvedDate: new Date(),
            notes: notes || supplierPayment.notes,
            updatedBy: currentUserId
        });

        // Insert Transaction Header and Details
        try {
            // Re-fetch payment with associations
            const paymentWithDetails = await SupplierPayment.findByPk(supplierPayment.id, {
                include: [
                    { model: Supplier, as: 'Supplier' },
                    { model: SupplierPaymentMethod, as: 'PaymentMethods' }
                ]
            });

            if (!paymentWithDetails) throw new Error("Payment not found after update");

            const amount = parseFloat(paymentWithDetails.amountInBaseCurrency) || 0;

            if (amount > 0) {
                const transactionDetails = [];
                let lineNumber = 1;

                // 1. Debit Entry: Supplier Liability (Accounts Payable)
                // Use Supplier's Ledger Account or fallback to generic AP
                let debitAccountId = paymentWithDetails.Supplier ? paymentWithDetails.Supplier.ledgerAccountId : null;

                if (!debitAccountId) {
                    const apAccount = await LedgerAccount.findOne({
                        where: {
                            [Op.or]: [
                                { name: { [Op.like]: '%Accounts Payable%' } },
                                { name: { [Op.like]: '%Creditor%' } },
                                { name: { [Op.like]: '%Supplier%' } },
                                { ledgerCode: { [Op.like]: '%AP%' } }
                            ]
                        }
                    });
                    if (apAccount) debitAccountId = apAccount.id;
                }

                if (debitAccountId) {
                    transactionDetails.push({
                        ledgerAccountId: debitAccountId,
                        debitAmount: amount,  // Debit Liability (Decrease)
                        creditAmount: 0,
                        description: `Supplier Payment Approval - ${paymentWithDetails.paymentNumber}`,
                        lineNumber: lineNumber++
                    });
                } else {
                    console.warn(`No Debit Account found for Supplier Payment ${paymentWithDetails.paymentNumber}`);
                }

                // 2. Credit Entry: Payment Method (Cash/Bank)
                // Iterate through payment methods
                if (paymentWithDetails.PaymentMethods && paymentWithDetails.PaymentMethods.length > 0) {
                    for (const method of paymentWithDetails.PaymentMethods) {
                        if (method.ledgerAccountId) {
                            transactionDetails.push({
                                ledgerAccountId: method.ledgerAccountId,
                                debitAmount: 0,
                                creditAmount: parseFloat(method.paymentAmount), // Credit Asset (Decrease)
                                description: `Supplier Payment - ${method.referenceNo || 'Method'}`,
                                lineNumber: lineNumber++
                            });
                        } else {
                            console.warn(`Payment Method ${method.id} missing ledgerAccountId`);
                        }
                    }
                } else {
                    // Fallback to "Cash" or generic if no specific methods (for backward compatibility)
                    const cashAccount = await LedgerAccount.findOne({
                        where: {
                            [Op.or]: [
                                { name: { [Op.like]: '%Cash%' } },
                                { ledgerCode: { [Op.like]: '%CASH%' } }
                            ]
                        }
                    });

                    if (cashAccount) {
                        transactionDetails.push({
                            ledgerAccountId: cashAccount.id,
                            debitAmount: 0,
                            creditAmount: amount,
                            description: `Supplier Payment - Default Cash`,
                            lineNumber: lineNumber++
                        });
                    }
                }

                // Log the transaction
                if (transactionDetails.length > 0) {
                    const totalDebit = transactionDetails.reduce((sum, d) => sum + d.debitAmount, 0);
                    const totalCredit = transactionDetails.reduce((sum, d) => sum + d.creditAmount, 0);

                    // Allow small mismatch due to floating point
                    if (Math.abs(totalDebit - totalCredit) < 1.0) {
                        await TransactionService.logSupplierPaymentTransaction(
                            paymentWithDetails,
                            transactionDetails,
                            currentUserId
                        );
                    } else {
                        console.error('Transaction imbalance for Supplier Payment:', { totalDebit, totalCredit });
                    }
                }
            }

        } catch (txnError) {
            console.error('Failed to log transaction for Supplier Payment:', txnError);
            // We don't rollback the approval, just log the error
        }

        res.json({ message: 'Supplier payment approved successfully', supplierPayment: approvedPayment });
    } catch (error) {
        console.error('Error approving supplier payment:', error);
        res.status(400).json({ error: error.message });
    }
};

// Process a supplier payment
exports.processSupplierPayment = async (req, res) => {
    try {
        const { paidDate, referenceNumber, notes } = req.body;
        const supplierPayment = await SupplierPayment.findByPk(req.params.id);

        if (!supplierPayment) {
            return res.status(404).json({ error: 'Supplier payment not found' });
        }

        if (supplierPayment.status !== 'Approved') {
            return res.status(400).json({ error: 'Payment must be approved before processing' });
        }

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        await supplierPayment.update({
            status: 'Completed',
            processedBy: currentUserId,
            processedDate: new Date(),
            paidDate: paidDate || new Date(),
            referenceNumber: referenceNumber || supplierPayment.referenceNumber,
            notes: notes || supplierPayment.notes,
            updatedBy: currentUserId
        });

        res.json({ message: 'Supplier payment processed successfully', supplierPayment });
    } catch (error) {
        console.error('Error processing supplier payment:', error);
        res.status(400).json({ error: error.message });
    }
};

// Cancel a supplier payment
exports.cancelSupplierPayment = async (req, res) => {
    try {
        const { reason } = req.body;
        const supplierPayment = await SupplierPayment.findByPk(req.params.id);

        if (!supplierPayment) {
            return res.status(404).json({ error: 'Supplier payment not found' });
        }

        if (supplierPayment.status === 'Completed') {
            return res.status(400).json({ error: 'Cannot cancel a completed payment' });
        }

        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        await supplierPayment.update({
            status: 'Cancelled',
            notes: reason || supplierPayment.notes,
            updatedBy: currentUserId
        });

        res.json({ message: 'Supplier payment cancelled successfully', supplierPayment });
    } catch (error) {
        console.error('Error cancelling supplier payment:', error);
        res.status(400).json({ error: error.message });
    }
};

// Delete a supplier payment
exports.deleteSupplierPayment = async (req, res) => {
    try {
        const supplierPayment = await SupplierPayment.findByPk(req.params.id);
        if (!supplierPayment) {
            return res.status(404).json({ error: 'Supplier payment not found' });
        }

        if (supplierPayment.status === 'Completed') {
            return res.status(400).json({ error: 'Cannot delete a completed payment' });
        }

        await supplierPayment.destroy();
        res.json({ message: 'Supplier payment deleted successfully' });
    } catch (error) {
        console.error('Error deleting supplier payment:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get supplier payment statistics
exports.getSupplierPaymentStats = async (req, res) => {
    try {
        const { startDate, endDate, supplierId, locationId } = req.query;

        const whereClause = {};
        if (supplierId) whereClause.supplierId = supplierId;
        if (locationId) whereClause.locationId = locationId;
        if (startDate && endDate) {
            whereClause.paymentDate = {
                [Op.between]: [new Date(startDate), new Date(endDate)]
            };
        }

        const stats = await SupplierPayment.findAll({
            where: whereClause,
            attributes: [
                'status',
                'paymentType',
                [SupplierPayment.sequelize.fn('COUNT', SupplierPayment.sequelize.col('id')), 'count'],
                [SupplierPayment.sequelize.fn('SUM', SupplierPayment.sequelize.col('amountInBaseCurrency')), 'totalAmount']
            ],
            group: ['status', 'paymentType'],
            raw: true
        });

        res.json(stats);
    } catch (error) {
        console.error('Error fetching supplier payment stats:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get outstanding payments (pending/approved)
exports.getOutstandingPayments = async (req, res) => {
    try {
        const { supplierId, locationId } = req.query;

        const whereClause = {
            status: {
                [Op.in]: ['Pending', 'Approved']
            }
        };
        if (supplierId) whereClause.supplierId = supplierId;
        if (locationId) whereClause.locationId = locationId;

        const payments = await SupplierPayment.findAll({
            where: whereClause,
            include: [
                {
                    model: Supplier,
                    as: 'Supplier',
                    attributes: ['id', 'name', 'type']
                }
            ],
            order: [['dueDate', 'ASC']]
        });

        const totalOutstanding = payments.reduce((sum, payment) => sum + parseFloat(payment.amountInBaseCurrency), 0);

        res.json({
            payments,
            totalOutstanding
        });
    } catch (error) {
        console.error('Error fetching outstanding payments:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get outstanding GRNs (GRNs with incomplete payments + unpaid GRNs)
exports.getOutstandingGRNs = async (req, res) => {
    try {
        const { supplierId, locationId } = req.query;

        // 1. Find SupplierPaymentGRNs where pendingAmount > 0 (incomplete payments)
        const whereClause = {
            pendingAmount: {
                [Op.gt]: 0
            }
        };

        const incompletePaymentGRNs = await SupplierPaymentGRN.findAll({
            where: whereClause,
            include: [
                {
                    model: SupplierPayment,
                    as: 'SupplierPayment',
                    attributes: ['id', 'paymentNumber', 'supplierId', 'amount', 'amountInBaseCurrency', 'paymentDate', 'status'],
                    where: supplierId ? { supplierId: supplierId } : undefined,
                    include: [
                        {
                            model: Location,
                            as: 'Location',
                            attributes: ['id', 'name']
                        },
                        {
                            model: Supplier,
                            as: 'Supplier',
                            attributes: ['id', 'name', 'type']
                        }
                    ]
                },
                {
                    model: GRN,
                    as: 'GRN',
                    attributes: ['id', 'grnNumber', 'grnDate', 'status', 'totalAmount']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Filter by location if provided
        let filteredIncompleteGRNs = incompletePaymentGRNs;
        if (locationId) {
            filteredIncompleteGRNs = incompletePaymentGRNs.filter(item =>
                item.SupplierPayment && item.SupplierPayment.Location &&
                item.SupplierPayment.Location.id === parseInt(locationId)
            );
        }

        // 2. Find unpaid GRNs (GRNs with no payment records at all)
        const grnWhereClause = {
            isActive: true,
            totalAmount: {
                [Op.gt]: 0
            }
        };
        if (supplierId) grnWhereClause.supplierId = supplierId;
        if (locationId) grnWhereClause.locationId = locationId;

        // Get all active GRNs
        const allGRNs = await GRN.findAll({
            where: grnWhereClause,
            include: [
                {
                    model: Supplier,
                    as: 'Supplier',
                    attributes: ['id', 'name', 'type']
                }
            ]
        });

        // Get GRN IDs that have payment records
        const grnIdsWithPayments = await SupplierPaymentGRN.findAll({
            attributes: ['grnId'],
            raw: true
        });
        const grnIdsWithPaymentsSet = new Set(grnIdsWithPayments.map(p => p.grnId));

        // Find unpaid GRNs
        const unpaidGRNs = allGRNs.filter(grn => !grnIdsWithPaymentsSet.has(grn.id)).map(grn => ({
            id: null,  // No SupplierPaymentGRN record
            grnAmount: parseFloat(grn.totalAmount) || 0,  // Use GRN's totalAmount
            paidAmount: 0,
            pendingAmount: parseFloat(grn.totalAmount) || 0,  // Total amount is pending
            currency: 'LKR',
            notes: null,
            isUnpaid: true,  // Flag to identify unpaid GRNs
            SupplierPayment: null,
            GRN: {
                id: grn.id,
                grnNumber: grn.grnNumber,
                grnDate: grn.grnDate,
                status: grn.status,
                totalAmount: grn.totalAmount
            },
            Supplier: grn.Supplier,
            Location: grn.Location
        }));

        // 3. Combine both sets
        const allOutstandingGRNs = [
            ...filteredIncompleteGRNs,
            ...unpaidGRNs
        ];

        // Calculate totals (include both incomplete and unpaid GRNs)
        const totalPendingAmount = filteredIncompleteGRNs.reduce((sum, grn) => sum + parseFloat(grn.pendingAmount), 0) +
            unpaidGRNs.reduce((sum, grn) => sum + parseFloat(grn.pendingAmount), 0);
        const totalGRNAmount = filteredIncompleteGRNs.reduce((sum, grn) => sum + parseFloat(grn.grnAmount), 0) +
            unpaidGRNs.reduce((sum, grn) => sum + parseFloat(grn.grnAmount), 0);
        const totalPaidAmount = filteredIncompleteGRNs.reduce((sum, grn) => sum + parseFloat(grn.paidAmount), 0);

        res.json({
            outstandingGRNs: allOutstandingGRNs,
            summary: {
                totalOutstandingGRNs: allOutstandingGRNs.length,
                incompletePaymentGRNs: filteredIncompleteGRNs.length,
                unpaidGRNs: unpaidGRNs.length,
                totalGRNAmount,
                totalPaidAmount,
                totalPendingAmount
            }
        });
    } catch (error) {
        console.error('Error fetching outstanding GRNs:', error);
        res.status(500).json({ error: error.message });
    }
};