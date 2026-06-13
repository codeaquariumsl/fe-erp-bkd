const { CustomerCategoryDiscount, Customer, Category, User } = require('../models');

// Create or Update a discount
exports.upsertDiscount = async (req, res) => {
    try {
        const { customerId, categoryId, discountPercentage } = req.body;
        const currentUserId = req.user ? req.user.id : (req.body.createdBy || 1); // Fallback for dev

        const [discount, created] = await CustomerCategoryDiscount.findOrCreate({
            where: { customerId, categoryId },
            defaults: {
                discountPercentage,
                createdBy: currentUserId,
            }
        });

        if (!created) {
            await discount.update({
                discountPercentage,
                updatedBy: currentUserId
            });
        }

        res.status(200).json({
            message: created ? 'Discount created successfully' : 'Discount updated successfully',
            discount
        });
    } catch (error) {
        console.error('Error upserting customer category discount:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get all discounts for a customer
exports.getDiscountsByCustomer = async (req, res) => {
    try {
        const { customerId } = req.params;
        const discounts = await CustomerCategoryDiscount.findAll({
            where: { customerId },
            include: [
                { model: Category, as: 'Category', attributes: ['id', 'name', 'code'] }
            ]
        });
        res.status(200).json(discounts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get all discounts for a category (less common but maybe useful)
exports.getDiscountsByCategory = async (req, res) => {
    try {
        const { categoryId } = req.params;
        const discounts = await CustomerCategoryDiscount.findAll({
            where: { categoryId },
            include: [
                { model: Customer, as: 'Customer', attributes: ['id', 'name'] }
            ]
        });
        res.status(200).json(discounts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Delete a discount
exports.deleteDiscount = async (req, res) => {
    try {
        const { id } = req.params;
        const discount = await CustomerCategoryDiscount.findByPk(id);
        if (!discount) {
            return res.status(404).json({ error: 'Discount not found' });
        }
        await discount.destroy();
        res.status(200).json({ message: 'Discount deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Bulk update/create discounts for a customer
exports.bulkUpsertDiscounts = async (req, res) => {
    try {
        const { customerId, discounts } = req.body; // discounts: [{ categoryId, discountPercentage }, ...]
        const currentUserId = req.user ? req.user.id : (req.body.createdBy || 1);

        const results = [];
        for (const item of discounts) {
            const [discount, created] = await CustomerCategoryDiscount.findOrCreate({
                where: { customerId, categoryId: item.categoryId },
                defaults: {
                    discountPercentage: item.discountPercentage,
                    createdBy: currentUserId,
                }
            });

            if (!created) {
                await discount.update({
                    discountPercentage: item.discountPercentage,
                    updatedBy: currentUserId
                });
            }
            results.push(discount);
        }

        res.status(200).json({
            message: 'Discounts processed successfully',
            discounts: results
        });
    } catch (error) {
        console.error('Error bulk upserting customer category discounts:', error);
        res.status(500).json({ error: error.message });
    }
};
