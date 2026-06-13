const Vehicle = require('../models/vehicle');
const Route = require('../models/route');

// Create a new vehicle
exports.createVehicle = async (req, res) => {
    try {
        const { vehicleNumber, vehicleType, capacityKg, driverName, contactNumber, status, routeIds, locationId } = req.body;
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }
        const vehicle = await Vehicle.create({
            vehicleNumber,
            vehicleType,
            capacityKg,
            driverName,
            contactNumber,
            status,
            locationId,
            createdBy: currentUserId,
            updatedBy: currentUserId
        });
        if (routeIds && Array.isArray(routeIds)) {
            await vehicle.setRoutes(routeIds);
        }
        const result = await Vehicle.findByPk(vehicle.id, { include: Route });
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get all vehicles
exports.getVehicles = async (req, res) => {
    try {
        const vehicles = await Vehicle.findAll({ include: [{ model: require('../models/user'), as: 'createdByUser', attributes: ['id', 'username'] }, { model: require('../models/user'), as: 'updatedByUser', attributes: ['id', 'username'] }] });
        const vehiclesWithUsernames = vehicles.map(vehicle => {
            const vehicleObj = vehicle.toJSON();
            vehicleObj.createdByUsername = vehicleObj.createdByUser ? vehicleObj.createdByUser.username : null;
            vehicleObj.updatedByUsername = vehicleObj.updatedByUser ? vehicleObj.updatedByUser.username : null;
            delete vehicleObj.createdByUser;
            delete vehicleObj.updatedByUser;
            return vehicleObj;
        });
        res.json(vehiclesWithUsernames);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get a single vehicle by ID
exports.getVehicleById = async (req, res) => {
    try {
        const vehicle = await Vehicle.findByPk(req.params.id, { include: [{ model: require('../models/user'), as: 'createdByUser', attributes: ['id', 'username'] }, { model: require('../models/user'), as: 'updatedByUser', attributes: ['id', 'username'] }] });
        if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
        const vehicleObj = vehicle.toJSON();
        vehicleObj.createdByUsername = vehicleObj.createdByUser ? vehicleObj.createdByUser.username : null;
        vehicleObj.updatedByUsername = vehicleObj.updatedByUser ? vehicleObj.updatedByUser.username : null;
        delete vehicleObj.createdByUser;
        delete vehicleObj.updatedByUser;
        res.json(vehicleObj);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update a vehicle
exports.updateVehicle = async (req, res) => {
    try {
        const { vehicleNumber, vehicleType, capacityKg, driverName, contactNumber, status, routeIds } = req.body;
        const vehicle = await Vehicle.findByPk(req.params.id);
        if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }
        await vehicle.update({ vehicleNumber, vehicleType, capacityKg, driverName, contactNumber, status, updatedBy: currentUserId });
        if (routeIds && Array.isArray(routeIds)) {
            await vehicle.setRoutes(routeIds);
        }
        const result = await Vehicle.findByPk(vehicle.id, { include: Route });
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Delete a vehicle
exports.deleteVehicle = async (req, res) => {
    try {
        const vehicle = await Vehicle.findByPk(req.params.id);
        if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
        await vehicle.destroy();
        res.json({ message: 'Vehicle deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
