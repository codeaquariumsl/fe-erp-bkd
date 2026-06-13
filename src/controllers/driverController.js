const Driver = require('../models/driver');
const User = require('../models/user');
const Role = require('../models/role');
const bcrypt = require('bcryptjs');
const { where } = require('sequelize');

// Create a new driver (and user)
exports.createDriver = async (req, res) => {
    try {
        const { name, mobile, username, password, email, status } = req.body;
        // Ensure driver role exists
        let driverRole = await Role.findOne({ where: { name: 'driver' } });
        if (!driverRole) driverRole = await Role.create({ name: 'driver', description: 'Driver role' });
        // Create user
        const hashedPassword = await bcrypt.hash(password, 10);
        const currentUserId = req.user && req.user.id ? req.user.id : null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }
        const user = await User.create({
            username,
            password: hashedPassword,
            email,
            fullName: name,
            mobile,
            status: status || 'Active',
            roleId: driverRole.id,
            createdBy: currentUserId,
            updatedBy: currentUserId
        });
        // Create driver
        const driver = await Driver.create({
            userId: user.id,
            name,
            mobile,
            status: status || 'Active',
            createdBy: currentUserId,
            updatedBy: currentUserId
        });
        res.status(201).json({ driver, user });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get all drivers
exports.getAllDrivers = async (req, res) => {
    try {
        const drivers = await Driver.findAll({ include: [User] });
        res.json(drivers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get driver by ID
exports.getDriverById = async (req, res) => {
    try {
        const Route = require('../models/route');
        const Vehicle = require('../models/vehicle');

        // Get driver with user info
        const driver = await Driver.findByPk(req.params.id, {
            include: [{ model: User }]
        });

        if (!driver) return res.status(404).json({ error: 'Driver not found' });

        let routeInfo = await Route.findOne({
            where: { driverId: driver.id },
            attributes: ['id', 'routeName', 'vehicleId', 'city', 'startPoint', 'endPoint'],
        });

        let vehicleInfo = await Vehicle.findByPk(routeInfo.vehicleId, {
            attributes: ['id', 'vehicleNumber', 'vehicleType', 'status']
        });

        // Format response
        const response = {
            ...driver.toJSON(),
            route: routeInfo,
            vehicle: vehicleInfo
        };

        res.json(response);
    } catch (error) {
        console.error('Error in getDriverById:', error);
        res.status(500).json({ error: error.message });
    }
};

// Update driver (and user)
exports.updateDriver = async (req, res) => {
    try {
        const data = req.body;
        const driver = await Driver.findByPk(req.params.id);
        if (!driver) return res.status(404).json({ error: 'Driver not found' });
        const currentUserId = req.user && req.user.id ? req.user.id : null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }
        await driver.update({ ...data, updatedBy: currentUserId });
        res.json(driver);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Delete driver (and user)
exports.deleteDriver = async (req, res) => {
    try {
        const driver = await Driver.findByPk(req.params.id);
        if (!driver) return res.status(404).json({ error: 'Driver not found' });
        await User.destroy({ where: { id: driver.userId } });
        await driver.destroy();
        res.json({ message: 'Driver deleted' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
