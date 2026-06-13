const Category = require('../models/category');
const User = require('../models/user');
const { generateDocumentNumber } = require('./documentControllerClient');

// Create a new category
exports.createCategory = async (req, res) => {
    try {
        const { name, superCategoryId, image, locationId } = req.body;
        const code = await generateDocumentNumber('CAT', locationId);
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }
        const category = await Category.create({
            name, code, superCategoryId, isActive: true, image, locationId,
            createdBy: currentUserId,
            updatedBy: currentUserId
        });
        res.status(201).json(category);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get all categories with creator/updater usernames
exports.getCategories = async (req, res) => {
    try {
        const categories = await Category.findAll({
            include: [
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] }
            ]
        });
        // Format response to include creator/updater usernames
        const result = categories.map(cat => {
            const obj = cat.toJSON();
            obj.createdByUsername = obj.Creator ? obj.Creator.username : null;
            obj.updatedByUsername = obj.Updater ? obj.Updater.username : null;
            delete obj.Creator;
            delete obj.Updater;
            return obj;
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get a single category by ID with creator/updater usernames
exports.getCategoryById = async (req, res) => {
    try {
        const category = await Category.findByPk(req.params.id, {
            include: [
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] }
            ]
        });
        if (!category) return res.status(404).json({ error: 'Category not found' });
        const obj = category.toJSON();
        obj.createdByUsername = obj.Creator ? obj.Creator.username : null;
        obj.updatedByUsername = obj.Updater ? obj.Updater.username : null;
        delete obj.Creator;
        delete obj.Updater;
        res.json(obj);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update a category
exports.updateCategory = async (req, res) => {
    try {
        const { name, code, superCategoryId, isActive, image } = req.body;
        const category = await Category.findByPk(req.params.id);
        if (!category) return res.status(404).json({ error: 'Category not found' });
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }
        await category.update({ name, code, superCategoryId, isActive, image, updatedBy: currentUserId });
        res.json(category);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Delete a category
exports.deleteCategory = async (req, res) => {
    try {
        const category = await Category.findByPk(req.params.id);
        if (!category) return res.status(404).json({ error: 'Category not found' });
        await category.destroy();
        res.json({ message: 'Category deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
