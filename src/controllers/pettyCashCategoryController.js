const { PettyCashCategory, LedgerAccount } = require('../models');

exports.createCategory = async (req, res) => {
    try {
        const { name, description, ledgerAccountId, status } = req.body;
        const category = await PettyCashCategory.create({
            name,
            description,
            ledgerAccountId,
            status: status || 'Active',
            createdBy: req.user.id
        });
        res.status(201).json(category);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.getCategories = async (req, res) => {
    try {
        const categories = await PettyCashCategory.findAll({
            include: [{ model: LedgerAccount, as: 'LedgerAccount' }]
        });
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getCategoryById = async (req, res) => {
    try {
        const category = await PettyCashCategory.findByPk(req.params.id, {
            include: [{ model: LedgerAccount, as: 'LedgerAccount' }]
        });
        if (!category) return res.status(404).json({ error: 'Category not found' });
        res.json(category);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const category = await PettyCashCategory.findByPk(req.params.id);
        if (!category) return res.status(404).json({ error: 'Category not found' });

        await category.update({
            ...req.body,
            updatedBy: req.user.id
        });
        res.json(category);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        const category = await PettyCashCategory.findByPk(req.params.id);
        if (!category) return res.status(404).json({ error: 'Category not found' });

        await category.destroy();
        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
