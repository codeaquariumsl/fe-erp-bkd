const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const UserActivityLog = sequelize.define('UserActivityLog', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
    },
    action: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Action performed (CREATE, READ, UPDATE, DELETE, LOGIN, LOGOUT)',
    },
    resource: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Resource/entity affected (user, item, category, etc.)',
    },
    resourceId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'ID of the affected resource (optional)',
    },
    method: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'HTTP method (GET, POST, PUT, DELETE)',
    },
    endpoint: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'API endpoint accessed',
    },
    ipAddress: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'IP address of the user',
    },
    userAgent: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Browser/client information',
    },
    requestBody: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Request data (sensitive data filtered)',
    },
    responseStatus: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'HTTP response status code',
    },
    duration: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Request duration in milliseconds',
    },
    errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Error message if request failed',
    },
    sessionId: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Session identifier for tracking user sessions',
    },
    metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Additional context information',
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
}, {
    timestamps: false, // We only need createdAt
    tableName: 'user_activity_logs',
    indexes: [
        {
            fields: ['userId']
        },
        {
            fields: ['action']
        },
        {
            fields: ['resource']
        },
        {
            fields: ['createdAt']
        },
        {
            fields: ['userId', 'createdAt']
        },
        {
            fields: ['resource', 'action']
        }
    ]
});

module.exports = UserActivityLog;
