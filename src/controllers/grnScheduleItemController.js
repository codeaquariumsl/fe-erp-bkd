const GRNScheduleItem = require('../models/grnScheduleItem');
const Item = require('../models/item');
const GRN = require('../models/grn');
const { sequelize, Customer, Category } = require('../models');

// Create a new GRNScheduleItem
exports.createGRNScheduleItem = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { scheduleDate, type, customerId = null, itemId, grn1Id, grn2Id, grn3Id, price } = req.body;
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            await t.rollback();
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        // Check for existing records with same date and item, and make them inactive
        await GRNScheduleItem.update(
            { isActive: false, updatedBy: currentUserId },
            {
                where: {
                    scheduleDate,
                    itemId,
                    type,
                    customerId,
                    isActive: true
                },
                transaction: t
            }
        );

        const scheduleItem = await GRNScheduleItem.create({
            scheduleDate,
            type,
            customerId,
            itemId,
            grn1Id,
            grn2Id: grn2Id === '' ? null : grn2Id,
            grn3Id: grn3Id === '' ? null : grn3Id,
            price,
            isActive: true,
            createdBy: currentUserId,
            updatedBy: currentUserId
        }, { transaction: t });

        await t.commit();
        res.status(201).json(scheduleItem);
    } catch (error) {
        await t.rollback();
        res.status(400).json({ error: error.message });
    }
};

// Get all GRNScheduleItems
exports.getGRNScheduleItems = async (req, res) => {
    try {
        const User = require('../models/user');
        const items = await GRNScheduleItem.findAll({
            where: {
                isActive: true
            },
            include: [
                Item, 
                Customer,
                { model: GRN, as: 'GRN1' },
                { model: GRN, as: 'GRN2' },
                { model: GRN, as: 'GRN3' }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Get unique user IDs from the schedule items
        const userIds = [...new Set(items.map(item => item.createdBy).filter(Boolean))];

        // Fetch user information for all unique user IDs
        const users = userIds.length > 0 ? await User.findAll({
            where: { id: userIds },
            attributes: ['id', 'username', 'fullName']
        }) : [];

        // Create a user map for quick lookup
        const userMap = {};
        users.forEach(user => {
            userMap[user.id] = {
                username: user.username,
                fullName: user.fullName
            };
        });

        // Transform the response to include created user name
        const transformedItems = items.map(item => {
            const itemData = item.toJSON();
            const user = userMap[itemData.createdBy];
            itemData.createdUserName = user ? user.username : null;
            itemData.createdUserFullName = user ? user.fullName : null;
            return itemData;
        });

        res.json(transformedItems);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get GRN ID by schedule date and item
exports.getGRNByScheduleDateAndItem = async (req, res) => {
    try {
        const { date, itemId } = req.params;
        const scheduleItem = await GRNScheduleItem.findOne({
            where: {
                scheduleDate: date,
                itemId: itemId,
                isActive: true
            },
            include: [
                Item, 
                Customer,
                { model: GRN, as: 'GRN1' },
                { model: GRN, as: 'GRN2' },
                { model: GRN, as: 'GRN3' }
            ]
        });
        if (!scheduleItem) {
            return res.status(404).json({ error: 'No active GRN schedule found for the specified date and item' });
        }
        res.json({
            grn1Id: scheduleItem.grn1Id,
            grn2Id: scheduleItem.grn2Id,
            grn3Id: scheduleItem.grn3Id,
            scheduleItem: scheduleItem
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get a single GRNScheduleItem by ID
exports.getGRNScheduleItemById = async (req, res) => {
    try {
        const item = await GRNScheduleItem.findByPk(req.params.id, { 
            include: [
                Item, 
                Customer,
                { model: GRN, as: 'GRN1' },
                { model: GRN, as: 'GRN2' },
                { model: GRN, as: 'GRN3' }
            ] 
        });
        if (!item) return res.status(404).json({ error: 'GRNScheduleItem not found' });
        res.json(item);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update a GRNScheduleItem
exports.updateGRNScheduleItem = async (req, res) => {
    try {
        const data = req.body;
        const scheduleItem = await GRNScheduleItem.findByPk(req.params.id);
        if (!scheduleItem) return res.status(404).json({ error: 'GRNScheduleItem not found' });
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }
        await scheduleItem.update({ ...data, updatedBy: currentUserId });
        res.json(scheduleItem);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Delete a GRNScheduleItem
exports.deleteGRNScheduleItem = async (req, res) => {
    try {
        const scheduleItem = await GRNScheduleItem.findByPk(req.params.id);
        if (!scheduleItem) return res.status(404).json({ error: 'GRNScheduleItem not found' });
        await scheduleItem.destroy();
        res.json({ message: 'GRNScheduleItem deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getCustomerWisePrice = async (req, res) => {
    try {
        const customerId = req.params.id;
        
        // Validate customer ID parameter
        if (!customerId || customerId === 'undefined' || customerId === 'null') {
            return res.status(400).json({ error: 'Invalid customer ID provided' });
        }

       // console.log('Getting prices for customer ID:', customerId);

        // Only active prices for the specific customer
        let prices = await GRNScheduleItem.findAll({
            where: { isActive: true, customerId: customerId },
            include: [
                Customer, 
                { 
                    model: Item, 
                    include: [Category] 
                }
            ],
            order: [['customerId', 'ASC'], ['itemId', 'ASC']]
        });

       // console.log('Found direct prices:', prices.length);

        // If no prices found for the customer, try fallback logic
        if (!prices || prices.length === 0) {
            // First, find the customer to check if it has a parent and get customer type
            const customer = await Customer.findOne({
                where: { 
                    id: customerId,
                    status: 'Active'
                }
            });

           // console.log('Customer found:', customer ? customer.id : 'null', 'Parent ID:', customer?.parentId, 'Type:', customer?.type);

            if (!customer) {
                return res.status(404).json({ 
                    error: 'Customer not found',
                    customerId: customerId
                });
            }

            // Try parent customer prices first if customer has a parent
            if (customer.parentId) {
              //  console.log('Searching parent customer prices for parent ID:', customer.parentId);
                
                prices = await GRNScheduleItem.findAll({
                    where: { 
                        isActive: true, 
                        customerId: customer.parentId 
                    },
                    include: [
                        Customer, 
                        { 
                            model: Item, 
                            include: [Category] 
                        }
                    ],
                    order: [['customerId', 'ASC'], ['itemId', 'ASC']]
                });

                //console.log('Found parent prices:', prices.length);
            }

            // If still no prices and customer type is not "Supermarket", try to find prices by customer type
            if ((!prices || prices.length === 0) && customer.type && customer.type !== 'Supermarket') {
              //  console.log('Searching prices by customer type:', customer.type);

                prices = await GRNScheduleItem.findAll({
                    where: { 
                        isActive: true, 
                        type: customer.type,
                        customerId: null // Type-based prices have null customerId
                    },
                    include: [
                        Customer, 
                        { 
                            model: Item, 
                            include: [Category] 
                        }
                    ],
                    order: [['itemId', 'ASC']]
                });

               // console.log('Found type-based prices:', prices.length);
            }
        }

        // If still no prices found, return empty array with customer info if available
        if (!prices || prices.length === 0) {
            const customer = await Customer.findByPk(customerId, {
                attributes: ['id', 'name', 'email', 'type', 'parentId']
            });

            return res.json({
                message: 'No active item prices found for this customer',
                customer: customer,
                prices: [],
                searchedParent: customer?.parentId ? true : false
            });
        }

        // Group by customer
        const grouped = {};
        prices.forEach(price => {
            const obj = price.toJSON();
            const priceCustomerId = obj.customerId;
            if (!grouped[priceCustomerId]) {
                grouped[priceCustomerId] = {
                    customer: obj.Customer,
                    itemPrices: []
                };
            }
            grouped[priceCustomerId].itemPrices.push({
                id: obj.id,
                item: obj.Item,
                price: obj.price,
                effectiveDate: obj.effectiveDate,
                status: obj.status
            });
        });

        // Convert to array
        const result = Object.values(grouped);
        
        // Determine the source of prices for response
        let priceSource = 'direct';
        let fromParent = false;
        let fromType = false;

        if (prices.length > 0) {
            if (prices[0].customerId && prices[0].customerId != customerId) {
                priceSource = 'parent';
                fromParent = true;
            } else if (!prices[0].customerId) {
                priceSource = 'type';
                fromType = true;
            }
        }

        // Return both the grouped result and the raw prices for flexibility
        res.json({
            message: 'Item prices retrieved successfully',
            customerId: customerId,
            groupedPrices: result,
            prices: prices,
            totalPrices: prices.length,
            priceSource: priceSource,
            fromParent: fromParent,
            fromType: fromType
        });

    } catch (error) {
        console.error('Error in getCustomerWisePrice:', error);
        res.status(500).json({ 
            error: 'Failed to retrieve customer prices',
            details: error.message,
            customerId: req.params.id
        });
    }
};
