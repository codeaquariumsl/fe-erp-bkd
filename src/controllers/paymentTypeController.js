const PaymentType = require('../models/paymentType');
const User = require('../models/user');

// Create a new payment type
exports.createPaymentType = async (req, res) => {
    try {
        const {
            paymentTypeName, description
        } = req.body;
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }
        const paymentType = await PaymentType.create({
            paymentTypeName, description,
            createdBy: currentUserId,
            updatedBy: currentUserId
        });
        res.status(201).json(paymentType);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get all payment types
exports.getPaymentTypes = async (req, res) => {
    try {
        const paymentTypes = await PaymentType.findAll({
            include: [
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] }
            ]
        });
        // Format response to include creator/updater usernames
        const result = paymentTypes.map(paymentType => {
            const obj = paymentType.toJSON();
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

// Get a single payment type by ID
exports.getPaymentTypeById = async (req, res) => {
    try {
        const paymentType = await PaymentType.findByPk(req.params.id, {
            include: [
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] }
            ]
        });
        if (!paymentType) return res.status(404).json({ error: 'Payment type not found' });
        const obj = paymentType.toJSON();
        obj.createdByUsername = obj.Creator ? obj.Creator.username : null;
        obj.updatedByUsername = obj.Updater ? obj.Updater.username : null;
        delete obj.Creator;
        delete obj.Updater;
        res.json(obj);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update a payment type
exports.updatePaymentType = async (req, res) => {
    try {
        const {
            paymentTypeName, description
        } = req.body;
        const paymentType = await PaymentType.findByPk(req.params.id);
        if (!paymentType) return res.status(404).json({ error: 'Payment type not found' });
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }
        await paymentType.update({
            paymentTypeName, description,
            updatedBy: currentUserId
        });
        res.json(paymentType);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Delete a payment type
exports.deletePaymentType = async (req, res) => {
    try {
        const paymentType = await PaymentType.findByPk(req.params.id);
        if (!paymentType) return res.status(404).json({ error: 'Payment type not found' });
        await paymentType.destroy();
        res.json({ message: 'Payment type deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
