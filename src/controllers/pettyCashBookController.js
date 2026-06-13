const { PettyCashBook, LedgerAccount, PettyCashCategory } = require('../models');

exports.createBook = async (req, res) => {
    try {
        const { pettyCashCode, name, location, custodian, initialAmount, ledgerAccountId, status } = req.body;
        const book = await PettyCashBook.create({
            pettyCashCode,
            name,
            location,
            custodian,
            initialAmount,
            currentBalance: initialAmount,
            ledgerAccountId,
            status: status || 'Active',
            createdBy: req.user.id
        });
        res.status(201).json(book);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.getBooks = async (req, res) => {
    try {
        const books = await PettyCashBook.findAll({
            include: [{ model: LedgerAccount, as: 'LedgerAccount' }]
        });
        res.json(books);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getBookById = async (req, res) => {
    try {
        const book = await PettyCashBook.findByPk(req.params.id, {
            include: [
                { model: LedgerAccount, as: 'LedgerAccount' },
                { model: PettyCashCategory, as: 'Categories' }
            ]
        });
        if (!book) return res.status(404).json({ error: 'Petty Cash Book not found' });
        res.json(book);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateBook = async (req, res) => {
    try {
        const book = await PettyCashBook.findByPk(req.params.id);
        if (!book) return res.status(404).json({ error: 'Petty Cash Book not found' });

        await book.update({
            ...req.body,
            updatedBy: req.user.id
        });
        res.json(book);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.deleteBook = async (req, res) => {
    try {
        const book = await PettyCashBook.findByPk(req.params.id);
        if (!book) return res.status(404).json({ error: 'Petty Cash Book not found' });

        await book.destroy();
        res.json({ message: 'Petty Cash Book deleted successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
