const ItemPrice = require('../models/itemPrice');
const Customer = require('../models/customer');
const Item = require('../models/item');
const Category = require('../models/category');
const sequelize = require('../config/db'); // Use the correct sequelize instance
const { Op } = require('sequelize');

// Create or update item price for a customer
exports.setItemPrice = async (req, res) => {
    try {
        const { customerId, itemId, price, status, effectiveDate } = req.body;
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }
        let itemPrice = await ItemPrice.findOne({ where: { customerId, itemId } });
        if (itemPrice) {
            await itemPrice.update({ price, status, effectiveDate, updatedBy: currentUserId });
        } else {
            itemPrice = await ItemPrice.create({ customerId, itemId, price, status, effectiveDate, createdBy: currentUserId, updatedBy: currentUserId });
        }
        res.status(201).json(itemPrice);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get price for a customer-item
exports.getItemPrice = async (req, res) => {
    try {
        const { customerId, itemId } = req.params;
        const itemPrice = await ItemPrice.findOne({ where: { customerId, itemId } });
        if (!itemPrice) return res.status(404).json({ error: 'Price not found' });
        res.json(itemPrice);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// List all prices (filterable)
exports.listItemPrices = async (req, res) => {
    try {
        // Only active prices
        const prices = await ItemPrice.findAll({
            where: { status: 'Active' },
            include: [Customer, Item],
            order: [['customerId', 'ASC'], ['itemId', 'ASC']]
        });
        // Group by customer
        const grouped = {};
        prices.forEach(price => {
            const obj = price.toJSON();
            const customerId = obj.customerId;
            if (!grouped[customerId]) {
                grouped[customerId] = {
                    type: obj.type,
                    customer: obj.Customer,
                    itemPrices: []
                };
            }
            grouped[customerId].itemPrices.push({
                id: obj.id,
                item: obj.Item,
                price: obj.price,
                effectiveDate: obj.effectiveDate,
                status: obj.status
            });
        });
        // Convert to array
        const result = Object.values(grouped);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Delete (hard) a price entry
exports.deleteItemPrice = async (req, res) => {
    try {
        const { id } = req.params;
        const itemPrice = await ItemPrice.findByPk(id);
        if (!itemPrice) return res.status(404).json({ error: 'Price not found' });
        await itemPrice.destroy();
        res.json({ message: 'Item price deleted' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Bulk upload item prices for a customer
exports.bulkSetItemPrices = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { customerId, prices } = req.body; // prices: [{ itemId, price, status, effectiveDate }]
        let type = req.body.type;
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (type === "Walk-in") {
            type = "Walking"; // Normalize type for internal consistency
        }
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }

        if (!Array.isArray(prices) || !type) {
            return res.status(400).json({ error: 'Invalid request: missing type or prices array' });
        }

        if (prices.length === 0) {
            return res.status(400).json({ error: 'Prices array cannot be empty' });
        }

        // Validate that all required fields are present in prices
        for (let i = 0; i < prices.length; i++) {
            const p = prices[i];
            if (!p.itemId || p.price === undefined || p.price === null) {
                return res.status(400).json({
                    error: `Invalid price data at index ${i}: itemId and price are required`
                });
            }
        }

        // Build where condition for finding existing records
        const whereCondition = { type };

        // Handle customerId - could be null, undefined, or a specific ID
        if (customerId === null || customerId === undefined) {
            whereCondition.customerId = null;
        } else {
            whereCondition.customerId = customerId;
        }

        // Check if there are existing active records for this type and customer combination
        const existingActiveRecords = await ItemPrice.findAll({
            where: {
                ...whereCondition,
                status: 'Active'
            },
            transaction
        });

        let inactivatedCount = 0;
        if (existingActiveRecords.length > 0) {
            // Set all existing active prices for this type and customer combination to inactive
            const [updatedCount] = await ItemPrice.update(
                {
                    status: 'Inactive',
                    updatedBy: currentUserId,
                    updatedAt: new Date()
                },
                {
                    where: whereCondition,
                    transaction
                }
            );
            inactivatedCount = updatedCount;
        }

        // Insert new active price records
        const results = [];
        for (const p of prices) {
            const itemPriceData = {
                type,
                customerId: customerId || null,
                itemId: p.itemId,
                price: parseFloat(p.price),
                status: p.status || 'Active',
                effectiveDate: p.effectiveDate || new Date(),
                createdBy: currentUserId,
                updatedBy: currentUserId
            };

            const itemPrice = await ItemPrice.create(itemPriceData, { transaction });
            results.push(itemPrice);
        }

        await transaction.commit();

        res.status(201).json({
            message: 'Bulk item prices updated successfully',
            inactivatedRecords: inactivatedCount,
            newActiveRecords: results.length,
            data: results
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error in bulkSetItemPrices:', error);
        res.status(400).json({ error: error.message });
    }
};

// Update item price for a customer-item
exports.updateItemPrice = async (req, res) => {
    try {
        const { customerId, itemId } = req.params;
        const { price, status, effectiveDate } = req.body;
        const currentUserId = (req.user && req.user.id) || (req.body.user && req.body.user.id) || null;
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized: missing user context' });
        }
        const itemPrice = await ItemPrice.findOne({ where: { customerId, itemId } });
        if (!itemPrice) return res.status(404).json({ error: 'Price not found' });
        await itemPrice.update({ price, status, effectiveDate, updatedBy: currentUserId });
        res.json(itemPrice);
    } catch (error) {
        res.status(400).json({ error: error.message });
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
        let prices = await ItemPrice.findAll({
            where: { status: 'Active', customerId: customerId },
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
                
                prices = await ItemPrice.findAll({
                    where: { 
                        status: 'Active', 
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

                prices = await ItemPrice.findAll({
                    where: { 
                        status: 'Active', 
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
