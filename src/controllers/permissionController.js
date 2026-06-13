const { Permission, Role, RolePermission } = require('../models');

// Get all permissions
const getAllPermissions = async (req, res) => {
    try {
        const permissions = await Permission.findAll({
            order: [['module', 'ASC'], ['action', 'ASC']]
        });
        
        res.json({
            success: true,
            data: permissions,
            message: 'Permissions retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching permissions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch permissions',
            error: error.message
        });
    }
};

// Get permissions grouped by module
const getPermissionsByModule = async (req, res) => {
    try {
        const permissions = await Permission.findAll({
            order: [['module', 'ASC'], ['action', 'ASC']]
        });
        
        const groupedPermissions = permissions.reduce((acc, permission) => {
            const module = permission.module;
            if (!acc[module]) {
                acc[module] = [];
            }
            acc[module].push(permission);
            return acc;
        }, {});
        
        res.json({
            success: true,
            data: groupedPermissions,
            message: 'Permissions by module retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching permissions by module:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch permissions by module',
            error: error.message
        });
    }
};

// Create a new permission (usually done via seeding, but included for completeness)
const createPermission = async (req, res) => {
    try {
        const { id, name, description, module, action } = req.body;
        
        const existingPermission = await Permission.findByPk(id);
        if (existingPermission) {
            return res.status(400).json({
                success: false,
                message: 'Permission with this ID already exists'
            });
        }
        
        const permission = await Permission.create({
            id,
            name,
            description,
            module,
            action
        });
        
        res.status(201).json({
            success: true,
            data: permission,
            message: 'Permission created successfully'
        });
    } catch (error) {
        console.error('Error creating permission:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create permission',
            error: error.message
        });
    }
};

// Update permission
const updatePermission = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, module, action } = req.body;
        
        const permission = await Permission.findByPk(id);
        if (!permission) {
            return res.status(404).json({
                success: false,
                message: 'Permission not found'
            });
        }
        
        await permission.update({
            name,
            description,
            module,
            action
        });
        
        res.json({
            success: true,
            data: permission,
            message: 'Permission updated successfully'
        });
    } catch (error) {
        console.error('Error updating permission:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update permission',
            error: error.message
        });
    }
};

// Delete permission
const deletePermission = async (req, res) => {
    try {
        const { id } = req.params;
        
        const permission = await Permission.findByPk(id);
        if (!permission) {
            return res.status(404).json({
                success: false,
                message: 'Permission not found'
            });
        }
        
        // Delete associated role permissions first
        await RolePermission.destroy({
            where: { permissionId: id }
        });
        
        await permission.destroy();
        
        res.json({
            success: true,
            message: 'Permission deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting permission:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete permission',
            error: error.message
        });
    }
};

module.exports = {
    getAllPermissions,
    getPermissionsByModule,
    createPermission,
    updatePermission,
    deletePermission
};
