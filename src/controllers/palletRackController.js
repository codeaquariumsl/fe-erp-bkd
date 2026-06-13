const PalletRack = require('../models/palletRack');
const Pallet = require('../models/pallet');

exports.createPalletRack = async (req, res) => {
    try {
        const { code, capacity, coldRoomId, status } = req.body;
        const rack = await PalletRack.create({ code, capacity, coldRoomId, status });
        res.status(201).json(rack);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.listPalletRacks = async (req, res) => {
    try {
        const GRNItem = require('../models/grnItem');
        const Item = require('../models/item');

        const GRN = require('../models/grn');
        
        const racks = await PalletRack.findAll({
            include: [{
                model: GRNItem,
                as: 'GRNItems',  // This should match the alias in the association
                attributes: ['id', 'itemId', 'grnId', 'grnQty', 'availableQty'],
                include: [
                    {
                        model: Item,
                        attributes: ['id', 'name', 'sku', 'color', 'country']
                    },
                    {
                        model: GRN,
                        attributes: ['id', 'grnNumber', 'grnDate']
                    }
                ]
            }],
            order: [
                ['id', 'ASC'],
                ['GRNItems', 'id', 'ASC']
            ]
        });

        // Transform the response to include item summary
        const formattedRacks = racks.map(rack => {
            const rackData = rack.toJSON();
            
            // Group items by itemId to show unique items with total quantities
            const itemSummary = {};
            rackData.GRNItems?.forEach(grnItem => {
                const itemId = grnItem.itemId;
                if (!itemSummary[itemId]) {
                    itemSummary[itemId] = {
                        itemId: itemId,
                        itemName: grnItem.Item?.name,
                        itemSku: grnItem.Item?.sku,
                        color: grnItem.Item?.color,
                        country: grnItem.Item?.country,
                        totalQty: 0,
                        totalAvailableQty: 0,
                        grnItems: [],
                        grns: new Set() // To track unique GRN numbers
                    };
                }
                itemSummary[itemId].totalQty += grnItem.grnQty || 0;
                itemSummary[itemId].totalAvailableQty += grnItem.availableQty || 0;
                // Add GRN information to the item
                const grnInfo = {
                    ...grnItem,
                    grnNumber: grnItem.GRN?.grnNumber,
                    grnDate: grnItem.GRN?.grnDate
                };
                itemSummary[itemId].grnItems.push(grnInfo);
                if (grnItem.GRN) {
                    itemSummary[itemId].grns.add(grnItem.GRN.grnNumber);
                }
            });

            // Convert Set to Array for grns before returning
            const formattedItemSummary = Object.values(itemSummary).map(item => ({
                ...item,
                grns: Array.from(item.grns)
            }));

            return {
                ...rackData,
                itemSummary: formattedItemSummary,
                totalItems: Object.keys(itemSummary).length,
                totalQuantity: Object.values(itemSummary).reduce((sum, item) => sum + item.totalQty, 0),
                totalAvailableQuantity: Object.values(itemSummary).reduce((sum, item) => sum + item.totalAvailableQty, 0),
                totalGRNs: Object.values(itemSummary).reduce((sum, item) => sum + item.grns.size, 0),
                utilization: rackData.capacity ? 
                    Math.round((Object.values(itemSummary).reduce((sum, item) => sum + item.totalQty, 0) / rackData.capacity) * 100) : 0
            };
        });

        res.json(formattedRacks);
    } catch (error) {
        console.error('Error in listPalletRacks:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getPalletRack = async (req, res) => {
    try {
        const rack = await PalletRack.findByPk(req.params.id);
        if (!rack) return res.status(404).json({ error: 'Pallet rack not found' });
        res.json(rack);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updatePalletRack = async (req, res) => {
    try {
        const rack = await PalletRack.findByPk(req.params.id);
        if (!rack) return res.status(404).json({ error: 'Pallet rack not found' });
        await rack.update(req.body);
        res.json(rack);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.deletePalletRack = async (req, res) => {
    try {
        const rack = await PalletRack.findByPk(req.params.id);
        if (!rack) return res.status(404).json({ error: 'Pallet rack not found' });
        await rack.destroy();
        res.json({ message: 'Pallet rack deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
