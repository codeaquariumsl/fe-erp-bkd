// Get cold rooms for a store with available racks
exports.getStoreColdRoomsWithRacks = async (req, res) => {
    try {
        const coldRooms = await ColdRoom.findAll({
            where: { storeId: req.params.storeId },
            include: [
                {
                    model: PalletRack,
                    as: 'PalletRacks',
                    attributes: ['id', 'code', 'capacity', 'occupied', 'availableQty'],
                    where: { availableQty: 0 } // Only include racks with availableQty = 0
                },
                { model: Store, attributes: ['id', 'name'] }
            ]
        });
        const result = coldRooms.map(room => ({
            ...room.toJSON(),
            store: room.Store ? { id: room.Store.id, name: room.Store.name } : null,
            availableRacks: (room.PalletRacks || []).map(rack => ({
                id: rack.id,
                code: rack.code,
                capacity: rack.capacity,
                occupied: rack.occupied,
                available: rack.availableQty,
                store: room.Store ? { id: room.Store.id, name: room.Store.name } : null
            }))
        }));
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
const ColdRoom = require('../models/coldRoom');
const ColdRoomItem = require('../models/coldRoomItem');
const ColdRoomLog = require('../models/coldRoomLog');
const Store = require('../models/store');
const PalletRack = require('../models/palletRack');

// List cold rooms with status, items, and maintenance info
exports.listColdRooms = async (req, res) => {
    try {
        const coldRooms = await ColdRoom.findAll({
            where: { status: 'active' },
            include: [
                { model: ColdRoomItem, attributes: ['name', 'quantity', 'unit'] },
                { model: Store, attributes: ['id', 'name'] },
                { model: PalletRack, as: 'PalletRacks', attributes: ['id', 'code', 'capacity', 'occupied', 'availableQty'] }
            ]
        });
        // Map available rack spaces for each cold room
        const result = coldRooms.map(room => {
            const racks = room.PalletRacks || [];
            const availableRacks = racks.map(rack => ({
                id: rack.id,
                code: rack.code,
                capacity: rack.capacity,
                occupied: rack.occupied,
                available: rack.availableQty
            }));
            return {
                ...room.toJSON(),
                availableRacks
            };
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get recent temperature logs
exports.listColdRoomLogs = async (req, res) => {
    try {
        const logs = await ColdRoomLog.findAll({
            include: [{ model: ColdRoom, attributes: ['name'] }],
            order: [['timestamp', 'DESC']],
            limit: 50
        });
        res.json(logs.map(log => ({
            timestamp: log.timestamp,
            coldRoomName: log.ColdRoom ? log.ColdRoom.name : null,
            temperature: log.temperature,
            humidity: log.humidity,
            status: log.status
        })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Optionally: view details, update settings, trigger maintenance
exports.getColdRoom = async (req, res) => {
    try {
        const coldRoom = await ColdRoom.findByPk(req.params.id, {
            include: [
                { model: ColdRoomItem, attributes: ['name', 'quantity', 'unit'] },
                { model: Store, attributes: ['id', 'name'] },
                { model: PalletRack, as: 'PalletRacks', attributes: ['id', 'code', 'capacity', 'occupied'] }
            ]
        });
        if (!coldRoom) return res.status(404).json({ error: 'Cold room not found' });
        const racks = coldRoom.PalletRacks || [];
        const availableRacks = racks.map(rack => ({
            id: rack.id,
            code: rack.code,
            capacity: rack.capacity,
            occupied: rack.occupied,
            available: rack.capacity - (rack.occupied || 0)
        }));
        res.json({ ...coldRoom.toJSON(), availableRacks });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateColdRoomSettings = async (req, res) => {
    try {
        const { targetTemp, targetHumidity, nextMaintenance } = req.body;
        const coldRoom = await ColdRoom.findByPk(req.params.id);
        if (!coldRoom) return res.status(404).json({ error: 'Cold room not found' });
        await coldRoom.update({ targetTemp, targetHumidity, nextMaintenance });
        res.json(coldRoom);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.triggerMaintenance = async (req, res) => {
    try {
        const coldRoom = await ColdRoom.findByPk(req.params.id);
        if (!coldRoom) return res.status(404).json({ error: 'Cold room not found' });
        await coldRoom.update({ lastMaintenance: new Date(), nextMaintenance: null });
        res.json({ message: 'Maintenance triggered', coldRoom });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create a new cold room
exports.createColdRoom = async (req, res) => {
    try {
        const { name, temperature, targetTemp, humidity, targetHumidity, capacity, occupied, status, lastMaintenance, nextMaintenance, storeId } = req.body;
        // If storeId is provided, check if it exists
        if (storeId) {
            const store = await Store.findByPk(storeId);
            if (!store) {
                return res.status(400).json({ error: 'Store not found for provided storeId' });
            }
        }
        const coldRoom = await ColdRoom.create({ name, temperature, targetTemp, humidity, targetHumidity, capacity, occupied, status, lastMaintenance, nextMaintenance, storeId });
        res.status(201).json(coldRoom);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Add item to cold room
exports.addColdRoomItem = async (req, res) => {
    try {
        const { coldRoomId, name, quantity, unit } = req.body;
        const item = await ColdRoomItem.create({ coldRoomId, name, quantity, unit });
        res.status(201).json(item);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Log temperature/humidity for a cold room
exports.createColdRoomLog = async (req, res) => {
    try {
        const { coldRoomId, timestamp, temperature, humidity, status } = req.body;
        const log = await ColdRoomLog.create({ coldRoomId, timestamp, temperature, humidity, status });
        res.status(201).json(log);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Update cold room
exports.updateColdRoom = async (req, res) => {
    try {
        const coldRoom = await ColdRoom.findByPk(req.params.id);
        if (!coldRoom) return res.status(404).json({ error: 'Cold room not found' });
        await coldRoom.update(req.body);
        res.json(coldRoom);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Delete cold room
exports.deleteColdRoom = async (req, res) => {
    try {
        const coldRoom = await ColdRoom.findByPk(req.params.id);
        if (!coldRoom) return res.status(404).json({ error: 'Cold room not found' });
        await coldRoom.destroy();
        res.json({ message: 'Cold room deleted' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Delete cold room item
exports.deleteColdRoomItem = async (req, res) => {
    try {
        const item = await ColdRoomItem.findByPk(req.params.id);
        if (!item) return res.status(404).json({ error: 'Cold room item not found' });
        await item.destroy();
        res.json({ message: 'Cold room item deleted' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Delete cold room log
exports.deleteColdRoomLog = async (req, res) => {
    try {
        const log = await ColdRoomLog.findByPk(req.params.id);
        if (!log) return res.status(404).json({ error: 'Cold room log not found' });
        await log.destroy();
        res.json({ message: 'Cold room log deleted' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
