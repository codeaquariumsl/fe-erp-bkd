require('dotenv').config();
const { Permission, Role, RolePermission } = require('../models');

// Define all permissions based on the frontend requirements
const permissions = [
    // Dashboard
    { id: 'dashboard:view', name: 'View Dashboard', description: 'Access to main dashboard', module: 'Dashboard', action: 'view' },
    
    // User Management
    { id: 'users:view', name: 'View Users', description: 'View user accounts and profiles', module: 'User Management', action: 'view' },
    { id: 'users:create', name: 'Create Users', description: 'Create new user accounts', module: 'User Management', action: 'create' },
    { id: 'users:edit', name: 'Edit Users', description: 'Modify user accounts and profiles', module: 'User Management', action: 'edit' },
    { id: 'users:delete', name: 'Delete Users', description: 'Remove user accounts', module: 'User Management', action: 'delete' },
    
    // Role Management
    { id: 'roles:view', name: 'View Roles', description: 'View user roles and permissions', module: 'Role Management', action: 'view' },
    { id: 'roles:create', name: 'Create Roles', description: 'Create new user roles', module: 'Role Management', action: 'create' },
    { id: 'roles:edit', name: 'Edit Roles', description: 'Modify user roles and permissions', module: 'Role Management', action: 'edit' },
    { id: 'roles:delete', name: 'Delete Roles', description: 'Remove user roles', module: 'Role Management', action: 'delete' },
    { id: 'roles:assign-permissions', name: 'Assign Permissions', description: 'Assign permissions to roles', module: 'Role Management', action: 'assign-permissions' },
    
    // Inventory Management
    { id: 'inventory:view', name: 'View Inventory', description: 'View inventory items and stock levels', module: 'Inventory Management', action: 'view' },
    { id: 'inventory:create', name: 'Create Inventory', description: 'Add new inventory items', module: 'Inventory Management', action: 'create' },
    { id: 'inventory:edit', name: 'Edit Inventory', description: 'Modify inventory items and stock', module: 'Inventory Management', action: 'edit' },
    { id: 'inventory:delete', name: 'Delete Inventory', description: 'Remove inventory items', module: 'Inventory Management', action: 'delete' },
    
    // Categories
    { id: 'categories:view', name: 'View Categories', description: 'View product categories', module: 'Category Management', action: 'view' },
    { id: 'categories:create', name: 'Create Categories', description: 'Create new product categories', module: 'Category Management', action: 'create' },
    { id: 'categories:edit', name: 'Edit Categories', description: 'Modify product categories', module: 'Category Management', action: 'edit' },
    { id: 'categories:delete', name: 'Delete Categories', description: 'Remove product categories', module: 'Category Management', action: 'delete' },
    
    // Suppliers
    { id: 'suppliers:view', name: 'View Suppliers', description: 'View supplier information', module: 'Supplier Management', action: 'view' },
    { id: 'suppliers:create', name: 'Create Suppliers', description: 'Add new suppliers', module: 'Supplier Management', action: 'create' },
    { id: 'suppliers:edit', name: 'Edit Suppliers', description: 'Modify supplier information', module: 'Supplier Management', action: 'edit' },
    { id: 'suppliers:delete', name: 'Delete Suppliers', description: 'Remove suppliers', module: 'Supplier Management', action: 'delete' },
    
    // Customers
    { id: 'customers:view', name: 'View Customers', description: 'View customer information', module: 'Customer Management', action: 'view' },
    { id: 'customers:create', name: 'Create Customers', description: 'Add new customers', module: 'Customer Management', action: 'create' },
    { id: 'customers:edit', name: 'Edit Customers', description: 'Modify customer information', module: 'Customer Management', action: 'edit' },
    { id: 'customers:delete', name: 'Delete Customers', description: 'Remove customers', module: 'Customer Management', action: 'delete' },
    
    // Purchase Orders
    { id: 'purchase-orders:view', name: 'View Purchase Orders', description: 'View purchase orders', module: 'Purchase Orders', action: 'view' },
    { id: 'purchase-orders:create', name: 'Create Purchase Orders', description: 'Create new purchase orders', module: 'Purchase Orders', action: 'create' },
    { id: 'purchase-orders:edit', name: 'Edit Purchase Orders', description: 'Modify purchase orders', module: 'Purchase Orders', action: 'edit' },
    { id: 'purchase-orders:delete', name: 'Delete Purchase Orders', description: 'Remove purchase orders', module: 'Purchase Orders', action: 'delete' },
    { id: 'purchase-orders:approve', name: 'Approve Purchase Orders', description: 'Approve purchase orders', module: 'Purchase Orders', action: 'approve' },
    
    // Sales Orders
    { id: 'sales-orders:view', name: 'View Sales Orders', description: 'View sales orders', module: 'Sales Orders', action: 'view' },
    { id: 'sales-orders:create', name: 'Create Sales Orders', description: 'Create new sales orders', module: 'Sales Orders', action: 'create' },
    { id: 'sales-orders:edit', name: 'Edit Sales Orders', description: 'Modify sales orders', module: 'Sales Orders', action: 'edit' },
    { id: 'sales-orders:delete', name: 'Delete Sales Orders', description: 'Remove sales orders', module: 'Sales Orders', action: 'delete' },
    { id: 'sales-orders:approve', name: 'Approve Sales Orders', description: 'Approve sales orders', module: 'Sales Orders', action: 'approve' },
    
    // Delivery Orders
    { id: 'delivery-orders:view', name: 'View Delivery Orders', description: 'View delivery orders', module: 'Delivery Orders', action: 'view' },
    { id: 'delivery-orders:create', name: 'Create Delivery Orders', description: 'Create new delivery orders', module: 'Delivery Orders', action: 'create' },
    { id: 'delivery-orders:edit', name: 'Edit Delivery Orders', description: 'Modify delivery orders', module: 'Delivery Orders', action: 'edit' },
    { id: 'delivery-orders:delete', name: 'Delete Delivery Orders', description: 'Remove delivery orders', module: 'Delivery Orders', action: 'delete' },
    
    // GRN (Goods Receipt Notes)
    { id: 'grn:view', name: 'View GRN', description: 'View goods receipt notes', module: 'GRN Management', action: 'view' },
    { id: 'grn:create', name: 'Create GRN', description: 'Create new goods receipt notes', module: 'GRN Management', action: 'create' },
    { id: 'grn:edit', name: 'Edit GRN', description: 'Modify goods receipt notes', module: 'GRN Management', action: 'edit' },
    { id: 'grn:delete', name: 'Delete GRN', description: 'Remove goods receipt notes', module: 'GRN Management', action: 'delete' },
    
    // Stock Management
    { id: 'stock:view', name: 'View Stock', description: 'View stock levels and movements', module: 'Stock Management', action: 'view' },
    { id: 'stock:edit', name: 'Edit Stock', description: 'Modify stock levels', module: 'Stock Management', action: 'edit' },
    { id: 'stock:transfer', name: 'Transfer Stock', description: 'Transfer stock between locations', module: 'Stock Management', action: 'transfer' },
    
    // Invoices
    { id: 'invoices:view', name: 'View Invoices', description: 'View invoices', module: 'Invoice Management', action: 'view' },
    { id: 'invoices:create', name: 'Create Invoices', description: 'Create new invoices', module: 'Invoice Management', action: 'create' },
    { id: 'invoices:edit', name: 'Edit Invoices', description: 'Modify invoices', module: 'Invoice Management', action: 'edit' },
    { id: 'invoices:delete', name: 'Delete Invoices', description: 'Remove invoices', module: 'Invoice Management', action: 'delete' },
    
    // Reports
    { id: 'reports:view', name: 'View Reports', description: 'Access to various reports', module: 'Reports', action: 'view' },
    { id: 'reports:export', name: 'Export Reports', description: 'Export reports to various formats', module: 'Reports', action: 'export' },
    
    // Warehouse Management
    { id: 'warehouse:view', name: 'View Warehouse', description: 'View warehouse information and locations', module: 'Warehouse Management', action: 'view' },
    { id: 'warehouse:manage', name: 'Manage Warehouse', description: 'Manage warehouse operations', module: 'Warehouse Management', action: 'manage' },
    
    // Cold Room Management
    { id: 'cold-rooms:view', name: 'View Cold Rooms', description: 'View cold room information', module: 'Cold Room Management', action: 'view' },
    { id: 'cold-rooms:manage', name: 'Manage Cold Rooms', description: 'Manage cold room operations', module: 'Cold Room Management', action: 'manage' },
    
    // Vehicle Management
    { id: 'vehicles:view', name: 'View Vehicles', description: 'View vehicle information', module: 'Vehicle Management', action: 'view' },
    { id: 'vehicles:create', name: 'Create Vehicles', description: 'Add new vehicles', module: 'Vehicle Management', action: 'create' },
    { id: 'vehicles:edit', name: 'Edit Vehicles', description: 'Modify vehicle information', module: 'Vehicle Management', action: 'edit' },
    { id: 'vehicles:delete', name: 'Delete Vehicles', description: 'Remove vehicles', module: 'Vehicle Management', action: 'delete' },
    
    // Driver Management
    { id: 'drivers:view', name: 'View Drivers', description: 'View driver information', module: 'Driver Management', action: 'view' },
    { id: 'drivers:create', name: 'Create Drivers', description: 'Add new drivers', module: 'Driver Management', action: 'create' },
    { id: 'drivers:edit', name: 'Edit Drivers', description: 'Modify driver information', module: 'Driver Management', action: 'edit' },
    { id: 'drivers:delete', name: 'Delete Drivers', description: 'Remove drivers', module: 'Driver Management', action: 'delete' }
];

async function seedPermissions() {
    try {
        console.log('🔐 Seeding permissions...');
        
        // Sync database to create tables if they don't exist
        const sequelize = require('../config/db');
        await sequelize.sync({ alter: true });
        console.log('📊 Database synced');
        
        // Clear existing permissions (only if table exists)
        try {
            await Permission.destroy({ where: {} });
            console.log('📝 Existing permissions cleared');
        } catch (error) {
            console.log('📝 No existing permissions to clear (table might be new)');
        }
        
        // Create all permissions
        await Permission.bulkCreate(permissions);
        console.log(`✅ Created ${permissions.length} permissions`);
        
        // Get all permissions for role assignment
        const allPermissions = await Permission.findAll();
        const permissionIds = allPermissions.map(p => p.id);
        
        // Assign all permissions to admin role (id: 1)
        const adminRole = await Role.findByPk(1);
        if (adminRole) {
            // Clear existing admin permissions
            await RolePermission.destroy({ where: { roleId: 1 } });
            
            // Create new role permissions for admin
            const adminRolePermissions = permissionIds.map(permissionId => ({
                roleId: 1,
                permissionId
            }));
            
            await RolePermission.bulkCreate(adminRolePermissions);
            console.log(`✅ Assigned ${permissionIds.length} permissions to admin role`);
        }
        
        // Assign basic permissions to manager role (id: 2)
        const managerRole = await Role.findByPk(2);
        if (managerRole) {
            const managerPermissions = [
                'dashboard:view',
                'inventory:view', 'inventory:create', 'inventory:edit',
                'categories:view', 'categories:create', 'categories:edit',
                'suppliers:view', 'suppliers:create', 'suppliers:edit',
                'customers:view', 'customers:create', 'customers:edit',
                'purchase-orders:view', 'purchase-orders:create', 'purchase-orders:edit',
                'sales-orders:view', 'sales-orders:create', 'sales-orders:edit',
                'delivery-orders:view', 'delivery-orders:create', 'delivery-orders:edit',
                'grn:view', 'grn:create', 'grn:edit',
                'stock:view', 'stock:edit', 'stock:transfer',
                'invoices:view', 'invoices:create', 'invoices:edit',
                'reports:view', 'reports:export',
                'warehouse:view', 'warehouse:manage',
                'vehicles:view', 'vehicles:create', 'vehicles:edit',
                'drivers:view', 'drivers:create', 'drivers:edit',
                'users:view'
            ];
            
            // Clear existing manager permissions
            await RolePermission.destroy({ where: { roleId: 2 } });
            
            const managerRolePermissions = managerPermissions.map(permissionId => ({
                roleId: 2,
                permissionId
            }));
            
            await RolePermission.bulkCreate(managerRolePermissions);
            console.log(`✅ Assigned ${managerPermissions.length} permissions to manager role`);
        }
        
        // Assign basic permissions to user role (id: 3)
        const userRole = await Role.findByPk(3);
        if (userRole) {
            const userPermissions = [
                'dashboard:view',
                'inventory:view',
                'categories:view',
                'suppliers:view',
                'customers:view',
                'stock:view',
                'reports:view'
            ];
            
            // Clear existing user permissions
            await RolePermission.destroy({ where: { roleId: 3 } });
            
            const userRolePermissions = userPermissions.map(permissionId => ({
                roleId: 3,
                permissionId
            }));
            
            await RolePermission.bulkCreate(userRolePermissions);
            console.log(`✅ Assigned ${userPermissions.length} permissions to user role`);
        }
        
        console.log('🎉 Permission seeding completed successfully!');
        
        // Display summary
        console.log('\n📊 Permission Summary:');
        const moduleGroups = permissions.reduce((acc, permission) => {
            if (!acc[permission.module]) acc[permission.module] = 0;
            acc[permission.module]++;
            return acc;
        }, {});
        
        Object.entries(moduleGroups).forEach(([module, count]) => {
            console.log(`   ${module}: ${count} permissions`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding permissions:', error);
        process.exit(1);
    }
}

// Run the seeder
seedPermissions();
