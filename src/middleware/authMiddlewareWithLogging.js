const jwt = require('jsonwebtoken');
const { promisify } = require('util');

// Lazy load the UserActivityLog model to avoid immediate database connection
let UserActivityLog = null;
const getUserActivityLog = () => {
    if (!UserActivityLog) {
        try {
            UserActivityLog = require('../models/userActivityLog');
        } catch (error) {
            console.error('❌ Failed to load UserActivityLog model:', error.message);
            return null;
        }
    }
    return UserActivityLog;
};

const verifyToken = promisify(jwt.verify);

// Helper function to extract resource name from endpoint
const extractResourceFromEndpoint = (endpoint) => {
    // Remove /api/ prefix and extract the main resource
    const cleanPath = endpoint.replace(/^\/api\//, '');
    const segments = cleanPath.split('/');
    
    // Map common endpoints to resource names
    const resourceMap = {
        'auth': 'authentication',
        'users': 'user',
        'roles': 'role',
        'permissions': 'permission',
        'categories': 'category',
        'locations': 'location',
        'stores': 'store',
        'routes': 'route',
        'vehicles': 'vehicle',
        'items': 'item',
        'suppliers': 'supplier',
        'customers': 'customer',
        'purchase-orders': 'purchase_order',
        'grns': 'grn',
        'stock': 'stock',
        'item-prices': 'item_price',
        'sales-orders': 'sales_order',
        'drivers': 'driver',
        'delivery-orders': 'delivery_order',
        'delivery-order-summary-items': 'delivery_order_summary_item',
        'invoices': 'invoice',
        'dashboard': 'dashboard',
        'cold-rooms': 'cold_room',
        'pallet-racks': 'pallet_rack',
        'pallets': 'pallet',
        'documents': 'document',
        'grn-schedule-items': 'grn_schedule_item',
        'gins': 'gin',
        'reports': 'report',
        'supplier-returns': 'supplier_return',
        'supplier-payments': 'supplier_payment'
    };

    return resourceMap[segments[0]] || segments[0] || 'unknown';
};

// Helper function to determine action from method and endpoint
const determineAction = (method, endpoint) => {
    const upperMethod = method.toUpperCase();
    
    // Special cases for specific endpoints
    if (endpoint.includes('/login')) return 'LOGIN';
    if (endpoint.includes('/logout')) return 'LOGOUT';
    if (endpoint.includes('/register')) return 'REGISTER';
    if (endpoint.includes('/profile')) return 'PROFILE_VIEW';
    
    // Standard CRUD mapping
    switch (upperMethod) {
        case 'GET':
            return 'READ';
        case 'POST':
            return 'CREATE';
        case 'PUT':
        case 'PATCH':
            return 'UPDATE';
        case 'DELETE':
            return 'DELETE';
        default:
            return upperMethod;
    }
};

// Helper function to extract resource ID from URL parameters
const extractResourceId = (endpoint) => {
    // Extract numeric ID from URL patterns like /api/users/123 or /api/items/456/update
    const matches = endpoint.match(/\/(\d+)(?:\/|$)/);
    return matches ? parseInt(matches[1]) : null;
};

// Helper function to filter sensitive data from request body
const filterSensitiveData = (body) => {
    if (!body || typeof body !== 'object') return body;
    
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
    const filtered = { ...body };
    
    for (const field of sensitiveFields) {
        if (filtered[field]) {
            filtered[field] = '[FILTERED]';
        }
    }
    
    return filtered;
};

// Helper function to get client IP address
const getClientIP = (req) => {
    return req.ip || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           'unknown';
};

// Activity logging middleware
const logUserActivity = (req, res, next) => {
    const startTime = Date.now();
    // console.log('🔍 Activity logging middleware started for:', req.originalUrl);

    // Skip logging for health checks and static files
    if (req.method === 'GET' || (req.path.includes('health') || req.path.includes('.css') || req.path.includes('.js'))) {
        // console.log('⏭️  Skipping logging for:', req.path);
        return next();
    }

    // Store original res methods
    const originalSend = res.send;
    const originalJson = res.json;
    const originalEnd = res.end;
    
    let responseData = null;
    let responseSent = false;

    // Function to perform logging
    const performLogging = async () => {
        if (responseSent) return; // Prevent duplicate logging
        responseSent = true;

        try {
            const duration = Date.now() - startTime;
            const resource = extractResourceFromEndpoint(req.path);
            const action = determineAction(req.method, req.path);
            const resourceId = extractResourceId(req.path);
            const statusCode = res.statusCode;
            
            // Only log if user is authenticated (req.user is set by authMiddleware)
            if (req.user && req.user.id) {
                const logData = {
                    userId: req.user.id,
                    action,
                    resource,
                    resourceId,
                    method: req.method,
                    endpoint: req.originalUrl,
                    ipAddress: getClientIP(req),
                    userAgent: req.headers['user-agent'] || 'Unknown',
                    requestBody: filterSensitiveData(req.body),
                    responseStatus: statusCode,
                    duration,
                    sessionId: req.sessionID || req.headers['x-session-id'] || null,
                    metadata: {
                        query: req.query || {},
                        params: req.params || {},
                        userRole: req.user.role || 'unknown',
                        timestamp: new Date().toISOString()
                    }
                };

                // Add error message if response indicates error
                if (statusCode >= 400 && responseData) {
                    if (typeof responseData === 'string') {
                        try {
                            const parsed = JSON.parse(responseData);
                            logData.errorMessage = parsed.message || parsed.error || 'Unknown error';
                        } catch {
                            logData.errorMessage = responseData.substring(0, 500);
                        }
                    } else if (responseData && (responseData.message || responseData.error)) {
                        logData.errorMessage = responseData.message || responseData.error;
                    }
                }

                // console.log('💾 Saving activity log to database...', {
                //     userId: logData.userId,
                //     action: logData.action,
                //     resource: logData.resource,
                //     endpoint: logData.endpoint
                // });

                // Save to database with better error handling
                try {
                    const UserActivityLogModel = getUserActivityLog();
                    if (UserActivityLogModel) {
                        const savedLog = await UserActivityLogModel.create(logData);
                        console.log('✅ Activity log saved successfully with ID:', savedLog.id);
                    } else {
                        console.log('⚠️  UserActivityLog model not available, skipping database save');
                        console.log('📋 Log data that would be saved:', JSON.stringify(logData, null, 2));
                    }
                } catch (dbError) {
                    console.error('❌ Database error while saving activity log:', dbError.message);
                    console.error('🔍 Full error details:', dbError);
                    console.error('📋 Log data that failed to save:', JSON.stringify(logData, null, 2));
                }
            } else {
                console.log('⚠️  No authenticated user found, skipping activity log');
            }
        } catch (error) {
            console.error('❌ Error in activity logging middleware:', error);
        }
    };

    // Override res.send to capture response
    res.send = function (data) {
        if (!responseSent) {
            responseData = data;
            // Perform logging asynchronously after sending response
            setImmediate(performLogging);
        }
        return originalSend.call(this, data);
    };

    // Override res.json to capture response
    res.json = function (data) {
        if (!responseSent) {
            responseData = data;
            // Perform logging asynchronously after sending response
            setImmediate(performLogging);
        }
        return originalJson.call(this, data);
    };

    // Override res.end to capture response
    res.end = function (data) {
        if (!responseSent) {
            responseData = data;
            // Perform logging asynchronously after sending response
            setImmediate(performLogging);
        }
        return originalEnd.call(this, data);
    };

    // Continue with next middleware
    next();
};

// Enhanced auth middleware with activity logging
const authMiddleware = async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        const decoded = await verifyToken(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
};

// Middleware factory for optional authentication (logs activity if user is authenticated)
const optionalAuthMiddleware = async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (token) {
        try {
            const decoded = await verifyToken(token, process.env.JWT_SECRET);
            req.user = decoded;
        } catch (error) {
            // Token is invalid, but we continue without authentication
            req.user = null;
        }
    }
    
    next();
};

module.exports = {
    authMiddleware,
    optionalAuthMiddleware,
    logUserActivity
};
