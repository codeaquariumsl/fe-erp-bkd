const TimeSlot = require('../models/timeSlot');
const { sequelize } = require('../models');

// Create a new TimeSlot
exports.createTimeSlot = async (req, res) => {
    try {
        const { timeslot, isBulk = false, isSpecial = false } = req.body;
        
        // Check if timeslot already exists
        const existingTimeSlot = await TimeSlot.findOne({ 
            where: { timeslot, isActive: true } 
        });
        
        if (existingTimeSlot) {
            return res.status(400).json({ error: 'Time slot already exists' });
        }

        const timeSlot = await TimeSlot.create({
            timeslot,
            isBulk,
            isSpecial,
            isActive: true
        });

        res.status(201).json(timeSlot);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get all TimeSlots
exports.getAllTimeSlots = async (req, res) => {
    try {
        const { includeInactive = false } = req.query;
        
        const whereClause = includeInactive === 'true' ? {} : { isActive: true };
        
        const timeSlots = await TimeSlot.findAll({
            where: whereClause,
            order: [['timeslot', 'ASC']]
        });

        res.json(timeSlots);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get TimeSlots by type
exports.getTimeSlotsByType = async (req, res) => {
    try {
        const { type } = req.params; // 'bulk', 'special', or 'regular'
        let whereClause = { isActive: true };

        switch (type) {
            case 'bulk':
                whereClause.isBulk = true;
                break;
            case 'special':
                whereClause.isSpecial = true;
                break;
            case 'regular':
                whereClause.isBulk = false;
                whereClause.isSpecial = false;
                break;
            default:
                return res.status(400).json({ error: 'Invalid type. Use bulk, special, or regular' });
        }

        const timeSlots = await TimeSlot.findAll({
            where: whereClause,
            order: [['timeslot', 'ASC']]
        });

        res.json(timeSlots);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get a single TimeSlot by ID
exports.getTimeSlotById = async (req, res) => {
    try {
        const timeSlot = await TimeSlot.findByPk(req.params.id);
        if (!timeSlot) {
            return res.status(404).json({ error: 'Time slot not found' });
        }
        res.json(timeSlot);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update a TimeSlot
exports.updateTimeSlot = async (req, res) => {
    try {
        const { timeslot, isBulk, isSpecial, isActive } = req.body;
        
        const timeSlot = await TimeSlot.findByPk(req.params.id);
        if (!timeSlot) {
            return res.status(404).json({ error: 'Time slot not found' });
        }

        // Check if new timeslot value conflicts with existing records
        if (timeslot && timeslot !== timeSlot.timeslot) {
            const existingTimeSlot = await TimeSlot.findOne({ 
                where: { 
                    timeslot, 
                    isActive: true,
                    id: { [require('sequelize').Op.ne]: req.params.id }
                } 
            });
            
            if (existingTimeSlot) {
                return res.status(400).json({ error: 'Time slot already exists' });
            }
        }

        await timeSlot.update({
            ...(timeslot !== undefined && { timeslot }),
            ...(isBulk !== undefined && { isBulk }),
            ...(isSpecial !== undefined && { isSpecial }),
            ...(isActive !== undefined && { isActive })
        });

        res.json(timeSlot);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Soft delete a TimeSlot (set isActive to false)
exports.deleteTimeSlot = async (req, res) => {
    try {
        const timeSlot = await TimeSlot.findByPk(req.params.id);
        if (!timeSlot) {
            return res.status(404).json({ error: 'Time slot not found' });
        }

        await timeSlot.update({ isActive: false });
        res.json({ message: 'Time slot deactivated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Hard delete a TimeSlot (permanent deletion)
exports.permanentDeleteTimeSlot = async (req, res) => {
    try {
        const timeSlot = await TimeSlot.findByPk(req.params.id);
        if (!timeSlot) {
            return res.status(404).json({ error: 'Time slot not found' });
        }

        await timeSlot.destroy();
        res.json({ message: 'Time slot permanently deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Restore a deactivated TimeSlot
exports.restoreTimeSlot = async (req, res) => {
    try {
        const timeSlot = await TimeSlot.findByPk(req.params.id);
        if (!timeSlot) {
            return res.status(404).json({ error: 'Time slot not found' });
        }

        if (timeSlot.isActive) {
            return res.status(400).json({ error: 'Time slot is already active' });
        }

        // Check if timeslot conflicts with existing active records
        const existingTimeSlot = await TimeSlot.findOne({ 
            where: { 
                timeslot: timeSlot.timeslot, 
                isActive: true,
                id: { [require('sequelize').Op.ne]: req.params.id }
            } 
        });
        
        if (existingTimeSlot) {
            return res.status(400).json({ error: 'Cannot restore: Time slot already exists with same value' });
        }

        await timeSlot.update({ isActive: true });
        res.json({ message: 'Time slot restored successfully', timeSlot });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
