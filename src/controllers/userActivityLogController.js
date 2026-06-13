const { Op } = require('sequelize');
const UserActivityLog = require('../models/userActivityLog');
const { User } = require('../models');

const userActivityLogController = {
    // Get user activity logs with filters and pagination
    getUserActivityLogs: async (req, res) => {
        try {
            const {
                userId,
                action,
                resource,
                startDate,
                endDate,
                limit = 50,
                offset = 0,
                sortBy = 'createdAt',
                sortOrder = 'DESC'
            } = req.query;

            // Build where clause
            const whereClause = {};
            
            if (userId) whereClause.userId = userId;
            if (action) whereClause.action = action;
            if (resource) whereClause.resource = resource;
            
            if (startDate && endDate) {
                whereClause.createdAt = {
                    [Op.between]: [new Date(startDate), new Date(endDate)]
                };
            } else if (startDate) {
                whereClause.createdAt = {
                    [Op.gte]: new Date(startDate)
                };
            } else if (endDate) {
                whereClause.createdAt = {
                    [Op.lte]: new Date(endDate)
                };
            }

            const logs = await UserActivityLog.findAndCountAll({
                where: whereClause,
                include: [
                    {
                        model: User,
                        attributes: ['id', 'username', 'fullName', 'email'],
                        as: 'user'
                    }
                ],
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [[sortBy, sortOrder.toUpperCase()]],
                distinct: true
            });

            res.json({
                success: true,
                data: logs.rows,
                total: logs.count,
                limit: parseInt(limit),
                offset: parseInt(offset),
                message: 'User activity logs retrieved successfully'
            });
        } catch (error) {
            console.error('Error fetching user activity logs:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching user activity logs',
                error: error.message
            });
        }
    },

    // Get activity logs for a specific user
    getUserActivityById: async (req, res) => {
        try {
            const { userId } = req.params;
            const {
                action,
                resource,
                startDate,
                endDate,
                limit = 50,
                offset = 0
            } = req.query;

            const whereClause = { userId: parseInt(userId) };
            
            if (action) whereClause.action = action;
            if (resource) whereClause.resource = resource;
            
            if (startDate && endDate) {
                whereClause.createdAt = {
                    [Op.between]: [new Date(startDate), new Date(endDate)]
                };
            }

            const logs = await UserActivityLog.findAndCountAll({
                where: whereClause,
                include: [
                    {
                        model: User,
                        attributes: ['id', 'username', 'fullName', 'email'],
                        as: 'user'
                    }
                ],
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['createdAt', 'DESC']],
                distinct: true
            });

            res.json({
                success: true,
                data: logs.rows,
                total: logs.count,
                limit: parseInt(limit),
                offset: parseInt(offset),
                message: `Activity logs for user ID ${userId} retrieved successfully`
            });
        } catch (error) {
            console.error('Error fetching user activity logs:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching user activity logs',
                error: error.message
            });
        }
    },

    // Get activity summary/statistics
    getActivitySummary: async (req, res) => {
        try {
            const { startDate, endDate, userId } = req.query;
            
            const whereClause = {};
            if (userId) whereClause.userId = userId;
            
            if (startDate && endDate) {
                whereClause.createdAt = {
                    [Op.between]: [new Date(startDate), new Date(endDate)]
                };
            }

            // Get activity counts by action
            const actionStats = await UserActivityLog.findAll({
                where: whereClause,
                attributes: [
                    'action',
                    [UserActivityLog.sequelize.fn('COUNT', UserActivityLog.sequelize.col('id')), 'count']
                ],
                group: 'action',
                order: [[UserActivityLog.sequelize.literal('count'), 'DESC']]
            });

            // Get activity counts by resource
            const resourceStats = await UserActivityLog.findAll({
                where: whereClause,
                attributes: [
                    'resource',
                    [UserActivityLog.sequelize.fn('COUNT', UserActivityLog.sequelize.col('id')), 'count']
                ],
                group: 'resource',
                order: [[UserActivityLog.sequelize.literal('count'), 'DESC']]
            });

            // Get most active users
            const userStats = await UserActivityLog.findAll({
                where: whereClause,
                attributes: [
                    'userId',
                    [UserActivityLog.sequelize.fn('COUNT', UserActivityLog.sequelize.col('UserActivityLog.id')), 'count']
                ],
                include: [
                    {
                        model: User,
                        attributes: ['username', 'fullName'],
                        as: 'user'
                    }
                ],
                group: ['userId', 'user.id'],
                order: [[UserActivityLog.sequelize.literal('count'), 'DESC']],
                limit: 10
            });

            // Get error statistics
            const errorStats = await UserActivityLog.findAll({
                where: {
                    ...whereClause,
                    responseStatus: { [Op.gte]: 400 }
                },
                attributes: [
                    'responseStatus',
                    [UserActivityLog.sequelize.fn('COUNT', UserActivityLog.sequelize.col('id')), 'count']
                ],
                group: 'responseStatus',
                order: [[UserActivityLog.sequelize.literal('count'), 'DESC']]
            });

            res.json({
                success: true,
                data: {
                    actionStats,
                    resourceStats,
                    userStats,
                    errorStats
                },
                message: 'Activity summary retrieved successfully'
            });
        } catch (error) {
            console.error('Error fetching activity summary:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching activity summary',
                error: error.message
            });
        }
    },

    // Get current user's activity logs
    getMyActivityLogs: async (req, res) => {
        try {
            const userId = req.user.id;
            const {
                action,
                resource,
                startDate,
                endDate,
                limit = 50,
                offset = 0
            } = req.query;

            const whereClause = { userId };
            
            if (action) whereClause.action = action;
            if (resource) whereClause.resource = resource;
            
            if (startDate && endDate) {
                whereClause.createdAt = {
                    [Op.between]: [new Date(startDate), new Date(endDate)]
                };
            }

            const logs = await UserActivityLog.findAndCountAll({
                where: whereClause,
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['createdAt', 'DESC']],
                attributes: { exclude: ['requestBody'] } // Don't return request body for user's own logs
            });

            res.json({
                success: true,
                data: logs.rows,
                total: logs.count,
                limit: parseInt(limit),
                offset: parseInt(offset),
                message: 'Your activity logs retrieved successfully'
            });
        } catch (error) {
            console.error('Error fetching user activity logs:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching your activity logs',
                error: error.message
            });
        }
    },

    // Delete old activity logs (cleanup)
    cleanupOldLogs: async (req, res) => {
        try {
            const { daysToKeep = 90 } = req.body;
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

            const deletedCount = await UserActivityLog.destroy({
                where: {
                    createdAt: {
                        [Op.lt]: cutoffDate
                    }
                }
            });

            res.json({
                success: true,
                data: { deletedCount, cutoffDate },
                message: `Deleted ${deletedCount} activity logs older than ${daysToKeep} days`
            });
        } catch (error) {
            console.error('Error cleaning up activity logs:', error);
            res.status(500).json({
                success: false,
                message: 'Error cleaning up activity logs',
                error: error.message
            });
        }
    }
};

module.exports = userActivityLogController;
