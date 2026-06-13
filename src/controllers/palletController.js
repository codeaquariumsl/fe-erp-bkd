const Pallet = require('../models/pallet');
const PalletRack = require('../models/palletRack');

exports.createPallet = async (req, res) => {
    try {
        const { palletRackId, itemId, quantity, unit } = req.body;
        const rack = await PalletRack.findByPk(palletRackId);
        if (!rack) return res.status(404).json({ error: 'Pallet rack not found' });
        if (rack.occupied + 1 > rack.capacity) {
            return res.status(400).json({ error: 'Rack is full' });
        }
        const pallet = await Pallet.create({ palletRackId, itemId, quantity, unit });
        await rack.update({ occupied: rack.occupied + 1 });
        res.status(201).json(pallet);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.listPallets = async (req, res) => {
    try {
        const pallets = await Pallet.findAll();
        res.json(pallets);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getPallet = async (req, res) => {
    try {
        const pallet = await Pallet.findByPk(req.params.id);
        if (!pallet) return res.status(404).json({ error: 'Pallet not found' });
        res.json(pallet);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updatePallet = async (req, res) => {
    try {
        const pallet = await Pallet.findByPk(req.params.id);
        if (!pallet) return res.status(404).json({ error: 'Pallet not found' });
        await pallet.update(req.body);
        res.json(pallet);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.deletePallet = async (req, res) => {
    try {
        const pallet = await Pallet.findByPk(req.params.id);
        if (!pallet) return res.status(404).json({ error: 'Pallet not found' });
        const rack = await PalletRack.findByPk(pallet.palletRackId);
        await pallet.destroy();
        if (rack && rack.occupied > 0) {
            await rack.update({ occupied: rack.occupied - 1 });
        }
        res.json({ message: 'Pallet deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
