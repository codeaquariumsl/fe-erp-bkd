const { Role, Permission, RolePermission, User } = require('../models');
const { Op } = require('sequelize');

// Create a new role
exports.createRole = async (req, res) => {
    try {
        const { name, description } = req.body;
        
        const existingRole = await Role.findOne({ where: { name } });
        if (existingRole) {
            return res.status(400).json({
                success: false,
                message: 'Role with this name already exists'
            });
        }
        
        const newRole = await Role.create({ name, description });
        
        res.status(201).json({
            success: true,
            data: newRole,
            message: 'Role created successfully'
        });
    } catch (error) {
        console.error('Error creating role:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating role',
            error: error.message
        });
    }
};

// Get all roles
exports.getAllRoles = async (req, res) => {
    try {
        const roles = await Role.findAll({
            include: [
                {
                    model: Permission,
                    as: 'permissions',
                    through: { attributes: [] }
                }
            ],
            order: [['name', 'ASC']]
        });
        
        res.json({
            success: true,
            data: roles,
            message: 'Roles retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching roles:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching roles',
            error: error.message
        });
    }
};

// Get a role by ID
exports.getRoleById = async (req, res) => {
    try {
        const role = await Role.findByPk(req.params.id, {
            include: [
                {
                    model: Permission,
                    as: 'permissions',
                    through: { attributes: [] }
                }
            ]
        });
        
        if (!role) {
            return res.status(404).json({
                success: false,
                message: 'Role not found'
            });
        }
        
        res.json({
            success: true,
            data: role,
            message: 'Role retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching role:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching role',
            error: error.message
        });
    }
};

// Update role
exports.updateRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        
        const role = await Role.findByPk(id);
        if (!role) {
            return res.status(404).json({
                success: false,
                message: 'Role not found'
            });
        }
        
        // Check if name already exists (excluding current role)
        const existingRole = await Role.findOne({
            where: { 
                name,
                id: { [Op.ne]: id }
            }
        });
        
        if (existingRole) {
            return res.status(400).json({
                success: false,
                message: 'Role with this name already exists'
            });
        }
        
        await role.update({ name, description });
        
        res.json({
            success: true,
            data: role,
            message: 'Role updated successfully'
        });
    } catch (error) {
        console.error('Error updating role:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating role',
            error: error.message
        });
    }
};

// Delete role
exports.deleteRole = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if role exists
        const role = await Role.findByPk(id);
        if (!role) {
            return res.status(404).json({
                success: false,
                message: 'Role not found'
            });
        }
        
        // Check if any users are assigned to this role
        const userCount = await User.count({ where: { roleId: id } });
        if (userCount > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete role. Users are assigned to this role.'
            });
        }
        
        // Delete role permissions first
        await RolePermission.destroy({ where: { roleId: id } });
        
        // Delete the role
        await role.destroy();
        
        res.json({
            success: true,
            message: 'Role deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting role:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting role',
            error: error.message
        });
    }
};

// Get role permissions
exports.getRolePermissions = async (req, res) => {
    try {
        const { id } = req.params;
        
        const role = await Role.findByPk(id, {
            include: [
                {
                    model: Permission,
                    as: 'permissions',
                    through: { attributes: [] }
                }
            ]
        });
        
        if (!role) {
            return res.status(404).json({
                success: false,
                message: 'Role not found'
            });
        }
        
        const permissionIds = role.permissions.map(permission => permission.id);
        
        res.json({
            success: true,
            data: permissionIds,
            message: 'Role permissions retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching role permissions:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching role permissions',
            error: error.message
        });
    }
};

// Update role permissions
exports.updateRolePermissions = async (req, res) => {
    try {
        const { id } = req.params;
        const { permissions } = req.body;
        
        const role = await Role.findByPk(id);
        if (!role) {
            return res.status(404).json({
                success: false,
                message: 'Role not found'
            });
        }
        
        // Validate that all permissions exist
        if (permissions && permissions.length > 0) {
            const existingPermissions = await Permission.findAll({
                where: { id: permissions }
            });
            
            if (existingPermissions.length !== permissions.length) {
                return res.status(400).json({
                    success: false,
                    message: 'One or more permissions not found'
                });
            }
        }
        
        // Remove existing role permissions
        await RolePermission.destroy({ where: { roleId: id } });
        
        // Add new role permissions
        if (permissions && permissions.length > 0) {
            const rolePermissions = permissions.map(permissionId => ({
                roleId: id,
                permissionId
            }));
            
            await RolePermission.bulkCreate(rolePermissions);
        }
        
        res.json({
            success: true,
            message: 'Role permissions updated successfully'
        });
    } catch (error) {
        console.error('Error updating role permissions:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating role permissions',
            error: error.message
        });
    }
};

// Legacy method - kept for backward compatibility
exports.assignRoleToUser = async (req, res) => {
    try {
        const { userId, roleId } = req.body;
        
        const role = await Role.findByPk(roleId);
        if (!role) {
            return res.status(404).json({
                success: false,
                message: 'Role not found'
            });
        }
        
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        await user.update({ roleId });
        
        res.json({
            success: true,
            message: 'Role assigned to user successfully'
        });
    } catch (error) {
        console.error('Error assigning role:', error);
        res.status(500).json({
            success: false,
            message: 'Error assigning role',
            error: error.message
        });
    }
};