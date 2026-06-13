const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const SupplierReturn = sequelize.define('SupplierReturn', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    returnNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Auto-generated return number (e.g., SR-001)'
    },
    supplierId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'suppliers',
            key: 'id',
        },
        comment: 'Reference to the supplier'
    },
    purchaseOrderId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'purchase_orders',
            key: 'id',
        },
        comment: 'Related purchase order if applicable'
    },
    grnId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'grns',
            key: 'id',
        },
        comment: 'Related GRN if applicable'
    },
    returnDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'Date of the return'
    },
    returnTypeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'return_types',
            key: 'id',
        },
        comment: 'Type of return (damaged, expired, quality issue, etc.)'
    },
    reason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Detailed reason for the return'
    },
    status: {
        type: DataTypes.ENUM('Pending', 'Processing', 'Completed', 'Cancelled', 'Approved', 'Rejected'),
        allowNull: false,
        defaultValue: 'Pending',
        comment: 'Status of the return'
    },
    totalAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Total value of returned items'
    },
    currency: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'LKR',
        comment: 'Currency of the return value'
    },
    refundAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0.00,
        comment: 'Amount refunded to the supplier'
    },
    refundStatus: {
        type: DataTypes.ENUM('Pending', 'Processed', 'Completed', 'Not Applicable'),
        allowNull: false,
        defaultValue: 'Pending',
        comment: 'Status of refund process'
    },
    approvedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'User who approved the return'
    },
    approvedDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Date when return was approved'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Additional notes or comments'
    },
    locationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'locations',
            key: 'id',
        },
        comment: 'Location where return is processed'
    },
    storeId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'stores',
            key: 'id',
        },
        comment: 'Store where items are returned to'
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
    tableName: 'supplier_returns',
});

module.exports = SupplierReturn;