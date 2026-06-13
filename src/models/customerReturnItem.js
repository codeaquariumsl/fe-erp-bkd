const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const CustomerReturnItem = sequelize.define('CustomerReturnItem', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    customerReturnId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'customer_returns',
            key: 'id',
        },
        comment: 'Reference to the customer return'
    },
    itemId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'items',
            key: 'id',
        },
        comment: 'Item being returned'
    },
    batchId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'batches',
            key: 'id',
        },
        comment: 'Batch of the item if applicable'
    },
    quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Quantity being returned'
    },
    unitPrice: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Unit price of the item'
    },
    discount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
    },
    taxAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
    },
    excludingTaxAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
    },
    isTaxItem: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    totalPrice: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Total value of returned quantity'
    },
    unitId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'units',
            key: 'id',
        },
        comment: 'Unit of measurement'
    },
    condition: {
        type: DataTypes.ENUM('Damaged', 'Expired', 'Good', 'Poor', 'Defective'),
        allowNull: false,
        defaultValue: 'Good',
        comment: 'Condition of the returned item'
    },
    expiryDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Expiry date of the item if applicable'
    },
    serialNumbers: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Serial numbers if applicable (JSON array)'
    },
    reason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Specific reason for returning this item'
    },
    disposition: {
        type: DataTypes.ENUM('Refund', 'Replace', 'Credit Note', 'Dispose', 'Restock'),
        allowNull: false,
        defaultValue: 'Refund',
        comment: 'What to do with the returned item'
    },
    isRefundable: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether this item is eligible for refund'
    },
    refundAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0.00,
        comment: 'Amount refunded for this item'
    },
    coldRoomId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'cold_rooms',
            key: 'id',
        },
        comment: 'Cold room location if applicable'
    },
    palletRackId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'pallet_racks',
            key: 'id',
        },
        comment: 'Pallet rack location if applicable'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Additional notes for this item'
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    createdBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    updatedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id',
        },
    }
}, {
    timestamps: true,
    tableName: 'customer_return_items',
});

module.exports = CustomerReturnItem;
