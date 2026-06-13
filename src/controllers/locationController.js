const Location = require('../models/location');
const User = require('../models/user');

// Create a new location
exports.createLocation = async (req, res) => {
    try {
        const {
            name, code, address, city, state, country, postalCode,
            contactPerson, contactNumber, email, taxNumber, taxRate, isActive
        } = req.body;
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }
        const location = await Location.create({
            name, code, address, city, state, country, postalCode,
            contactPerson, contactNumber, email, taxNumber, taxRate, isActive,
            createdBy: currentUserId,
            updatedBy: currentUserId
        });
        res.status(201).json(location);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get all locations
exports.getLocations = async (req, res) => {
    try {
        const locations = await Location.findAll({
            include: [
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] }
            ]
        });
        // Format response to include creator/updater usernames
        const result = locations.map(loc => {
            const obj = loc.toJSON();
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

// Get a single location by ID
exports.getLocationById = async (req, res) => {
    try {
        const location = await Location.findByPk(req.params.id, {
            include: [
                { model: User, as: 'Creator', attributes: ['id', 'username'] },
                { model: User, as: 'Updater', attributes: ['id', 'username'] }
            ]
        });
        if (!location) return res.status(404).json({ error: 'Location not found' });
        const obj = location.toJSON();
        obj.createdByUsername = obj.Creator ? obj.Creator.username : null;
        obj.updatedByUsername = obj.Updater ? obj.Updater.username : null;
        delete obj.Creator;
        delete obj.Updater;
        res.json(obj);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update a location
exports.updateLocation = async (req, res) => {
    try {
        const {
            name, code, address, city, state, country, postalCode,
            contactPerson, contactNumber, email, taxNumber, taxRate, isActive
        } = req.body;
        const location = await Location.findByPk(req.params.id);
        if (!location) return res.status(404).json({ error: 'Location not found' });
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }
        await location.update({
            name, code, address, city, state, country, postalCode,
            contactPerson, contactNumber, email, taxNumber, taxRate, isActive,
            updatedBy: currentUserId
        });
        res.json(location);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Delete a location
exports.deleteLocation = async (req, res) => {
    try {
        const location = await Location.findByPk(req.params.id);
        if (!location) return res.status(404).json({ error: 'Location not found' });
        await location.destroy();
        res.json({ message: 'Location deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
