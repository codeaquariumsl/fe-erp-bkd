const { Item, Category } = require('../models');
const { generateDocumentNumber } = require('../controllers/documentControllerClient');
const { Op } = require('sequelize');

/**
 * Simple SKU Generator using existing document number system
 */
class SimpleSkuGenerator {
    /**
     * Generate SKU using category code and sequential number
     * Pattern: CAT-NNNNN (e.g., ELE-00001, FOO-00023)
     */
    async generateSKU(categoryId, locationId) {
        try {
            // Get category information
            const category = await Category.findByPk(categoryId);
            if (!category) {
                throw new Error('Category not found for SKU generation');
            }

            // Use category code or first 3 letters of category name
            const categoryCode = (category.code || category.name.substring(0, 3)).toUpperCase();
            
            // Generate document number using existing system
            const skuNumber = await generateDocumentNumber(`${categoryCode}`, locationId);
            
            return skuNumber;
        } catch (error) {
            throw new Error(`SKU generation failed: ${error.message}`);
        }
    }

    /**
     * Generate simple sequential SKU without category
     * Pattern: ITEM-NNNNN
     */
    async generateSimpleSKU() {
        try {
            const skuNumber = await generateDocumentNumber('ITEM');
            return skuNumber;
        } catch (error) {
            throw new Error(`Simple SKU generation failed: ${error.message}`);
        }
    }

    /**
     * Validate SKU uniqueness
     */
    async validateSKUUniqueness(sku, excludeId = null, locationId = null) {
        const whereClause = { sku: sku };
        if (excludeId) {
            whereClause.id = { [Op.ne]: excludeId };
        }
        if (locationId) {
            whereClause.locationId = locationId;
        }

        const existingItem = await Item.findOne({
            where: whereClause
        });

        return !existingItem;
    }

    /**
     * Generate unique SKU with fallback
     */
    async generateUniqueSKU(categoryId, locationId) {
        try {
            // Try category-based SKU first
            if (categoryId) {
                const sku = await this.generateSKU(categoryId, locationId);
                const isUnique = await this.validateSKUUniqueness(sku, null, locationId);
                if (isUnique) {
                    return sku;
                }
            }
            
            // Fallback to simple SKU
            const simpleSku = await this.generateSimpleSKU();
            const isUniqueSimple = await this.validateSKUUniqueness(simpleSku);
            if (isUniqueSimple) {
                return simpleSku;
            }
            
            throw new Error('Failed to generate unique SKU');
        } catch (error) {
            throw new Error(`Unique SKU generation failed: ${error.message}`);
        }
    }
}

module.exports = new SimpleSkuGenerator();
