const { User, Role, Permission } = require('../models');

/**
 * Permission middleware factory
 * @param {string|string[]} requiredPermissions - Permission(s) required to access the route
 * @returns {Function} Express middleware function
 */
const permissionMiddleware = (requiredPermissions) => {
    return async (req, res, next) => {
        try {
            // Ensure user is authenticated
            if (!req.user || !req.user.id) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }
            
            // Get user with role and permissions
            const user = await User.findByPk(req.user.id, {
                include: [
                    {
                        model: Role,
                        include: [
                            {
                                model: Permission,
                                as: 'permissions',
                                through: { attributes: [] }
                            }
                        ]
                    }
                ]
            });
            
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'User not found'
                });
            }
            
            // Check if user has admin role (admin has all permissions)
            if (user.Role && user.Role.name === 'admin') {
                return next();
            }
            
            // Get user permissions
            const userPermissions = user.Role ? user.Role.permissions.map(p => p.id) : [];
            
            // Convert requiredPermissions to array if it's a string
            const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
            
            // Check if user has all required permissions
            const hasAllPermissions = permissions.every(permission => userPermissions.includes(permission));
            
            if (!hasAllPermissions) {
                return res.status(403).json({
                    success: false,
                    message: 'Insufficient permissions',
                    required: permissions,
                    userHas: userPermissions
                });
            }
            
            // Add user permissions to request for easy access
            req.userPermissions = userPermissions;
            
            next();
        } catch (error) {
            console.error('Permission middleware error:', error);
            res.status(500).json({
                success: false,
                message: 'Error checking permissions',
                error: error.message
            });
        }
    };
};

/**
 * Check if user has any of the specified permissions
 * @param {string[]} permissions - Array of permissions to check
 * @returns {Function} Express middleware function
 */
const hasAnyPermission = (permissions) => {
    return async (req, res, next) => {
        try {
            if (!req.user || !req.user.id) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }
            
            const user = await User.findByPk(req.user.id, {
                include: [
                    {
                        model: Role,
                        include: [
                            {
                                model: Permission,
                                as: 'permissions',
                                through: { attributes: [] }
                            }
                        ]
                    }
                ]
            });
            
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'User not found'
                });
            }
            
            // Admin has all permissions
            if (user.Role && user.Role.name === 'admin') {
                return next();
            }
            
            const userPermissions = user.Role ? user.Role.permissions.map(p => p.id) : [];
            
            // Check if user has any of the required permissions
            const hasPermission = permissions.some(permission => userPermissions.includes(permission));
            
            if (!hasPermission) {
                return res.status(403).json({
                    success: false,
                    message: 'Insufficient permissions',
                    required: permissions,
                    userHas: userPermissions
                });
            }
            
            req.userPermissions = userPermissions;
            next();
        } catch (error) {
            console.error('Permission check error:', error);
            res.status(500).json({
                success: false,
                message: 'Error checking permissions',
                error: error.message
            });
        }
    };
};

/**
 * Helper function to check permissions programmatically
 * @param {number} userId - User ID
 * @param {string|string[]} requiredPermissions - Permission(s) to check
 * @returns {Promise<boolean>} - Whether user has the required permissions
 */
const checkUserPermissions = async (userId, requiredPermissions) => {
    try {
        const user = await User.findByPk(userId, {
            include: [
                {
                    model: Role,
                    include: [
                        {
                            model: Permission,
                            as: 'permissions',
                            through: { attributes: [] }
                        }
                    ]
                }
            ]
        });
        
        if (!user) return false;
        
        // Admin has all permissions
        if (user.Role && user.Role.name === 'admin') return true;
        
        const userPermissions = user.Role ? user.Role.permissions.map(p => p.id) : [];
        const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
        
        return permissions.every(permission => userPermissions.includes(permission));
    } catch (error) {
        console.error('Error checking user permissions:', error);
        return false;
    }
};

module.exports = {
    permissionMiddleware,
    hasAnyPermission,
    checkUserPermissions
};
