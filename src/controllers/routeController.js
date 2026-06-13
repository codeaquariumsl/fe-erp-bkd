const Route = require('../models/route');
const Vehicle = require('../models/vehicle');

// Create a new route
exports.createRoute = async (req, res) => {
    try {
        const { routeName, description, city, startPoint, endPoint, distanceKm, estimateTime, status, vehicleId, driverId, customerIds, days, locationId } = req.body;
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }
        
        // Validate customerIds and days arrays if provided
        let validatedCustomerIds = null;
        let validatedDays = null;
        
        if (customerIds) {
            if (Array.isArray(customerIds)) {
                validatedCustomerIds = customerIds.filter(id => id !== null && id !== undefined);
            } else {
                return res.status(400).json({ error: 'customerIds must be an array' });
            }
        }
        
        if (days) {
            if (Array.isArray(days)) {
                const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                validatedDays = days.filter(day => validDays.includes(day));
                if (validatedDays.length !== days.length) {
                    return res.status(400).json({ 
                        error: 'Invalid days provided. Valid days are: ' + validDays.join(', ') 
                    });
                }
            } else {
                return res.status(400).json({ error: 'days must be an array' });
            }
        }
        
        const route = await Route.create({
            routeName, description, city, startPoint, endPoint, distanceKm, estimateTime, status,
            vehicleId, driverId, customerIds: validatedCustomerIds, days: validatedDays,
            locationId: locationId,
            createdBy: currentUserId,
            updatedBy: currentUserId
        });
        
        const result = await Route.findByPk(route.id, { include: Vehicle });
        res.status(201).json(result);
    } catch (error) {
        // Handle different types of errors with meaningful messages
        if (error.name === 'SequelizeUniqueConstraintError') {
            const field = error.errors[0].path;
            const value = error.errors[0].value;
            
            let message = '';
            switch (field) {
                case 'routeName':
                    message = `Route name '${value}' already exists. Please choose a different route name.`;
                    break;
                default:
                    message = `${field} '${value}' already exists. Please use a different value.`;
            }
            
            return res.status(400).json({
                error: 'Duplicate Entry',
                field: field,
                message: message
            });
        }
        
        // Handle validation errors
        if (error.name === 'SequelizeValidationError') {
            const validationErrors = error.errors.map(err => ({
                field: err.path,
                message: err.message
            }));
            
            return res.status(400).json({
                error: 'Validation Error',
                details: validationErrors
            });
        }
        
        // Handle foreign key constraint errors
        if (error.name === 'SequelizeForeignKeyConstraintError') {
            let message = 'Invalid reference: ';
            if (error.fields.includes('vehicleId')) {
                message += 'The specified vehicle does not exist.';
            } else if (error.fields.includes('driverId')) {
                message += 'The specified driver does not exist.';
            } else {
                message += 'One or more referenced records do not exist.';
            }
            
            return res.status(400).json({
                error: 'Reference Error',
                message: message,
                field: error.fields.join(', ')
            });
        }

        // Log unexpected errors for debugging
        console.error('Route creation error:', error);
        
        // Generic error response for unexpected errors
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'An unexpected error occurred while creating the route.',
            // details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get all routes
exports.getRoutes = async (req, res) => {
    try {
        const routes = await Route.findAll({ include: [Vehicle, { model: require('../models/user'), as: 'createdByUser', attributes: ['id', 'username'] }, { model: require('../models/user'), as: 'updatedByUser', attributes: ['id', 'username'] }] });
        // Add vehicle, driver, and customer details if present
        const User = require('../models/user');
        const Driver = require('../models/driver');
        const Customer = require('../models/customer');
        const VehicleModel = require('../models/vehicle');
        const routesWithDetails = await Promise.all(routes.map(async route => {
            const routeObj = route.toJSON();
            routeObj.createdByUsername = routeObj.createdByUser ? routeObj.createdByUser.username : null;
            routeObj.updatedByUsername = routeObj.updatedByUser ? routeObj.updatedByUser.username : null;
            delete routeObj.createdByUser;
            delete routeObj.updatedByUser;
            
            // Add vehicle details if vehicleId exists
            if (routeObj.vehicleId) {
                const vehicle = await VehicleModel.findByPk(routeObj.vehicleId);
                routeObj.vehicle = vehicle ? vehicle.toJSON() : null;
            }
            
            // Add driver details if driverId exists
            if (routeObj.driverId) {
                const driver = await Driver.findByPk(routeObj.driverId);
                routeObj.driver = driver ? driver.toJSON() : null;
            }
            
            // Add customer details if customerIds exist
            if (routeObj.customerIds && Array.isArray(routeObj.customerIds) && routeObj.customerIds.length > 0) {
                try {
                    const customers = await Customer.findAll({
                        where: { id: routeObj.customerIds },
                        attributes: ['id', 'name', 'email', 'contactNumber', 'address']
                    });
                    routeObj.customers = customers.map(customer => customer.toJSON());
                } catch (customerError) {
                    console.warn('Error fetching customers for route:', routeObj.id, customerError.message);
                    routeObj.customers = [];
                }
            } else {
                routeObj.customers = [];
            }
            
            return routeObj;
        }));
        res.json(routesWithDetails);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get a single route by ID
exports.getRouteById = async (req, res) => {
    try {
        const route = await Route.findByPk(req.params.id, { include: [Vehicle, { model: require('../models/user'), as: 'createdByUser', attributes: ['id', 'username'] }, { model: require('../models/user'), as: 'updatedByUser', attributes: ['id', 'username'] }] });
        if (!route) return res.status(404).json({ error: 'Route not found' });
        
        const User = require('../models/user');
        const Driver = require('../models/driver');
        const Customer = require('../models/customer');
        const VehicleModel = require('../models/vehicle');
        const routeObj = route.toJSON();
        routeObj.createdByUsername = routeObj.createdByUser ? routeObj.createdByUser.username : null;
        routeObj.updatedByUsername = routeObj.updatedByUser ? routeObj.updatedByUser.username : null;
        delete routeObj.createdByUser;
        delete routeObj.updatedByUser;
        
        // Add vehicle details if vehicleId exists
        if (routeObj.vehicleId) {
            const vehicle = await VehicleModel.findByPk(routeObj.vehicleId);
            routeObj.vehicle = vehicle ? vehicle.toJSON() : null;
        }
        
        // Add driver details if driverId exists
        if (routeObj.driverId) {
            const driver = await Driver.findByPk(routeObj.driverId);
            routeObj.driver = driver ? driver.toJSON() : null;
        }
        
        // Add customer details if customerIds exist
        if (routeObj.customerIds && Array.isArray(routeObj.customerIds) && routeObj.customerIds.length > 0) {
            try {
                const customers = await Customer.findAll({
                    where: { id: routeObj.customerIds },
                    attributes: ['id', 'name', 'email', 'contactNumber', 'address']
                });
                routeObj.customers = customers.map(customer => customer.toJSON());
            } catch (customerError) {
                console.warn('Error fetching customers for route:', routeObj.id, customerError.message);
                routeObj.customers = [];
            }
        } else {
            routeObj.customers = [];
        }
        
        res.json(routeObj);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update a route
exports.updateRoute = async (req, res) => {
    try {
        const { routeName, description, city, startPoint, endPoint, distanceKm, estimateTime, vehicleId, driverId, status, vehicleIds, customerIds, days } = req.body;
        const route = await Route.findByPk(req.params.id);
        if (!route) return res.status(404).json({ error: 'Route not found' });
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }
        
        // Validate customerIds and days arrays if provided
        let validatedCustomerIds = undefined;
        let validatedDays = undefined;
        
        if (customerIds !== undefined) {
            if (customerIds === null) {
                validatedCustomerIds = null;
            } else if (Array.isArray(customerIds)) {
                validatedCustomerIds = customerIds.filter(id => id !== null && id !== undefined);
            } else {
                return res.status(400).json({ error: 'customerIds must be an array or null' });
            }
        }
        
        if (days !== undefined) {
            if (days === null) {
                validatedDays = null;
            } else if (Array.isArray(days)) {
                const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                validatedDays = days.filter(day => validDays.includes(day));
                if (validatedDays.length !== days.length) {
                    return res.status(400).json({ 
                        error: 'Invalid days provided. Valid days are: ' + validDays.join(', ') 
                    });
                }
            } else {
                return res.status(400).json({ error: 'days must be an array or null' });
            }
        }
        
        const updateData = { 
            routeName, description, city, startPoint, endPoint, distanceKm, estimateTime, vehicleId, driverId, status,
            updatedBy: currentUserId 
        };
        
        // Only update customerIds and days if they were provided in the request
        if (validatedCustomerIds !== undefined) {
            updateData.customerIds = validatedCustomerIds;
        }
        if (validatedDays !== undefined) {
            updateData.days = validatedDays;
        }
        
        await route.update(updateData);
        
        if (vehicleIds && Array.isArray(vehicleIds)) {
            await route.setVehicles(vehicleIds);
        }
        const result = await Route.findByPk(route.id, { include: Vehicle });
        res.json(result);
    } catch (error) {
        // Handle different types of errors with meaningful messages
        if (error.name === 'SequelizeUniqueConstraintError') {
            const field = error.errors[0].path;
            const value = error.errors[0].value;
            
            let message = '';
            switch (field) {
                case 'routeName':
                    message = `Route name '${value}' already exists. Please choose a different route name.`;
                    break;
                default:
                    message = `${field} '${value}' already exists. Please use a different value.`;
            }
            
            return res.status(400).json({
                error: 'Duplicate Entry',
                field: field,
                message: message
            });
        }
        
        // Handle validation errors
        if (error.name === 'SequelizeValidationError') {
            const validationErrors = error.errors.map(err => ({
                field: err.path,
                message: err.message
            }));
            
            return res.status(400).json({
                error: 'Validation Error',
                details: validationErrors
            });
        }
        
        // Handle foreign key constraint errors
        if (error.name === 'SequelizeForeignKeyConstraintError') {
            let message = 'Invalid reference: ';
            if (error.fields.includes('vehicleId')) {
                message += 'The specified vehicle does not exist.';
            } else if (error.fields.includes('driverId')) {
                message += 'The specified driver does not exist.';
            } else {
                message += 'One or more referenced records do not exist.';
            }
            
            return res.status(400).json({
                error: 'Reference Error',
                message: message,
                field: error.fields.join(', ')
            });
        }

        // Log unexpected errors for debugging
        console.error('Route update error:', error);
        
        // Generic error response for unexpected errors
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'An unexpected error occurred while updating the route.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Delete a route
exports.deleteRoute = async (req, res) => {
    try {
        const route = await Route.findByPk(req.params.id);
        if (!route) return res.status(404).json({ error: 'Route not found' });
        await route.destroy();
        res.json({ message: 'Route deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
