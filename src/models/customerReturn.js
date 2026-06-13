const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const CustomerReturn = sequelize.define('CustomerReturn', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    returnNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Auto-generated return number (e.g., CR-001)'
    },
    customerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'customers',
            key: 'id',
        },
        comment: 'Reference to the customer'
    },
    salesOrderId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'sales_orders',
            key: 'id',
        },
        comment: 'Related sales order if applicable'
    },
    invoiceId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'invoices',
            key: 'id',
        },
        comment: 'Related invoice if applicable'
    },
    deliveryOrderId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'deliveryorders',
            key: 'id',
        },
        comment: 'Related delivery order if applicable'
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
        comment: 'Amount refunded to the customer'
    },
    utilizedAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Amount already used for set-offs'
    },
    subTotal: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
    },
    taxAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
    },
    taxRate: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
    },
    discountAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
    },
    isTaxReturn: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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
    tableName: 'customer_returns',
});

module.exports = CustomerReturn;
