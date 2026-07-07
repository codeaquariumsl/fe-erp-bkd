/**
 * TRANSACTION SERVICE
 * 
 * This service handles logging of all financial transactions to transaction_header and transaction_detail tables.
 * Provides audit trail for Bill Entry, Bill Payment, One Payment, and Funds Transfer posting operations.
 */

const { TransactionHeader, TransactionDetail, JournalEntry } = require('../models');

class TransactionService {
    /**
     * Generate unique Transaction Number
     */
    static async generateTransactionNumber() {
        try {
            const lastTransaction = await TransactionHeader.findOne({
                order: [['id', 'DESC']]
            });

            let nextNumber = 1;
            if (lastTransaction && lastTransaction.transactionNumber) {
                try {
                    // Extract number from transactionNumber (format: TXN00000001)
                    const numStr = lastTransaction.transactionNumber.substring(3); // Remove 'TXN' prefix
                    const parsed = parseInt(numStr, 10); // Parse as base 10
                    if (!isNaN(parsed)) {
                        nextNumber = parsed + 1;
                    }
                } catch (parseError) {
                    console.warn('Could not parse last transaction number:', lastTransaction.transactionNumber);
                    // Fall through to default nextNumber = 1
                }
            }

            const transactionNumber = `TXN${String(nextNumber).padStart(8, '0')}`;
            console.log('Generated transaction number:', transactionNumber);
            return transactionNumber;
        } catch (error) {
            console.error('Error generating transaction number:', error.message);
            throw error;
        }
    }

    /**
     * Log Invoice Approval Posting to Transaction Tables
     */
    static async logInvoiceApprovalPosting(invoice, journalEntry, journalLines, userId) {
        try {
            // Validate required data first
            if (!invoice || !invoice.id || !invoice.invoiceNumber) {
                throw new Error('Invalid invoice data: missing id or invoiceNumber');
            }
            if (!journalEntry || !journalEntry.id) {
                throw new Error('Invalid journal entry data: missing id');
            }
            if (!Array.isArray(journalLines) || journalLines.length === 0) {
                throw new Error('Invalid journal lines data: must be non-empty array');
            }

            // Ensure userId is valid
            if (!userId || isNaN(parseInt(userId))) {
                console.warn('Warning: Invalid userId for transaction logging:', userId);
                userId = 1; // Default to system user
            }

            const transactionNumber = await this.generateTransactionNumber();

            // Parse journal lines safely - handle both objects and Sequelize instances
            const journalLinesData = journalLines.map((line, index) => {
                const lineData = line.get ? line.get({ plain: true }) : line;
                return {
                    id: lineData.id || (index + 1),
                    ledgerAccountId: lineData.ledgerAccountId,
                    debitAmount: lineData.debitAmount || 0,
                    creditAmount: lineData.creditAmount || 0,
                    description: lineData.description || ''
                };
            });

            console.log('Parsed journal lines data:', journalLinesData.map((line, idx) => ({
                index: idx,
                ledgerAccountId: line.ledgerAccountId,
                debitAmount: line.debitAmount,
                creditAmount: line.creditAmount
            })));

            // Create transaction header with safe data types and defaults
            const headerData = {
                transactionNumber,
                transactionDate: new Date(),
                transactionModule: 'INVOICE',
                referenceModule: journalEntry.referenceModule || 'SALES',
                referenceNumber: String(invoice.invoiceNumber || '').substring(0, 50),
                referenceId: parseInt(invoice.id) || 0,
                journalEntryId: parseInt(journalEntry.id) || 0,
                totalDebit: parseFloat(journalEntry.totalDebit) || 0.00,
                totalCredit: parseFloat(journalEntry.totalCredit) || 0.00,
                description: `Invoice Approval - ${invoice.invoiceNumber || 'N/A'} to Customer #${invoice.customerId || 0}`,
                status: 'Posted',
                createdBy: parseInt(userId) || 1
            };

            console.log('Creating TransactionHeader with data:', {
                transactionNumber: headerData.transactionNumber,
                status: headerData.status,
                createdBy: headerData.createdBy
            });

            const transactionHeader = await TransactionHeader.create(headerData);

            console.log('Created TransactionHeader ID:', transactionHeader.id);

            if (!transactionHeader.id) {
                throw new Error('TransactionHeader created but has no ID');
            }

            // Create transaction details for each journal line
            const detailsToCreate = [];
            for (let i = 0; i < journalLinesData.length; i++) {
                const line = journalLinesData[i];

                // Validate required fields
                if (!line.ledgerAccountId) {
                    console.warn(`Warning: Journal line ${i} missing ledgerAccountId, skipping`);
                    continue;
                }

                detailsToCreate.push({
                    transactionHeaderId: transactionHeader.id,
                    journalEntryLineId: parseInt(line.id) || 0,
                    ledgerAccountId: parseInt(line.ledgerAccountId),
                    lineNumber: i + 1,
                    debitAmount: parseFloat(line.debitAmount) || 0.00,
                    creditAmount: parseFloat(line.creditAmount) || 0.00,
                    description: String(line.description || '').substring(0, 500),
                    createdBy: parseInt(userId) || 1
                });
            }

            if (detailsToCreate.length === 0) {
                throw new Error('No valid transaction details to log after validation');
            }

            console.log('Creating TransactionDetails:', detailsToCreate.map(d => ({
                transactionHeaderId: d.transactionHeaderId,
                ledgerAccountId: d.ledgerAccountId,
                debitAmount: d.debitAmount,
                creditAmount: d.creditAmount
            })));

            await TransactionDetail.bulkCreate(detailsToCreate);

            console.log('Successfully created', detailsToCreate.length, 'transaction details');

            return transactionHeader;
        } catch (error) {
            console.error('Transaction logging error for invoice:', error.message);
            console.error('Error details:', error);
            throw error;
        }
    }

    /**
     * Log Invoice Transaction (without Journal Entry)
     * Creates TransactionHeader and TransactionDetail records directly
     */
    static async logInvoiceTransaction(invoice, transactionDetails, userId) {
        try {
            // Validate required data first
            if (!invoice || !invoice.id || !invoice.invoiceNumber) {
                throw new Error('Invalid invoice data: missing id or invoiceNumber');
            }
            if (!Array.isArray(transactionDetails) || transactionDetails.length === 0) {
                throw new Error('Invalid transaction details: must be non-empty array');
            }

            // Ensure userId is valid
            if (!userId || isNaN(parseInt(userId))) {
                console.warn('Warning: Invalid userId for transaction logging:', userId);
                userId = 1; // Default to system user
            }

            const transactionNumber = await this.generateTransactionNumber();

            // Calculate totals from transaction details
            const totalDebit = transactionDetails.reduce((sum, detail) => sum + (parseFloat(detail.debitAmount) || 0), 0);
            const totalCredit = transactionDetails.reduce((sum, detail) => sum + (parseFloat(detail.creditAmount) || 0), 0);

            // Create transaction header
            const headerData = {
                transactionNumber,
                transactionDate: new Date(),
                transactionModule: 'INVOICE',
                referenceModule: 'SALES',
                referenceNumber: String(invoice.invoiceNumber || '').substring(0, 50),
                referenceId: parseInt(invoice.id) || 0,
                journalEntryId: null, // No journal entry
                totalDebit: parseFloat(totalDebit.toFixed(2)),
                totalCredit: parseFloat(totalCredit.toFixed(2)),
                description: `Invoice Approval - ${invoice.invoiceNumber || 'N/A'} to Customer #${invoice.customerId || 0}`,
                status: 'Posted',
                createdBy: parseInt(userId) || 1
            };

            console.log('Creating TransactionHeader (no journal entry) with data:', {
                transactionNumber: headerData.transactionNumber,
                totalDebit: headerData.totalDebit,
                totalCredit: headerData.totalCredit,
                status: headerData.status,
                createdBy: headerData.createdBy
            });

            const transactionHeader = await TransactionHeader.create(headerData);

            console.log('Created TransactionHeader ID:', transactionHeader.id);

            if (!transactionHeader.id) {
                throw new Error('TransactionHeader created but has no ID');
            }

            // Create transaction details
            const detailsToCreate = [];
            for (let i = 0; i < transactionDetails.length; i++) {
                const detail = transactionDetails[i];

                // Validate required fields
                if (!detail.ledgerAccountId) {
                    console.warn(`Warning: Transaction detail ${i} missing ledgerAccountId, skipping`);
                    continue;
                }

                detailsToCreate.push({
                    transactionHeaderId: transactionHeader.id,
                    journalEntryLineId: null, // No journal entry line
                    ledgerAccountId: parseInt(detail.ledgerAccountId),
                    lineNumber: detail.lineNumber || (i + 1),
                    debitAmount: parseFloat(detail.debitAmount) || 0.00,
                    creditAmount: parseFloat(detail.creditAmount) || 0.00,
                    description: String(detail.description || '').substring(0, 500),
                    createdBy: parseInt(userId) || 1
                });
            }

            if (detailsToCreate.length === 0) {
                throw new Error('No valid transaction details to log after validation');
            }

            console.log('Creating TransactionDetails:', detailsToCreate.map(d => ({
                transactionHeaderId: d.transactionHeaderId,
                ledgerAccountId: d.ledgerAccountId,
                debitAmount: d.debitAmount,
                creditAmount: d.creditAmount
            })));

            await TransactionDetail.bulkCreate(detailsToCreate);

            console.log('Successfully created', detailsToCreate.length, 'transaction details');

            return transactionHeader;
        } catch (error) {
            console.error('Transaction logging error for invoice:', error.message);
            console.error('Error details:', error);
            throw error;
        }
    }

    /**
     * Log Invoice Cancellation Posting to Transaction Tables
     */
    static async logInvoiceCancellationTransaction(invoice, transactionDetails, userId) {
        try {
            // Validate required data first
            if (!invoice || !invoice.id || !invoice.invoiceNumber) {
                throw new Error('Invalid invoice data: missing id or invoiceNumber');
            }
            if (!Array.isArray(transactionDetails) || transactionDetails.length === 0) {
                throw new Error('Invalid transaction details: must be non-empty array');
            }

            // Ensure userId is valid
            if (!userId || isNaN(parseInt(userId))) {
                console.warn('Warning: Invalid userId for transaction logging:', userId);
                userId = 1; // Default to system user
            }

            const transactionNumber = await this.generateTransactionNumber();

            // Calculate totals from transaction details
            const totalDebit = transactionDetails.reduce((sum, detail) => sum + (parseFloat(detail.debitAmount) || 0), 0);
            const totalCredit = transactionDetails.reduce((sum, detail) => sum + (parseFloat(detail.creditAmount) || 0), 0);

            // Create transaction header
            const headerData = {
                transactionNumber,
                transactionDate: new Date(),
                transactionModule: 'INVOICE',
                referenceModule: 'SALES',
                referenceNumber: String(invoice.invoiceNumber || '').substring(0, 50),
                referenceId: parseInt(invoice.id) || 0,
                journalEntryId: null, // No journal entry
                totalDebit: parseFloat(totalDebit.toFixed(2)),
                totalCredit: parseFloat(totalCredit.toFixed(2)),
                description: `Invoice Cancellation - ${invoice.invoiceNumber || 'N/A'} to Customer #${invoice.customerId || 0}`,
                status: 'Posted',
                createdBy: parseInt(userId) || 1
            };

            console.log('Creating TransactionHeader for cancellation with data:', {
                transactionNumber: headerData.transactionNumber,
                totalDebit: headerData.totalDebit,
                totalCredit: headerData.totalCredit,
                status: headerData.status,
                createdBy: headerData.createdBy
            });

            const transactionHeader = await TransactionHeader.create(headerData);

            if (!transactionHeader.id) {
                throw new Error('TransactionHeader created but has no ID');
            }

            // Create transaction details
            const detailsToCreate = [];
            for (let i = 0; i < transactionDetails.length; i++) {
                const detail = transactionDetails[i];

                if (!detail.ledgerAccountId) {
                    console.warn(`Warning: Transaction detail ${i} missing ledgerAccountId, skipping`);
                    continue;
                }

                detailsToCreate.push({
                    transactionHeaderId: transactionHeader.id,
                    journalEntryLineId: null, // No journal entry line
                    ledgerAccountId: parseInt(detail.ledgerAccountId),
                    lineNumber: detail.lineNumber || (i + 1),
                    debitAmount: parseFloat(detail.debitAmount) || 0.00,
                    creditAmount: parseFloat(detail.creditAmount) || 0.00,
                    description: String(detail.description || '').substring(0, 500),
                    createdBy: parseInt(userId) || 1
                });
            }

            if (detailsToCreate.length === 0) {
                throw new Error('No valid transaction details to log after validation');
            }

            await TransactionDetail.bulkCreate(detailsToCreate);

            console.log('Successfully logged invoice cancellation transaction:', transactionNumber);
            return transactionHeader;
        } catch (error) {
            console.error('Transaction logging error for invoice cancellation:', error.message);
            throw error;
        }
    }

    /**
     * Log Bill Entry Posting to Transaction Tables
     */
    static async logBillEntryPosting(billEntry, journalEntry, journalLines, userId) {
        try {
            const transactionNumber = await this.generateTransactionNumber();

            // Validate required data
            if (!billEntry || !billEntry.id || !billEntry.billNumber) {
                throw new Error('Invalid bill entry data: missing id or billNumber');
            }
            if (!journalEntry || !journalEntry.id) {
                throw new Error('Invalid journal entry data');
            }
            if (!Array.isArray(journalLines) || journalLines.length === 0) {
                throw new Error('Invalid journal lines data');
            }

            // Create transaction header with safe data types
            const transactionHeader = await TransactionHeader.create({
                transactionNumber,
                transactionDate: new Date(),
                transactionModule: 'BILL_ENTRY',
                referenceModule: journalEntry.referenceModule || 'PURCHASE',
                referenceNumber: String(billEntry.billNumber).substring(0, 50),
                referenceId: parseInt(billEntry.id) || null,
                journalEntryId: parseInt(journalEntry.id) || null,
                totalDebit: parseFloat(journalEntry.totalDebit) || 0.00,
                totalCredit: parseFloat(journalEntry.totalCredit) || 0.00,
                description: `Bill Entry Posting - ${billEntry.billNumber} from Supplier #${billEntry.supplierId}`,
                status: 'Posted',
                createdBy: parseInt(userId) || null
            });

            // Create transaction details for each journal line
            const detailsToCreate = [];
            for (let i = 0; i < journalLines.length; i++) {
                const line = journalLines[i];
                detailsToCreate.push({
                    transactionHeaderId: transactionHeader.id,
                    journalEntryLineId: parseInt(line.id) || null,
                    ledgerAccountId: parseInt(line.ledgerAccountId) || null,
                    lineNumber: i + 1,
                    debitAmount: parseFloat(line.debitAmount) || 0.00,
                    creditAmount: parseFloat(line.creditAmount) || 0.00,
                    description: String(line.description).substring(0, 500),
                    createdBy: parseInt(userId) || null
                });
            }

            await TransactionDetail.bulkCreate(detailsToCreate);

            return transactionHeader;
        } catch (error) {
            console.error('Transaction logging error:', error.message);
            throw error;
        }
    }

    /**
     * Log Bill Payment Posting to Transaction Tables
     */
    static async logBillPaymentPosting(billPayment, journalEntry, journalLines, userId) {
        try {
            const transactionNumber = await this.generateTransactionNumber();

            // Validate required data
            if (!billPayment || !billPayment.id || !billPayment.paymentNumber) {
                throw new Error('Invalid bill payment data');
            }
            if (!journalEntry || !journalEntry.id) {
                throw new Error('Invalid journal entry data');
            }
            if (!Array.isArray(journalLines) || journalLines.length === 0) {
                throw new Error('Invalid journal lines data');
            }

            // Create transaction header with safe data types
            const transactionHeader = await TransactionHeader.create({
                transactionNumber,
                transactionDate: new Date(),
                transactionModule: 'BILL_PAYMENT',
                referenceModule: journalEntry.referenceModule || 'PAYMENT',
                referenceNumber: String(billPayment.paymentNumber).substring(0, 50),
                referenceId: parseInt(billPayment.id) || null,
                journalEntryId: parseInt(journalEntry.id) || null,
                totalDebit: parseFloat(journalEntry.totalDebit) || 0.00,
                totalCredit: parseFloat(journalEntry.totalCredit) || 0.00,
                description: `Bill Payment Posting - ${billPayment.paymentNumber} to Supplier #${billPayment.supplierId}`,
                status: 'Posted',
                createdBy: parseInt(userId) || null
            });

            // Create transaction details for each journal line
            const detailsToCreate = [];
            for (let i = 0; i < journalLines.length; i++) {
                const line = journalLines[i];
                detailsToCreate.push({
                    transactionHeaderId: transactionHeader.id,
                    journalEntryLineId: parseInt(line.id) || null,
                    ledgerAccountId: parseInt(line.ledgerAccountId) || null,
                    lineNumber: i + 1,
                    debitAmount: parseFloat(line.debitAmount) || 0.00,
                    creditAmount: parseFloat(line.creditAmount) || 0.00,
                    description: String(line.description).substring(0, 500),
                    createdBy: parseInt(userId) || null
                });
            }

            await TransactionDetail.bulkCreate(detailsToCreate);

            return transactionHeader;
        } catch (error) {
            console.error('Transaction logging error:', error.message);
            throw error;
        }
    }

    /**
     * Log One Payment Posting to Transaction Tables
     */
    static async logOnePaymentPosting(onePayment, journalEntry, journalLines, userId) {
        try {
            const transactionNumber = await this.generateTransactionNumber();

            // Create transaction header with safe data types
            const transactionHeader = await TransactionHeader.create({
                transactionNumber,
                transactionDate: new Date(),
                transactionModule: 'ONE_PAYMENT',
                referenceModule: journalEntry.referenceModule || 'PAYMENT',
                referenceNumber: String(onePayment.paymentNumber).substring(0, 50),
                referenceId: parseInt(onePayment.id) || null,
                journalEntryId: parseInt(journalEntry.id) || null,
                totalDebit: parseFloat(journalEntry.totalDebit) || 0.00,
                totalCredit: parseFloat(journalEntry.totalCredit) || 0.00,
                description: `One Payment Posting - ${onePayment.paymentNumber} to Supplier #${onePayment.supplierId}`,
                status: 'Posted',
                createdBy: parseInt(userId) || null
            });

            // Create transaction details for each journal line
            const detailsToCreate = [];
            for (let i = 0; i < journalLines.length; i++) {
                const line = journalLines[i];
                detailsToCreate.push({
                    transactionHeaderId: transactionHeader.id,
                    journalEntryLineId: parseInt(line.id) || null,
                    ledgerAccountId: parseInt(line.ledgerAccountId) || null,
                    lineNumber: i + 1,
                    debitAmount: parseFloat(line.debitAmount) || 0.00,
                    creditAmount: parseFloat(line.creditAmount) || 0.00,
                    description: String(line.description).substring(0, 500),
                    createdBy: parseInt(userId) || null
                });
            }

            await TransactionDetail.bulkCreate(detailsToCreate);

            return transactionHeader;
        } catch (error) {
            console.error('Transaction logging error:', error.message);
            throw error;
        }
    }

    /**
     * Log Funds Transfer Posting to Transaction Tables
     */
    static async logFundsTransferPosting(fundsTransfer, journalEntry, journalLines, userId) {
        try {
            const transactionNumber = await this.generateTransactionNumber();

            // Create transaction header with safe data types
            const transactionHeader = await TransactionHeader.create({
                transactionNumber,
                transactionDate: new Date(),
                transactionModule: 'FUNDS_TRANSFER',
                referenceModule: journalEntry.referenceModule || 'TRANSFER',
                referenceNumber: String(fundsTransfer.transferNumber).substring(0, 50),
                referenceId: parseInt(fundsTransfer.id) || null,
                journalEntryId: parseInt(journalEntry.id) || null,
                totalDebit: parseFloat(journalEntry.totalDebit) || 0.00,
                totalCredit: parseFloat(journalEntry.totalCredit) || 0.00,
                description: `Funds Transfer Posting - ${fundsTransfer.transferNumber} between bank accounts`,
                status: 'Posted',
                createdBy: parseInt(userId) || null
            });

            // Create transaction details for each journal line
            const detailsToCreate = [];
            for (let i = 0; i < journalLines.length; i++) {
                const line = journalLines[i];
                detailsToCreate.push({
                    transactionHeaderId: transactionHeader.id,
                    journalEntryLineId: parseInt(line.id) || null,
                    ledgerAccountId: parseInt(line.ledgerAccountId) || null,
                    lineNumber: i + 1,
                    debitAmount: parseFloat(line.debitAmount) || 0.00,
                    creditAmount: parseFloat(line.creditAmount) || 0.00,
                    description: String(line.description).substring(0, 500),
                    createdBy: parseInt(userId) || null
                });
            }

            await TransactionDetail.bulkCreate(detailsToCreate);

            return transactionHeader;
        } catch (error) {
            console.error('Transaction logging error:', error.message);
            throw error;
        }
    }

    /**
     * Log Receipt Posting to Transaction Tables
     */
    static async logReceiptPosting(receipt, journalEntry, journalLines, userId) {
        try {
            // Validate required data first
            if (!receipt || !receipt.id || !receipt.receiptNo) {
                throw new Error('Invalid receipt data: missing id or receiptNo');
            }
            if (!journalEntry || !journalEntry.id) {
                throw new Error('Invalid journal entry data: missing id');
            }
            if (!Array.isArray(journalLines) || journalLines.length === 0) {
                throw new Error('Invalid journal lines data: must be non-empty array');
            }

            // Ensure userId is valid
            if (!userId || isNaN(parseInt(userId))) {
                console.warn('Warning: Invalid userId for transaction logging:', userId);
                userId = 1; // Default to system user
            }

            const transactionNumber = await this.generateTransactionNumber();

            // Parse journal lines safely - handle both objects and Sequelize instances
            const journalLinesData = journalLines.map((line, index) => {
                const lineData = line.get ? line.get({ plain: true }) : line;
                return {
                    id: lineData.id || (index + 1),
                    ledgerAccountId: lineData.ledgerAccountId,
                    debitAmount: lineData.debitAmount || 0,
                    creditAmount: lineData.creditAmount || 0,
                    description: lineData.description || ''
                };
            });

            console.log('Parsed journal lines data:', journalLinesData.map((line, idx) => ({
                index: idx,
                ledgerAccountId: line.ledgerAccountId,
                debitAmount: line.debitAmount,
                creditAmount: line.creditAmount
            })));

            // Create transaction header with safe data types and defaults
            const headerData = {
                transactionNumber,
                transactionDate: new Date(),
                transactionModule: 'RECEIPT',
                referenceModule: journalEntry.referenceModule || 'RECEIPT',
                referenceNumber: String(receipt.receiptNo || '').substring(0, 50),
                referenceId: parseInt(receipt.id) || 0,
                journalEntryId: parseInt(journalEntry.id) || 0,
                totalDebit: parseFloat(journalEntry.totalDebit) || 0.00,
                totalCredit: parseFloat(journalEntry.totalCredit) || 0.00,
                description: `Receipt Posting - ${receipt.receiptNo || 'N/A'} from Customer #${receipt.customerId || 0}`,
                status: 'Posted',
                createdBy: parseInt(userId) || 1
            };

            console.log('Creating TransactionHeader with data:', {
                transactionNumber: headerData.transactionNumber,
                status: headerData.status,
                createdBy: headerData.createdBy
            });


            const transactionHeader = await TransactionHeader.create(headerData);

            console.log('Created TransactionHeader ID:', transactionHeader.id);

            if (!transactionHeader.id) {
                throw new Error('TransactionHeader created but has no ID');
            }

            // Create transaction details for each journal line
            const detailsToCreate = [];
            for (let i = 0; i < journalLinesData.length; i++) {
                const line = journalLinesData[i];

                // Validate required fields
                if (!line.ledgerAccountId) {
                    console.warn(`Warning: Journal line ${i} missing ledgerAccountId, skipping`);
                    continue;
                }

                detailsToCreate.push({
                    transactionHeaderId: transactionHeader.id,
                    journalEntryLineId: parseInt(line.id) || 0,
                    ledgerAccountId: parseInt(line.ledgerAccountId),
                    lineNumber: i + 1,
                    debitAmount: parseFloat(line.debitAmount) || 0.00,
                    creditAmount: parseFloat(line.creditAmount) || 0.00,
                    description: String(line.description || '').substring(0, 500),
                    createdBy: parseInt(userId) || 1
                });
            }

            if (detailsToCreate.length === 0) {
                throw new Error('No valid transaction details to log after validation');
            }

            console.log('Creating TransactionDetails:', detailsToCreate.map(d => ({
                transactionHeaderId: d.transactionHeaderId,
                ledgerAccountId: d.ledgerAccountId,
                debitAmount: d.debitAmount,
                creditAmount: d.creditAmount
            })));

            await TransactionDetail.bulkCreate(detailsToCreate);

            console.log('Successfully created', detailsToCreate.length, 'transaction details');

            return transactionHeader;
        } catch (error) {
            console.error('Transaction logging error for receipt:', error.message);
            console.error('Error details:', error);
            throw error;
        }
    }

    /**
     * Log Receipt Transaction (without Journal Entry)
     * Creates TransactionHeader and TransactionDetail records directly
     */
    static async logReceiptTransaction(receipt, transactionDetails, userId) {
        try {
            // Validate required data first
            if (!receipt || !receipt.id || !receipt.receiptNo) {
                throw new Error('Invalid receipt data: missing id or receiptNo');
            }
            if (!Array.isArray(transactionDetails) || transactionDetails.length === 0) {
                throw new Error('Invalid transaction details: must be non-empty array');
            }

            // Ensure userId is valid
            if (!userId || isNaN(parseInt(userId))) {
                console.warn('Warning: Invalid userId for transaction logging:', userId);
                userId = 1; // Default to system user
            }

            const transactionNumber = await this.generateTransactionNumber();

            // Calculate totals from transaction details
            const totalDebit = transactionDetails.reduce((sum, detail) => sum + (parseFloat(detail.debitAmount) || 0), 0);
            const totalCredit = transactionDetails.reduce((sum, detail) => sum + (parseFloat(detail.creditAmount) || 0), 0);

            // Create transaction header
            const headerData = {
                transactionNumber,
                transactionDate: new Date(),
                transactionModule: 'RECEIPT',
                referenceModule: 'RECEIPT',
                referenceNumber: String(receipt.receiptNo || '').substring(0, 50),
                referenceId: parseInt(receipt.id) || 0,
                journalEntryId: null, // No journal entry
                totalDebit: parseFloat(totalDebit.toFixed(2)),
                totalCredit: parseFloat(totalCredit.toFixed(2)),
                description: `Receipt Posting - ${receipt.receiptNo || 'N/A'} from Customer #${receipt.customerId || 0}`,
                status: 'Posted',
                createdBy: parseInt(userId) || 1
            };

            console.log('Creating TransactionHeader (no journal entry) with data:', {
                transactionNumber: headerData.transactionNumber,
                totalDebit: headerData.totalDebit,
                totalCredit: headerData.totalCredit,
                status: headerData.status,
                createdBy: headerData.createdBy
            });

            const transactionHeader = await TransactionHeader.create(headerData);

            console.log('Created TransactionHeader ID:', transactionHeader.id);

            if (!transactionHeader.id) {
                throw new Error('TransactionHeader created but has no ID');
            }

            // Create transaction details
            const detailsToCreate = [];
            for (let i = 0; i < transactionDetails.length; i++) {
                const detail = transactionDetails[i];

                // Validate required fields
                if (!detail.ledgerAccountId) {
                    console.warn(`Warning: Transaction detail ${i} missing ledgerAccountId, skipping`);
                    continue;
                }

                detailsToCreate.push({
                    transactionHeaderId: transactionHeader.id,
                    journalEntryLineId: null, // No journal entry line
                    ledgerAccountId: parseInt(detail.ledgerAccountId),
                    lineNumber: detail.lineNumber || (i + 1),
                    debitAmount: parseFloat(detail.debitAmount) || 0.00,
                    creditAmount: parseFloat(detail.creditAmount) || 0.00,
                    description: String(detail.description || '').substring(0, 500),
                    createdBy: parseInt(userId) || 1
                });
            }

            if (detailsToCreate.length === 0) {
                throw new Error('No valid transaction details to log after validation');
            }

            console.log('Creating TransactionDetails:', detailsToCreate.map(d => ({
                transactionHeaderId: d.transactionHeaderId,
                ledgerAccountId: d.ledgerAccountId,
                debitAmount: d.debitAmount,
                creditAmount: d.creditAmount
            })));

            await TransactionDetail.bulkCreate(detailsToCreate);

            console.log('Successfully created', detailsToCreate.length, 'transaction details');

            return transactionHeader;
        } catch (error) {
            console.error('Transaction logging error for receipt:', error.message);
            console.error('Error details:', error);
            throw error;
        }
    }

    /**
     * Get Transaction by ID with all details
     */
    static async getTransactionWithDetails(transactionHeaderId) {
        try {
            const transaction = await TransactionHeader.findByPk(transactionHeaderId, {
                include: [
                    { model: TransactionDetail, as: 'Details' },
                    { model: JournalEntry, as: 'JournalEntry' }
                ]
            });

            return transaction;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get all transactions for a module
     */
    static async getTransactionsByModule(transactionModule, page = 1, limit = 10) {
        try {
            const offset = (page - 1) * limit;

            const { count, rows } = await TransactionHeader.findAndCountAll({
                where: { transactionModule },
                include: [
                    { model: TransactionDetail, as: 'Details' }
                ],
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['transactionDate', 'DESC'], ['transactionNumber', 'DESC']],
                distinct: true
            });

            return { count, rows };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get transaction audit trail by reference
     */
    static async getTransactionAuditTrail(referenceId, referenceModule) {
        try {
            const transactions = await TransactionHeader.findAll({
                where: {
                    referenceId,
                    transactionModule: referenceModule
                },
                include: [
                    {
                        model: TransactionDetail,
                        as: 'Details',
                        include: [
                            { model: LedgerAccount, as: 'LedgerAccount' }
                        ]
                    }
                ],
                order: [['transactionDate', 'DESC']]
            });

            return transactions;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Log OnePayment Transaction (without Journal Entry)
     * Creates TransactionHeader and TransactionDetail records directly
     */
    static async logOnePaymentTransaction(onePayment, transactionDetails, userId) {
        try {
            // Validate required data first
            if (!onePayment || !onePayment.id || !onePayment.paymentNumber) {
                throw new Error('Invalid one payment data: missing id or paymentNumber');
            }
            if (!Array.isArray(transactionDetails) || transactionDetails.length === 0) {
                throw new Error('Invalid transaction details: must be non-empty array');
            }

            // Ensure userId is valid
            if (!userId || isNaN(parseInt(userId))) {
                console.warn('Warning: Invalid userId for transaction logging:', userId);
                userId = 1; // Default to system user
            }

            const transactionNumber = await this.generateTransactionNumber();

            // Calculate totals from transaction details
            const totalDebit = transactionDetails.reduce((sum, detail) => sum + (parseFloat(detail.debitAmount) || 0), 0);
            const totalCredit = transactionDetails.reduce((sum, detail) => sum + (parseFloat(detail.creditAmount) || 0), 0);

            // Create transaction header
            const headerData = {
                transactionNumber,
                transactionDate: onePayment.paymentDate || new Date(),
                transactionModule: 'ONE_PAYMENT',
                referenceModule: 'PAYMENT',
                referenceNumber: String(onePayment.paymentNumber || '').substring(0, 50),
                referenceId: parseInt(onePayment.id) || 0,
                journalEntryId: null, // No journal entry
                totalDebit: parseFloat(totalDebit.toFixed(2)),
                totalCredit: parseFloat(totalCredit.toFixed(2)),
                description: onePayment.description || `One Payment - ${onePayment.paymentNumber || 'N/A'}`,
                status: 'Posted',
                createdBy: parseInt(userId) || 1
            };

            console.log('Creating TransactionHeader (no journal entry) for OnePayment:', {
                transactionNumber: headerData.transactionNumber,
                totalDebit: headerData.totalDebit,
                totalCredit: headerData.totalCredit,
                status: headerData.status,
                createdBy: headerData.createdBy
            });

            const transactionHeader = await TransactionHeader.create(headerData);

            console.log('Created TransactionHeader ID:', transactionHeader.id);

            if (!transactionHeader.id) {
                throw new Error('TransactionHeader created but has no ID');
            }

            // Create transaction details
            const detailsToCreate = [];
            for (let i = 0; i < transactionDetails.length; i++) {
                const detail = transactionDetails[i];

                // Validate required fields
                if (!detail.ledgerAccountId) {
                    console.warn(`Warning: Transaction detail ${i} missing ledgerAccountId, skipping`);
                    continue;
                }

                detailsToCreate.push({
                    transactionHeaderId: transactionHeader.id,
                    journalEntryLineId: null, // No journal entry line
                    ledgerAccountId: parseInt(detail.ledgerAccountId),
                    lineNumber: detail.lineNumber || (i + 1),
                    debitAmount: parseFloat(detail.debitAmount) || 0.00,
                    creditAmount: parseFloat(detail.creditAmount) || 0.00,
                    description: String(detail.description || '').substring(0, 500),
                    createdBy: parseInt(userId) || 1
                });
            }

            if (detailsToCreate.length === 0) {
                throw new Error('No valid transaction details to log after validation');
            }

            console.log('Creating TransactionDetails:', detailsToCreate.map(d => ({
                transactionHeaderId: d.transactionHeaderId,
                ledgerAccountId: d.ledgerAccountId,
                debitAmount: d.debitAmount,
                creditAmount: d.creditAmount
            })));

            await TransactionDetail.bulkCreate(detailsToCreate);

            console.log('Successfully created', detailsToCreate.length, 'transaction details for OnePayment');


            return transactionHeader;
        } catch (error) {
            console.error('Transaction logging error for one payment:', error.message);
            console.error('Error details:', error);
            throw error;
        }
    }

    /**
     * Log Journal Entry Posting to Transaction Tables
     * Creates TransactionHeader and TransactionDetail records for manual journal entries
     */
    static async logJournalEntryPosting(journalEntry, transactionDetails, userId) {
        try {
            // Validate required data first
            if (!journalEntry || !journalEntry.id || !journalEntry.journalNumber) {
                throw new Error('Invalid journal entry data: missing id or journalNumber');
            }
            if (!Array.isArray(transactionDetails) || transactionDetails.length === 0) {
                throw new Error('Invalid transaction details: must be non-empty array');
            }

            // Ensure userId is valid
            if (!userId || isNaN(parseInt(userId))) {
                console.warn('Warning: Invalid userId for transaction logging:', userId);
                userId = 1; // Default to system user
            }

            const transactionNumber = await this.generateTransactionNumber();

            // Calculate totals from transaction details
            const totalDebit = transactionDetails.reduce((sum, detail) => sum + (parseFloat(detail.debitAmount) || 0), 0);
            const totalCredit = transactionDetails.reduce((sum, detail) => sum + (parseFloat(detail.creditAmount) || 0), 0);

            // Create transaction header
            const headerData = {
                transactionNumber,
                transactionDate: journalEntry.journalDate || new Date(),
                transactionModule: 'JOURNAL_ENTRY',
                referenceModule: journalEntry.referenceModule || 'MANUAL',
                referenceNumber: String(journalEntry.journalNumber || '').substring(0, 50),
                referenceId: parseInt(journalEntry.id) || 0,
                journalEntryId: parseInt(journalEntry.id) || 0,
                totalDebit: parseFloat(totalDebit.toFixed(2)),
                totalCredit: parseFloat(totalCredit.toFixed(2)),
                description: journalEntry.description || `Journal Entry - ${journalEntry.journalNumber || 'N/A'}`,
                status: 'Posted',
                createdBy: parseInt(userId) || 1
            };

            console.log('Creating TransactionHeader for Journal Entry:', {
                transactionNumber: headerData.transactionNumber,
                journalNumber: journalEntry.journalNumber,
                totalDebit: headerData.totalDebit,
                totalCredit: headerData.totalCredit,
                status: headerData.status,
                createdBy: headerData.createdBy
            });

            const transactionHeader = await TransactionHeader.create(headerData);

            console.log('Created TransactionHeader ID:', transactionHeader.id);

            if (!transactionHeader.id) {
                throw new Error('TransactionHeader created but has no ID');
            }

            // Create transaction details
            const detailsToCreate = [];
            for (let i = 0; i < transactionDetails.length; i++) {
                const detail = transactionDetails[i];

                // Validate required fields
                if (!detail.ledgerAccountId) {
                    console.warn(`Warning: Transaction detail ${i} missing ledgerAccountId, skipping`);
                    continue;
                }

                detailsToCreate.push({
                    transactionHeaderId: transactionHeader.id,
                    journalEntryLineId: detail.journalEntryLineId || null,
                    ledgerAccountId: parseInt(detail.ledgerAccountId),
                    lineNumber: detail.lineNumber || (i + 1),
                    debitAmount: parseFloat(detail.debitAmount) || 0.00,
                    creditAmount: parseFloat(detail.creditAmount) || 0.00,
                    description: String(detail.description || '').substring(0, 500),
                    createdBy: parseInt(userId) || 1
                });
            }

            if (detailsToCreate.length === 0) {
                throw new Error('No valid transaction details to log after validation');
            }

            console.log('Creating TransactionDetails for Journal Entry:', detailsToCreate.map(d => ({
                transactionHeaderId: d.transactionHeaderId,
                ledgerAccountId: d.ledgerAccountId,
                debitAmount: d.debitAmount,
                creditAmount: d.creditAmount
            })));

            await TransactionDetail.bulkCreate(detailsToCreate);

            console.log('Successfully created', detailsToCreate.length, 'transaction details for journal entry');

            return transactionHeader;
        } catch (error) {
            console.error('Transaction logging error for journal entry:', error.message);
            console.error('Error details:', error);
            throw error;
        }
    }
    /**
     * Log Bill Entry Transaction (without Journal Entry)
     * Creates TransactionHeader and TransactionDetail records directly
     */
    static async logBillEntryTransaction(billEntry, transactionDetails, userId) {
        try {
            // Validate required data first
            if (!billEntry || !billEntry.id || !billEntry.billNumber) {
                throw new Error('Invalid bill entry data: missing id or billNumber');
            }
            if (!Array.isArray(transactionDetails) || transactionDetails.length === 0) {
                throw new Error('Invalid transaction details: must be non-empty array');
            }

            // Ensure userId is valid
            if (!userId || isNaN(parseInt(userId))) {
                console.warn('Warning: Invalid userId for transaction logging:', userId);
                userId = 1; // Default to system user
            }

            const transactionNumber = await this.generateTransactionNumber();

            // Calculate totals from transaction details
            const totalDebit = transactionDetails.reduce((sum, detail) => sum + (parseFloat(detail.debitAmount) || 0), 0);
            const totalCredit = transactionDetails.reduce((sum, detail) => sum + (parseFloat(detail.creditAmount) || 0), 0);

            // Create transaction header
            const headerData = {
                transactionNumber,
                transactionDate: billEntry.billDate || new Date(),
                transactionModule: 'BILL_ENTRY',
                referenceModule: 'PURCHASE',
                referenceNumber: String(billEntry.billNumber || '').substring(0, 50),
                referenceId: parseInt(billEntry.id) || 0,
                journalEntryId: null, // No journal entry
                totalDebit: parseFloat(totalDebit.toFixed(2)),
                totalCredit: parseFloat(totalCredit.toFixed(2)),
                description: `Bill Entry Posting - ${billEntry.billNumber || 'N/A'} from Supplier #${billEntry.supplierId || 0}`,
                status: 'Posted',
                createdBy: parseInt(userId) || 1
            };

            console.log('Creating TransactionHeader (no journal entry) for BillEntry:', {
                transactionNumber: headerData.transactionNumber,
                totalDebit: headerData.totalDebit,
                totalCredit: headerData.totalCredit,
                status: headerData.status,
                createdBy: headerData.createdBy
            });

            const transactionHeader = await TransactionHeader.create(headerData);

            console.log('Created TransactionHeader ID:', transactionHeader.id);

            if (!transactionHeader.id) {
                throw new Error('TransactionHeader created but has no ID');
            }

            // Create transaction details
            const detailsToCreate = [];
            for (let i = 0; i < transactionDetails.length; i++) {
                const detail = transactionDetails[i];

                // Validate required fields
                if (!detail.ledgerAccountId) {
                    console.warn(`Warning: Transaction detail ${i} missing ledgerAccountId, skipping`);
                    continue;
                }

                detailsToCreate.push({
                    transactionHeaderId: transactionHeader.id,
                    journalEntryLineId: null, // No journal entry line
                    ledgerAccountId: parseInt(detail.ledgerAccountId),
                    lineNumber: detail.lineNumber || (i + 1),
                    debitAmount: parseFloat(detail.debitAmount) || 0.00,
                    creditAmount: parseFloat(detail.creditAmount) || 0.00,
                    description: String(detail.description || '').substring(0, 500),
                    createdBy: parseInt(userId) || 1
                });
            }

            if (detailsToCreate.length === 0) {
                throw new Error('No valid transaction details to log after validation');
            }

            console.log('Creating TransactionDetails for BillEntry:', detailsToCreate.map(d => ({
                transactionHeaderId: d.transactionHeaderId,
                ledgerAccountId: d.ledgerAccountId,
                debitAmount: d.debitAmount,
                creditAmount: d.creditAmount
            })));

            await TransactionDetail.bulkCreate(detailsToCreate);

            console.log('Successfully created', detailsToCreate.length, 'transaction details for BillEntry');

            return transactionHeader;
        } catch (error) {
            console.error('Transaction logging error for bill entry:', error.message);
            console.error('Error details:', error);
            throw error;
        }
    }
    /**
     * Log Bill Payment Transaction (without Journal Entry)
     * Creates TransactionHeader and TransactionDetail records directly
     */
    static async logBillPaymentTransaction(billPayment, transactionDetails, userId) {
        try {
            // Validate required data first
            if (!billPayment || !billPayment.id || !billPayment.paymentNumber) {
                throw new Error('Invalid bill payment data: missing id or paymentNumber');
            }
            if (!Array.isArray(transactionDetails) || transactionDetails.length === 0) {
                throw new Error('Invalid transaction details: must be non-empty array');
            }

            // Ensure userId is valid
            if (!userId || isNaN(parseInt(userId))) {
                console.warn('Warning: Invalid userId for transaction logging:', userId);
                userId = 1; // Default to system user
            }

            const transactionNumber = await this.generateTransactionNumber();

            // Calculate totals from transaction details
            const totalDebit = transactionDetails.reduce((sum, detail) => sum + (parseFloat(detail.debitAmount) || 0), 0);
            const totalCredit = transactionDetails.reduce((sum, detail) => sum + (parseFloat(detail.creditAmount) || 0), 0);

            // Create transaction header
            const headerData = {
                transactionNumber,
                transactionDate: billPayment.paymentDate || new Date(),
                transactionModule: 'BILL_PAYMENT',
                referenceModule: 'PAYMENT',
                referenceNumber: String(billPayment.paymentNumber || '').substring(0, 50),
                referenceId: parseInt(billPayment.id) || 0,
                journalEntryId: null, // No journal entry
                totalDebit: parseFloat(totalDebit.toFixed(2)),
                totalCredit: parseFloat(totalCredit.toFixed(2)),
                description: billPayment.description || `Bill Payment Posting - ${billPayment.paymentNumber || 'N/A'} to Supplier #${billPayment.supplierId || 0}`,
                status: 'Posted',
                createdBy: parseInt(userId) || 1
            };

            console.log('Creating TransactionHeader (no journal entry) for BillPayment:', {
                transactionNumber: headerData.transactionNumber,
                totalDebit: headerData.totalDebit,
                totalCredit: headerData.totalCredit,
                status: headerData.status,
                createdBy: headerData.createdBy
            });

            const transactionHeader = await TransactionHeader.create(headerData);

            console.log('Created TransactionHeader ID:', transactionHeader.id);

            if (!transactionHeader.id) {
                throw new Error('TransactionHeader created but has no ID');
            }

            // Create transaction details
            const detailsToCreate = [];
            for (let i = 0; i < transactionDetails.length; i++) {
                const detail = transactionDetails[i];

                // Validate required fields
                if (!detail.ledgerAccountId) {
                    console.warn(`Warning: Transaction detail ${i} missing ledgerAccountId, skipping`);
                    continue;
                }

                detailsToCreate.push({
                    transactionHeaderId: transactionHeader.id,
                    journalEntryLineId: null, // No journal entry line
                    ledgerAccountId: parseInt(detail.ledgerAccountId),
                    lineNumber: detail.lineNumber || (i + 1),
                    debitAmount: parseFloat(detail.debitAmount) || 0.00,
                    creditAmount: parseFloat(detail.creditAmount) || 0.00,
                    description: String(detail.description || '').substring(0, 500),
                    createdBy: parseInt(userId) || 1
                });
            }

            if (detailsToCreate.length === 0) {
                throw new Error('No valid transaction details to log after validation');
            }

            console.log('Creating TransactionDetails for BillPayment:', detailsToCreate.map(d => ({
                transactionHeaderId: d.transactionHeaderId,
                ledgerAccountId: d.ledgerAccountId,
                debitAmount: d.debitAmount,
                creditAmount: d.creditAmount
            })));

            await TransactionDetail.bulkCreate(detailsToCreate);

            console.log('Successfully created', detailsToCreate.length, 'transaction details for BillPayment');

            return transactionHeader;
        } catch (error) {
            console.error('Transaction logging error for bill payment:', error.message);
            console.error('Error details:', error);
            throw error;
        }
    }

    /**
     * Log Customer Return Transaction (without Journal Entry)
     * Creates TransactionHeader and TransactionDetail records directly
     */
    static async logCustomerReturnTransaction(customerReturn, transactionDetails, userId) {
        try {
            // Validate required data first
            if (!customerReturn || !customerReturn.id || !customerReturn.returnNumber) {
                throw new Error('Invalid customer return data: missing id or returnNumber');
            }
            if (!Array.isArray(transactionDetails) || transactionDetails.length === 0) {
                throw new Error('Invalid transaction details: must be non-empty array');
            }

            // Ensure userId is valid
            if (!userId || isNaN(parseInt(userId))) {
                console.warn('Warning: Invalid userId for transaction logging:', userId);
                userId = 1; // Default to system user
            }

            const transactionNumber = await this.generateTransactionNumber();

            // Calculate totals from transaction details
            const totalDebit = transactionDetails.reduce((sum, detail) => sum + (parseFloat(detail.debitAmount) || 0), 0);
            const totalCredit = transactionDetails.reduce((sum, detail) => sum + (parseFloat(detail.creditAmount) || 0), 0);

            // Create transaction header
            const headerData = {
                transactionNumber,
                transactionDate: new Date(),
                transactionModule: 'CUSTOMER_RETURN',
                referenceModule: 'SALES',
                referenceNumber: String(customerReturn.returnNumber || '').substring(0, 50),
                referenceId: parseInt(customerReturn.id) || 0,
                journalEntryId: null, // No journal entry
                totalDebit: parseFloat(totalDebit.toFixed(2)),
                totalCredit: parseFloat(totalCredit.toFixed(2)),
                description: `Customer Return Approval - ${customerReturn.returnNumber || 'N/A'} from Customer #${customerReturn.customerId || 0}`,
                status: 'Posted',
                createdBy: parseInt(userId) || 1
            };

            console.log('Creating TransactionHeader (no journal entry) for Customer Return:', {
                transactionNumber: headerData.transactionNumber,
                totalDebit: headerData.totalDebit,
                totalCredit: headerData.totalCredit,
                status: headerData.status,
                createdBy: headerData.createdBy
            });

            const transactionHeader = await TransactionHeader.create(headerData);

            console.log('Created TransactionHeader ID:', transactionHeader.id);

            if (!transactionHeader.id) {
                throw new Error('TransactionHeader created but has no ID');
            }

            // Create transaction details
            const detailsToCreate = [];
            for (let i = 0; i < transactionDetails.length; i++) {
                const detail = transactionDetails[i];

                // Validate required fields
                if (!detail.ledgerAccountId) {
                    console.warn(`Warning: Transaction detail ${i} missing ledgerAccountId, skipping`);
                    continue;
                }

                detailsToCreate.push({
                    transactionHeaderId: transactionHeader.id,
                    journalEntryLineId: null, // No journal entry line
                    ledgerAccountId: parseInt(detail.ledgerAccountId),
                    lineNumber: detail.lineNumber || (i + 1),
                    debitAmount: parseFloat(detail.debitAmount) || 0.00,
                    creditAmount: parseFloat(detail.creditAmount) || 0.00,
                    description: String(detail.description || '').substring(0, 500),
                    createdBy: parseInt(userId) || 1
                });
            }

            if (detailsToCreate.length === 0) {
                throw new Error('No valid transaction details to log after validation');
            }

            console.log('Creating TransactionDetails for Customer Return:', detailsToCreate.map(d => ({
                transactionHeaderId: d.transactionHeaderId,
                ledgerAccountId: d.ledgerAccountId,
                debitAmount: d.debitAmount,
                creditAmount: d.creditAmount
            })));

            await TransactionDetail.bulkCreate(detailsToCreate);

            console.log('Successfully created', detailsToCreate.length, 'transaction details for Customer Return');

            return transactionHeader;
        } catch (error) {
            console.error('Transaction logging error for customer return:', error.message);
            console.error('Error details:', error);
            throw error;
        }
    }
    /**
     * Log GRN Transaction (without Journal Entry)
     * Creates TransactionHeader and TransactionDetail records directly
     */
    static async logGRNTransaction(grn, transactionDetails, userId) {
        try {
            // Validate required data first
            if (!grn || !grn.id || !grn.grnNumber) {
                throw new Error('Invalid GRN data: missing id or grnNumber');
            }
            if (!Array.isArray(transactionDetails) || transactionDetails.length === 0) {
                throw new Error('Invalid transaction details: must be non-empty array');
            }

            // Ensure userId is valid
            if (!userId || isNaN(parseInt(userId))) {
                console.warn('Warning: Invalid userId for transaction logging:', userId);
                userId = 1; // Default to system user
            }

            const transactionNumber = await this.generateTransactionNumber();

            // Calculate totals from transaction details
            const totalDebit = transactionDetails.reduce((sum, detail) => sum + (parseFloat(detail.debitAmount) || 0), 0);
            const totalCredit = transactionDetails.reduce((sum, detail) => sum + (parseFloat(detail.creditAmount) || 0), 0);

            // Create transaction header
            const headerData = {
                transactionNumber,
                transactionDate: new Date(),
                transactionModule: 'GRN',
                referenceModule: 'PURCHASE',
                referenceNumber: String(grn.grnNumber || '').substring(0, 50),
                referenceId: parseInt(grn.id) || 0,
                journalEntryId: null, // No journal entry
                totalDebit: parseFloat(totalDebit.toFixed(2)),
                totalCredit: parseFloat(totalCredit.toFixed(2)),
                description: `GRN Approval - ${grn.grnNumber || 'N/A'} from Supplier #${grn.supplierId || 0}`,
                status: 'Posted',
                createdBy: parseInt(userId) || 1
            };

            console.log('Creating TransactionHeader (no journal entry) for GRN:', {
                transactionNumber: headerData.transactionNumber,
                totalDebit: headerData.totalDebit,
                totalCredit: headerData.totalCredit,
                status: headerData.status,
                createdBy: headerData.createdBy
            });

            const transactionHeader = await TransactionHeader.create(headerData);

            console.log('Created TransactionHeader ID:', transactionHeader.id);

            if (!transactionHeader.id) {
                throw new Error('TransactionHeader created but has no ID');
            }

            // Create transaction details
            const detailsToCreate = [];
            for (let i = 0; i < transactionDetails.length; i++) {
                const detail = transactionDetails[i];

                // Validate required fields
                if (!detail.ledgerAccountId) {
                    console.warn(`Warning: Transaction detail ${i} missing ledgerAccountId, skipping`);
                    continue;
                }

                detailsToCreate.push({
                    transactionHeaderId: transactionHeader.id,
                    journalEntryLineId: null, // No journal entry line
                    ledgerAccountId: parseInt(detail.ledgerAccountId),
                    lineNumber: detail.lineNumber || (i + 1),
                    debitAmount: parseFloat(detail.debitAmount) || 0.00,
                    creditAmount: parseFloat(detail.creditAmount) || 0.00,
                    description: String(detail.description || '').substring(0, 500),
                    createdBy: parseInt(userId) || 1
                });
            }

            if (detailsToCreate.length === 0) {
                throw new Error('No valid transaction details to log after validation');
            }

            console.log('Creating TransactionDetails for GRN:', detailsToCreate.map(d => ({
                transactionHeaderId: d.transactionHeaderId,
                ledgerAccountId: d.ledgerAccountId,
                debitAmount: d.debitAmount,
                creditAmount: d.creditAmount
            })));

            await TransactionDetail.bulkCreate(detailsToCreate);

            console.log('Successfully created', detailsToCreate.length, 'transaction details for GRN');

            return transactionHeader;
        } catch (error) {
            console.error('Transaction logging error for GRN:', error.message);
            console.error('Error details:', error);
            throw error;
        }
    }

    /**
     * Log Supplier Payment Transaction
     */
    static async logSupplierPaymentTransaction(payment, transactionDetails, userId) {
        try {
            // Validate required data first
            if (!payment || !payment.id || !payment.paymentNumber) {
                throw new Error('Invalid Payment data: missing id or paymentNumber');
            }
            if (!Array.isArray(transactionDetails) || transactionDetails.length === 0) {
                throw new Error('Invalid transaction details: must be non-empty array');
            }

            // Ensure userId is valid
            if (!userId || isNaN(parseInt(userId))) {
                console.warn('Warning: Invalid userId for transaction logging:', userId);
                userId = 1; // Default to system user
            }

            const transactionNumber = await this.generateTransactionNumber();

            // Calculate totals from transaction details
            const totalDebit = transactionDetails.reduce((sum, detail) => sum + (parseFloat(detail.debitAmount) || 0), 0);
            const totalCredit = transactionDetails.reduce((sum, detail) => sum + (parseFloat(detail.creditAmount) || 0), 0);

            // Create transaction header
            const headerData = {
                transactionNumber,
                transactionDate: new Date(),
                transactionModule: 'SUPPLIER_PAYMENT',
                referenceModule: 'PURCHASE',
                referenceNumber: String(payment.paymentNumber || '').substring(0, 50),
                referenceId: parseInt(payment.id) || 0,
                journalEntryId: null,
                totalDebit: parseFloat(totalDebit.toFixed(2)),
                totalCredit: parseFloat(totalCredit.toFixed(2)),
                description: `Supplier Payment - ${payment.paymentNumber || 'N/A'} for Supplier #${payment.supplierId || 0}`,
                status: 'Posted',
                createdBy: parseInt(userId) || 1
            };

            const transactionHeader = await TransactionHeader.create(headerData);

            if (!transactionHeader.id) {
                throw new Error('TransactionHeader created but has no ID');
            }

            // Create transaction details
            const detailsToCreate = [];
            for (let i = 0; i < transactionDetails.length; i++) {
                const detail = transactionDetails[i];

                if (!detail.ledgerAccountId) {
                    console.warn(`Warning: Transaction detail ${i} missing ledgerAccountId, skipping`);
                    continue;
                }

                detailsToCreate.push({
                    transactionHeaderId: transactionHeader.id,
                    journalEntryLineId: null,
                    ledgerAccountId: parseInt(detail.ledgerAccountId),
                    lineNumber: detail.lineNumber || (i + 1),
                    debitAmount: parseFloat(detail.debitAmount) || 0.00,
                    creditAmount: parseFloat(detail.creditAmount) || 0.00,
                    description: String(detail.description || '').substring(0, 500),
                    createdBy: parseInt(userId) || 1
                });
            }

            if (detailsToCreate.length === 0) {
                throw new Error('No valid transaction details to log after validation');
            }

            await TransactionDetail.bulkCreate(detailsToCreate);

            console.log('Successfully logged Supplier Payment transaction:', transactionNumber);
            return transactionHeader;
        } catch (error) {
            console.error('Transaction logging error for Supplier Payment:', error.message);
            throw error;
        }
    }
    /**
     * Log Funds Transfer Transaction (without Journal Entry)
     * Creates TransactionHeader and TransactionDetail records directly
     */
    static async logFundsTransferTransaction(fundsTransfer, transactionDetails, userId) {
        try {
            // Validate required data first
            if (!fundsTransfer || !fundsTransfer.id || !fundsTransfer.transferNumber) {
                throw new Error('Invalid funds transfer data: missing id or transferNumber');
            }
            if (!Array.isArray(transactionDetails) || transactionDetails.length === 0) {
                throw new Error('Invalid transaction details: must be non-empty array');
            }

            // Ensure userId is valid
            if (!userId || isNaN(parseInt(userId))) {
                console.warn('Warning: Invalid userId for transaction logging:', userId);
                userId = 1; // Default to system user
            }

            const transactionNumber = await this.generateTransactionNumber();

            // Calculate totals from transaction details
            const totalDebit = transactionDetails.reduce((sum, detail) => sum + (parseFloat(detail.debitAmount) || 0), 0);
            const totalCredit = transactionDetails.reduce((sum, detail) => sum + (parseFloat(detail.creditAmount) || 0), 0);

            // Create transaction header
            const headerData = {
                transactionNumber,
                transactionDate: fundsTransfer.transferDate || new Date(),
                transactionModule: 'FUNDS_TRANSFER',
                referenceModule: 'TRANSFER',
                referenceNumber: String(fundsTransfer.transferNumber || '').substring(0, 50),
                referenceId: parseInt(fundsTransfer.id) || 0,
                journalEntryId: null, // No journal entry
                totalDebit: parseFloat(totalDebit.toFixed(2)),
                totalCredit: parseFloat(totalCredit.toFixed(2)),
                description: fundsTransfer.description || `Funds Transfer - ${fundsTransfer.transferNumber || 'N/A'}`,
                status: 'Posted',
                createdBy: parseInt(userId) || 1
            };

            console.log('Creating TransactionHeader (no journal entry) for FundsTransfer:', {
                transactionNumber: headerData.transactionNumber,
                totalDebit: headerData.totalDebit,
                totalCredit: headerData.totalCredit,
                status: headerData.status,
                createdBy: headerData.createdBy
            });

            const transactionHeader = await TransactionHeader.create(headerData);

            console.log('Created TransactionHeader ID:', transactionHeader.id);

            if (!transactionHeader.id) {
                throw new Error('TransactionHeader created but has no ID');
            }

            // Create transaction details
            const detailsToCreate = [];
            for (let i = 0; i < transactionDetails.length; i++) {
                const detail = transactionDetails[i];

                // Validate required fields
                if (!detail.ledgerAccountId) {
                    console.warn(`Warning: Transaction detail ${i} missing ledgerAccountId, skipping`);
                    continue;
                }

                detailsToCreate.push({
                    transactionHeaderId: transactionHeader.id,
                    journalEntryLineId: null, // No journal entry line
                    ledgerAccountId: parseInt(detail.ledgerAccountId),
                    lineNumber: detail.lineNumber || (i + 1),
                    debitAmount: parseFloat(detail.debitAmount) || 0.00,
                    creditAmount: parseFloat(detail.creditAmount) || 0.00,
                    description: String(detail.description || '').substring(0, 500),
                    createdBy: parseInt(userId) || 1
                });
            }

            if (detailsToCreate.length === 0) {
                throw new Error('No valid transaction details to log after validation');
            }

            console.log('Creating TransactionDetails for FundsTransfer:', detailsToCreate.map(d => ({
                transactionHeaderId: d.transactionHeaderId,
                ledgerAccountId: d.ledgerAccountId,
                debitAmount: d.debitAmount,
                creditAmount: d.creditAmount
            })));

            await TransactionDetail.bulkCreate(detailsToCreate);

            console.log('Successfully created', detailsToCreate.length, 'transaction details for FundsTransfer');

            return transactionHeader;
        } catch (error) {
            console.error('Transaction logging error for funds transfer:', error.message);
            console.error('Error details:', error);
            throw error;
        }
    }

    /**
     * Log Petty Cash Payment Transaction (without Journal Entry)
     * Creates TransactionHeader and TransactionDetail records directly
     */
    static async logPettyCashPaymentTransaction(pettyCashPayment, transactionDetails, userId) {
        try {
            // Validate required data first
            if (!pettyCashPayment || !pettyCashPayment.id || !pettyCashPayment.paymentNumber) {
                throw new Error('Invalid petty cash payment data: missing id or paymentNumber');
            }
            if (!Array.isArray(transactionDetails) || transactionDetails.length === 0) {
                throw new Error('Invalid transaction details: must be non-empty array');
            }

            // Ensure userId is valid
            if (!userId || isNaN(parseInt(userId))) {
                console.warn('Warning: Invalid userId for transaction logging:', userId);
                userId = 1; // Default to system user
            }

            const transactionNumber = await this.generateTransactionNumber();

            // Calculate totals from transaction details
            const totalDebit = transactionDetails.reduce((sum, detail) => sum + (parseFloat(detail.debitAmount) || 0), 0);
            const totalCredit = transactionDetails.reduce((sum, detail) => sum + (parseFloat(detail.creditAmount) || 0), 0);

            // Create transaction header
            const headerData = {
                transactionNumber,
                transactionDate: pettyCashPayment.paymentDate || new Date(),
                transactionModule: 'PETTY_CASH_PAYMENT',
                referenceModule: 'PETTY_CASH',
                referenceNumber: String(pettyCashPayment.paymentNumber || '').substring(0, 50),
                referenceId: parseInt(pettyCashPayment.id) || 0,
                journalEntryId: null, // No journal entry
                totalDebit: parseFloat(totalDebit.toFixed(2)),
                totalCredit: parseFloat(totalCredit.toFixed(2)),
                description: pettyCashPayment.description || `Petty Cash Payment - ${pettyCashPayment.paymentNumber || 'N/A'}`,
                status: 'Posted',
                createdBy: parseInt(userId) || 1
            };

            console.log('Creating TransactionHeader (no journal entry) for PettyCashPayment:', {
                transactionNumber: headerData.transactionNumber,
                totalDebit: headerData.totalDebit,
                totalCredit: headerData.totalCredit,
                status: headerData.status,
                createdBy: headerData.createdBy
            });

            const transactionHeader = await TransactionHeader.create(headerData);

            console.log('Created TransactionHeader ID:', transactionHeader.id);

            if (!transactionHeader.id) {
                throw new Error('TransactionHeader created but has no ID');
            }

            // Create transaction details
            const detailsToCreate = [];
            for (let i = 0; i < transactionDetails.length; i++) {
                const detail = transactionDetails[i];

                // Validate required fields
                if (!detail.ledgerAccountId) {
                    console.warn(`Warning: Transaction detail ${i} missing ledgerAccountId, skipping`);
                    continue;
                }

                detailsToCreate.push({
                    transactionHeaderId: transactionHeader.id,
                    journalEntryLineId: null, // No journal entry line
                    ledgerAccountId: parseInt(detail.ledgerAccountId),
                    lineNumber: detail.lineNumber || (i + 1),
                    debitAmount: parseFloat(detail.debitAmount) || 0.00,
                    creditAmount: parseFloat(detail.creditAmount) || 0.00,
                    description: String(detail.description || '').substring(0, 500),
                    createdBy: parseInt(userId) || 1
                });
            }

            if (detailsToCreate.length === 0) {
                throw new Error('No valid transaction details to log after validation');
            }

            console.log('Creating TransactionDetails for PettyCashPayment:', detailsToCreate.map(d => ({
                transactionHeaderId: d.transactionHeaderId,
                ledgerAccountId: d.ledgerAccountId,
                debitAmount: d.debitAmount,
                creditAmount: d.creditAmount
            })));

            await TransactionDetail.bulkCreate(detailsToCreate);

            console.log('Successfully created', detailsToCreate.length, 'transaction details for PettyCashPayment');

            return transactionHeader;
        } catch (error) {
            console.error('Transaction logging error for petty cash payment:', error.message);
            console.error('Error details:', error);
            throw error;
        }
    }
    /**
     * Log Petty Cash Reimbursement Transaction
     */
    static async logPettyCashReimbursementTransaction(reimbursement, transactionDetails, userId) {
        try {
            if (!reimbursement || !reimbursement.id || !reimbursement.reimbursementNumber) {
                throw new Error('Invalid reimbursement data');
            }
            if (!Array.isArray(transactionDetails) || transactionDetails.length === 0) {
                throw new Error('Invalid transaction details');
            }

            const transactionNumber = await this.generateTransactionNumber();

            const totalDebit = transactionDetails.reduce((sum, detail) => sum + (parseFloat(detail.debitAmount) || 0), 0);
            const totalCredit = transactionDetails.reduce((sum, detail) => sum + (parseFloat(detail.creditAmount) || 0), 0);

            const transactionHeader = await TransactionHeader.create({
                transactionNumber,
                transactionDate: reimbursement.reimbursementDate || new Date(),
                transactionModule: 'PETTY_CASH_REIMBURSEMENT',
                referenceModule: 'PETTY_CASH',
                referenceNumber: reimbursement.reimbursementNumber,
                referenceId: reimbursement.id,
                totalDebit: parseFloat(totalDebit.toFixed(2)),
                totalCredit: parseFloat(totalCredit.toFixed(2)),
                description: reimbursement.description || `Petty Cash Reimbursement - ${reimbursement.reimbursementNumber}`,
                status: 'Posted',
                createdBy: userId || 1
            });

            const detailsToCreate = transactionDetails.map((detail, index) => ({
                transactionHeaderId: transactionHeader.id,
                ledgerAccountId: detail.ledgerAccountId,
                lineNumber: detail.lineNumber || (index + 1),
                debitAmount: parseFloat(detail.debitAmount) || 0.00,
                creditAmount: parseFloat(detail.creditAmount) || 0.00,
                description: detail.description || `Reimbursement Detail - ${reimbursement.reimbursementNumber}`,
                createdBy: userId || 1
            }));

            await TransactionDetail.bulkCreate(detailsToCreate);

            return transactionHeader;
        } catch (error) {
            console.error('Transaction logging error for petty cash reimbursement:', error);
            throw error;
        }
    }

    /**
     * Log Bank Deposit Transaction (without Journal Entry)
     * Creates TransactionHeader and TransactionDetail records directly
     */
    static async logBankDepositTransaction(bankDeposit, transactionDetails, userId) {
        try {
            // Validate required data first
            if (!bankDeposit || !bankDeposit.id || !bankDeposit.depositNumber) {
                throw new Error('Invalid bank deposit data: missing id or depositNumber');
            }
            if (!Array.isArray(transactionDetails) || transactionDetails.length === 0) {
                throw new Error('Invalid transaction details: must be non-empty array');
            }

            // Ensure userId is valid
            if (!userId || isNaN(parseInt(userId))) {
                console.warn('Warning: Invalid userId for transaction logging:', userId);
                userId = 1; // Default to system user
            }

            const transactionNumber = await this.generateTransactionNumber();

            // Calculate totals from transaction details
            const totalDebit = transactionDetails.reduce((sum, detail) => sum + (parseFloat(detail.debitAmount) || 0), 0);
            const totalCredit = transactionDetails.reduce((sum, detail) => sum + (parseFloat(detail.creditAmount) || 0), 0);

            // Create transaction header
            const headerData = {
                transactionNumber,
                transactionDate: bankDeposit.depositDate || new Date(),
                transactionModule: 'BANK_DEPOSIT',
                referenceModule: 'BANK',
                referenceNumber: String(bankDeposit.depositNumber || '').substring(0, 50),
                referenceId: parseInt(bankDeposit.id) || 0,
                journalEntryId: null, // No journal entry
                totalDebit: parseFloat(totalDebit.toFixed(2)),
                totalCredit: parseFloat(totalCredit.toFixed(2)),
                description: bankDeposit.description || `Bank Deposit - ${bankDeposit.depositNumber || 'N/A'}`,
                status: 'Posted',
                createdBy: parseInt(userId) || 1
            };

            const transactionHeader = await TransactionHeader.create(headerData);

            if (!transactionHeader.id) {
                throw new Error('TransactionHeader created but has no ID');
            }

            // Create transaction details
            const detailsToCreate = [];
            for (let i = 0; i < transactionDetails.length; i++) {
                const detail = transactionDetails[i];

                if (!detail.ledgerAccountId) {
                    console.warn(`Warning: Transaction detail ${i} missing ledgerAccountId, skipping`);
                    continue;
                }

                detailsToCreate.push({
                    transactionHeaderId: transactionHeader.id,
                    journalEntryLineId: null, // No journal entry line
                    ledgerAccountId: parseInt(detail.ledgerAccountId),
                    lineNumber: detail.lineNumber || (i + 1),
                    debitAmount: parseFloat(detail.debitAmount) || 0.00,
                    creditAmount: parseFloat(detail.creditAmount) || 0.00,
                    description: String(detail.description || '').substring(0, 500),
                    createdBy: parseInt(userId) || 1
                });
            }

            if (detailsToCreate.length === 0) {
                throw new Error('No valid transaction details to log after validation');
            }

            await TransactionDetail.bulkCreate(detailsToCreate);

            console.log('Successfully logged Bank Deposit transaction:', transactionNumber);
            return transactionHeader;
        } catch (error) {
            console.error('Transaction logging error for bank deposit:', error.message);
            throw error;
        }
    }
}
module.exports = TransactionService;

