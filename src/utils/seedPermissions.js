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
    { id: 'drivers:delete', name: 'Delete Drivers', description: 'Remove drivers', module: 'Driver Management', action: 'delete' },

    // Item Management
    { id: 'items:view', name: 'View Items', description: 'View items list', module: 'Item Management', action: 'view' },
    { id: 'items:create', name: 'Create Items', description: 'Create new items', module: 'Item Management', action: 'create' },
    { id: 'items:edit', name: 'Edit Items', description: 'Modify items', module: 'Item Management', action: 'edit' },
    { id: 'items:delete', name: 'Delete Items', description: 'Remove items', module: 'Item Management', action: 'delete' },

    // Batch Management
    { id: 'batches:view', name: 'View Batches', description: 'View batches', module: 'Batch Management', action: 'view' },
    { id: 'batches:create', name: 'Create Batches', description: 'Create new batches', module: 'Batch Management', action: 'create' },
    { id: 'batches:edit', name: 'Edit Batches', description: 'Modify batches', module: 'Batch Management', action: 'edit' },
    { id: 'batches:delete', name: 'Delete Batches', description: 'Remove batches', module: 'Batch Management', action: 'delete' },

    // Supplier Returns
    { id: 'supplier-returns:view', name: 'View Supplier Returns', description: 'View supplier returns', module: 'Supplier Returns', action: 'view' },
    { id: 'supplier-returns:create', name: 'Create Supplier Returns', description: 'Create supplier returns', module: 'Supplier Returns', action: 'create' },
    { id: 'supplier-returns:edit', name: 'Edit Supplier Returns', description: 'Modify supplier returns', module: 'Supplier Returns', action: 'edit' },
    { id: 'supplier-returns:delete', name: 'Delete Supplier Returns', description: 'Remove supplier returns', module: 'Supplier Returns', action: 'delete' },

    // Supplier Payments
    { id: 'supplier-payments:view', name: 'View Supplier Payments', description: 'View supplier payments', module: 'Supplier Payments', action: 'view' },
    { id: 'supplier-payments:create', name: 'Create Supplier Payments', description: 'Create supplier payments', module: 'Supplier Payments', action: 'create' },
    { id: 'supplier-payments:edit', name: 'Edit Supplier Payments', description: 'Modify supplier payments', module: 'Supplier Payments', action: 'edit' },
    { id: 'supplier-payments:delete', name: 'Delete Supplier Payments', description: 'Remove supplier payments', module: 'Supplier Payments', action: 'delete' },

    // Good Request Notes
    { id: 'good-request-notes:view', name: 'View Good Request Notes', description: 'View good request notes', module: 'Stock & Inventory', action: 'view' },
    { id: 'good-request-notes:create', name: 'Create Good Request Notes', description: 'Create good request notes', module: 'Stock & Inventory', action: 'create' },
    { id: 'good-request-notes:edit', name: 'Edit Good Request Notes', description: 'Modify good request notes', module: 'Stock & Inventory', action: 'edit' },
    { id: 'good-request-notes:delete', name: 'Delete Good Request Notes', description: 'Remove good request notes', module: 'Stock & Inventory', action: 'delete' },

    // Issue Notes
    { id: 'issue-notes:view', name: 'View Issue Notes', description: 'View issue notes', module: 'Stock & Inventory', action: 'view' },
    { id: 'issue-notes:create', name: 'Create Issue Notes', description: 'Create issue notes', module: 'Stock & Inventory', action: 'create' },
    { id: 'issue-notes:edit', name: 'Edit Issue Notes', description: 'Modify issue notes', module: 'Stock & Inventory', action: 'edit' },
    { id: 'issue-notes:delete', name: 'Delete Issue Notes', description: 'Remove issue notes', module: 'Stock & Inventory', action: 'delete' },

    // Transfer In Notes
    { id: 'transfer-in-notes:view', name: 'View Transfer In Notes', description: 'View transfer in notes', module: 'Stock & Inventory', action: 'view' },
    { id: 'transfer-in-notes:create', name: 'Create Transfer In Notes', description: 'Create transfer in notes', module: 'Stock & Inventory', action: 'create' },
    { id: 'transfer-in-notes:edit', name: 'Edit Transfer In Notes', description: 'Modify transfer in notes', module: 'Stock & Inventory', action: 'edit' },
    { id: 'transfer-in-notes:delete', name: 'Delete Transfer In Notes', description: 'Remove transfer in notes', module: 'Stock & Inventory', action: 'delete' },

    // Stock Adjustment
    { id: 'stock-adjustment:view', name: 'View Stock Adjustments', description: 'View stock adjustments', module: 'Stock & Inventory', action: 'view' },
    { id: 'stock-adjustment:create', name: 'Create Stock Adjustments', description: 'Create stock adjustments', module: 'Stock & Inventory', action: 'create' },
    { id: 'stock-adjustment:edit', name: 'Edit Stock Adjustments', description: 'Modify stock adjustments', module: 'Stock & Inventory', action: 'edit' },
    { id: 'stock-adjustment:delete', name: 'Delete Stock Adjustments', description: 'Remove stock adjustments', module: 'Stock & Inventory', action: 'delete' },

    // Stock Reconciliation
    { id: 'stock-reconciliation:view', name: 'View Stock Reconciliations', description: 'View stock reconciliations', module: 'Stock & Inventory', action: 'view' },
    { id: 'stock-reconciliation:create', name: 'Create Stock Reconciliations', description: 'Create stock reconciliations', module: 'Stock & Inventory', action: 'create' },
    { id: 'stock-reconciliation:edit', name: 'Edit Stock Reconciliations', description: 'Modify stock reconciliations', module: 'Stock & Inventory', action: 'edit' },
    { id: 'stock-reconciliation:delete', name: 'Delete Stock Reconciliations', description: 'Remove stock reconciliations', module: 'Stock & Inventory', action: 'delete' },

    // Receipts Management
    { id: 'receipts:view', name: 'View Receipts', description: 'View receipts', module: 'Receipt Management', action: 'view' },
    { id: 'receipts:create', name: 'Create Receipts', description: 'Create new receipts', module: 'Receipt Management', action: 'create' },
    { id: 'receipts:edit', name: 'Edit Receipts', description: 'Modify receipts', module: 'Receipt Management', action: 'edit' },
    { id: 'receipts:delete', name: 'Delete Receipts', description: 'Remove receipts', module: 'Receipt Management', action: 'delete' },

    // Credit Notes
    { id: 'credit-notes:view', name: 'View Credit Notes', description: 'View credit notes', module: 'Credit Notes', action: 'view' },
    { id: 'credit-notes:create', name: 'Create Credit Notes', description: 'Create new credit notes', module: 'Credit Notes', action: 'create' },
    { id: 'credit-notes:edit', name: 'Edit Credit Notes', description: 'Modify credit notes', module: 'Credit Notes', action: 'edit' },
    { id: 'credit-notes:delete', name: 'Delete Credit Notes', description: 'Remove credit notes', module: 'Credit Notes', action: 'delete' },

    // Customer Returns
    { id: 'customer-returns:view', name: 'View Customer Returns', description: 'View customer returns', module: 'Customer Returns', action: 'view' },
    { id: 'customer-returns:create', name: 'Create Customer Returns', description: 'Create new customer returns', module: 'Customer Returns', action: 'create' },
    { id: 'customer-returns:edit', name: 'Edit Customer Returns', description: 'Modify customer returns', module: 'Customer Returns', action: 'edit' },
    { id: 'customer-returns:delete', name: 'Delete Customer Returns', description: 'Remove customer returns', module: 'Customer Returns', action: 'delete' },

    // Customer Item Codes
    { id: 'customer-item-codes:view', name: 'View Customer Item Codes', description: 'View customer item codes', module: 'Customer Item Codes', action: 'view' },
    { id: 'customer-item-codes:create', name: 'Create Customer Item Codes', description: 'Create new customer item codes', module: 'Customer Item Codes', action: 'create' },
    { id: 'customer-item-codes:edit', name: 'Edit Customer Item Codes', description: 'Modify customer item codes', module: 'Customer Item Codes', action: 'edit' },
    { id: 'customer-item-codes:delete', name: 'Delete Customer Item Codes', description: 'Remove customer item codes', module: 'Customer Item Codes', action: 'delete' },

    // Finance & Accounting
    { id: 'accounting:view', name: 'View Accounting & Finance', description: 'View financial entries and accounts', module: 'Accounting & Finance', action: 'view' },
    { id: 'accounting:manage', name: 'Manage Accounting & Finance', description: 'Manage accounting transactions and posting rules', module: 'Accounting & Finance', action: 'manage' },

    // Bank Deposits
    { id: 'bank-deposits:view', name: 'View Bank Deposits', description: 'View bank deposits', module: 'Bank Deposits', action: 'view' },
    { id: 'bank-deposits:create', name: 'Create Bank Deposits', description: 'Create new bank deposits', module: 'Bank Deposits', action: 'create' },
    { id: 'bank-deposits:edit', name: 'Edit Bank Deposits', description: 'Modify bank deposits', module: 'Bank Deposits', action: 'edit' },
    { id: 'bank-deposits:delete', name: 'Delete Bank Deposits', description: 'Remove bank deposits', module: 'Bank Deposits', action: 'delete' },

    // Reports - Stock & Inventory
    { id: 'reports-stock-inventory:view', name: 'View Stock Inventory Reports Header', description: 'View stock inventory reports section', module: 'Reports - Stock & Inventory', action: 'view' },
    { id: 'reports-stock-reports:view', name: 'View Stock Reports', description: 'View detailed stock reports', module: 'Reports - Stock & Inventory', action: 'view' },
    { id: 'reports-stock-movements:view', name: 'View Stock Movements', description: 'View stock movements report', module: 'Reports - Stock & Inventory', action: 'view' },
    { id: 'reports-stock-enhanced-movements:view', name: 'View Enhanced Movements', description: 'View enhanced stock movements report', module: 'Reports - Stock & Inventory', action: 'view' },
    { id: 'reports-stock-gin-reports:view', name: 'View GIN Reports', description: 'View goods issue note reports', module: 'Reports - Stock & Inventory', action: 'view' },
    { id: 'reports-stock-inventory-valuation:view', name: 'View Inventory Valuation', description: 'View inventory valuation report', module: 'Reports - Stock & Inventory', action: 'view' },

    // Reports - Sales & Distribution
    { id: 'reports-sales-distribution:view', name: 'View Sales & Distribution Reports Header', description: 'View sales & distribution reports section', module: 'Reports - Sales & Distribution', action: 'view' },
    { id: 'reports-sales-general:view', name: 'View General Sales Report', description: 'View general sales summary report', module: 'Reports - Sales & Distribution', action: 'view' },
    { id: 'reports-sales-item-wise:view', name: 'View Item-wise Sales Report', description: 'View item-wise sales report', module: 'Reports - Sales & Distribution', action: 'view' },
    { id: 'reports-sales-by-item:view', name: 'View Sales by Item', description: 'View sales breakdown by item', module: 'Reports - Sales & Distribution', action: 'view' },
    { id: 'reports-sales-by-customer:view', name: 'View Sales by Customer', description: 'View sales breakdown by customer', module: 'Reports - Sales & Distribution', action: 'view' },
    { id: 'reports-sales-customer-item:view', name: 'View Customer Item Sales', description: 'View customer item report', module: 'Reports - Sales & Distribution', action: 'view' },
    { id: 'reports-sales-rep-wise:view', name: 'View Rep-wise Sales', description: 'View sales representative report', module: 'Reports - Sales & Distribution', action: 'view' },

    // Reports - Procurement & Purchasing
    { id: 'reports-procurement-purchasing:view', name: 'View Procurement & Purchasing Header', description: 'View procurement reports section', module: 'Reports - Procurement & Purchasing', action: 'view' },
    { id: 'reports-purchasing-grn-reports:view', name: 'View Purchasing GRN Reports', description: 'View purchasing GRN report', module: 'Reports - Procurement & Purchasing', action: 'view' },
    { id: 'reports-purchasing-item-wise:view', name: 'View Item-wise Purchasing', description: 'View item-wise purchasing report', module: 'Reports - Procurement & Purchasing', action: 'view' },
    { id: 'reports-purchasing-supplier-wise:view', name: 'View Supplier-wise PO Reports', description: 'View supplier-wise purchase order report', module: 'Reports - Procurement & Purchasing', action: 'view' },

    // Reports - Finance & Commission
    { id: 'reports-finance-commission:view', name: 'View Finance & Commission Header', description: 'View finance & commission section', module: 'Reports - Finance & Commission', action: 'view' },
    { id: 'reports-expenses:view', name: 'View Expenses Report', description: 'View expenses report', module: 'Reports - Finance & Commission', action: 'view' },
    { id: 'reports-salesperson-commission:view', name: 'View Salesperson Commission', description: 'View salesperson commission report', module: 'Reports - Finance & Commission', action: 'view' },

    // System Configuration - Units
    { id: 'units:view', name: 'View Units', description: 'View measurement units', module: 'System Configuration', action: 'view' },
    { id: 'units:create', name: 'Create Units', description: 'Create measurement units', module: 'System Configuration', action: 'create' },
    { id: 'units:edit', name: 'Edit Units', description: 'Modify measurement units', module: 'System Configuration', action: 'edit' },
    { id: 'units:delete', name: 'Delete Units', description: 'Remove measurement units', module: 'System Configuration', action: 'delete' },

    // System Configuration - Return Types
    { id: 'return-types:view', name: 'View Return Types', description: 'View return types', module: 'System Configuration', action: 'view' },
    { id: 'return-types:create', name: 'Create Return Types', description: 'Create return types', module: 'System Configuration', action: 'create' },
    { id: 'return-types:edit', name: 'Edit Return Types', description: 'Modify return types', module: 'System Configuration', action: 'edit' },
    { id: 'return-types:delete', name: 'Delete Return Types', description: 'Remove return types', module: 'System Configuration', action: 'delete' },

    // Dispatched Orders
    { id: 'dispatched-orders:view', name: 'View Dispatched Orders', description: 'View Dispatched Orders information', module: 'Dispatched Orders', action: 'view' },

    // Batch Schedule
    { id: 'batch-schedule:view', name: 'View Batch Schedule', description: 'Schedule items for batch processing', module: 'Batch Schedule', action: 'view' },

    // Routes Management
    { id: 'routes:view', name: 'View Routes', description: 'View all routes', module: 'Routes Management', action: 'view' },

    // Gin Management
    { id: 'gin:view', name: 'View Gin', description: 'View all gin', module: 'Gin Management', action: 'view' }
];

async function seedPermissions() {
    try {
        console.log('🔐 Seeding permissions...');

        // Sync database to create tables if they don't exist
        const sequelize = require('../config/db');
        // await sequelize.sync({ alter: true });
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
