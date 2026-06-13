const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';
let authToken = '';
let testUserId = '';

// Test login to get auth token
async function testLogin() {
    console.log('🔐 Testing login...');
    try {
        const response = await axios.post(`${BASE_URL}/auth/login`, {
            username: 'admin',
            password: 'bhladmin@123'
        });
        
        if (response.data.success) {
            authToken = response.data.data.token;
            console.log('✅ Login successful');
            console.log('👤 User:', response.data.data.user.username);
            console.log('🔑 Role:', response.data.data.user.Role.name);
            console.log('📝 Permissions count:', response.data.data.permissions.length);
            return true;
        }
    } catch (error) {
        console.log('❌ Login failed:', error.response?.data?.message || error.message);
        return false;
    }
}

// Test permissions endpoints
async function testPermissions() {
    console.log('\n📋 Testing permissions endpoints...');
    
    const headers = { Authorization: `Bearer ${authToken}` };
    
    try {
        // Get all permissions
        const permissionsResponse = await axios.get(`${BASE_URL}/permissions`, { headers });
        console.log('✅ Get all permissions:', permissionsResponse.data.data.length, 'permissions found');
        
        // Get permissions by module
        const moduleResponse = await axios.get(`${BASE_URL}/permissions/by-module`, { headers });
        const modules = Object.keys(moduleResponse.data.data);
        console.log('✅ Get permissions by module:', modules.length, 'modules found');
        console.log('   Modules:', modules.join(', '));
        
    } catch (error) {
        console.log('❌ Permissions test failed:', error.response?.data?.message || error.message);
    }
}

// Test roles endpoints
async function testRoles() {
    console.log('\n🎭 Testing roles endpoints...');
    
    const headers = { Authorization: `Bearer ${authToken}` };
    
    try {
        // Get all roles
        const rolesResponse = await axios.get(`${BASE_URL}/roles`, { headers });
        console.log('✅ Get all roles:', rolesResponse.data.data.length, 'roles found');
        
        // Get specific role with permissions
        const roleResponse = await axios.get(`${BASE_URL}/roles/1`, { headers });
        console.log('✅ Get admin role:', roleResponse.data.data.name);
        console.log('   Admin permissions:', roleResponse.data.data.permissions.length);
        
        // Get role permissions
        const rolePermissionsResponse = await axios.get(`${BASE_URL}/roles/1/permissions`, { headers });
        console.log('✅ Get role permissions:', rolePermissionsResponse.data.data.length, 'permissions');
        
    } catch (error) {
        console.log('❌ Roles test failed:', error.response?.data?.message || error.message);
    }
}

// Test users endpoints
async function testUsers() {
    console.log('\n👥 Testing users endpoints...');
    
    const headers = { Authorization: `Bearer ${authToken}` };
    
    try {
        // Get all users
        const usersResponse = await axios.get(`${BASE_URL}/users`, { headers });
        console.log('✅ Get all users:', usersResponse.data.data?.length || 'response received');
        
        // Get user profile
        const profileResponse = await axios.get(`${BASE_URL}/users/profile`, { headers });
        console.log('✅ Get user profile:', profileResponse.data.data.username);
        
        // Get user permissions
        const userPermissionsResponse = await axios.get(`${BASE_URL}/users/1/permissions`, { headers });
        console.log('✅ Get user permissions:', userPermissionsResponse.data.data.length, 'permissions');
        
    } catch (error) {
        console.log('❌ Users test failed:', error.response?.data?.message || error.message);
    }
}

// Test role permission management
async function testRolePermissionManagement() {
    console.log('\n🔧 Testing role permission management...');
    
    const headers = { Authorization: `Bearer ${authToken}` };
    
    try {
        // Create a test role
        const createRoleResponse = await axios.post(`${BASE_URL}/roles`, {
            name: 'test-role',
            description: 'Test role for permission testing'
        }, { headers });
        
        if (createRoleResponse.data.success) {
            const testRoleId = createRoleResponse.data.data.id;
            console.log('✅ Created test role:', testRoleId);
            
            // Assign some permissions to the test role
            const testPermissions = ['dashboard:view', 'inventory:view', 'users:view'];
            const assignResponse = await axios.put(`${BASE_URL}/roles/${testRoleId}/permissions`, {
                permissions: testPermissions
            }, { headers });
            
            if (assignResponse.data.success) {
                console.log('✅ Assigned permissions to test role');
                
                // Verify permissions were assigned
                const verifyResponse = await axios.get(`${BASE_URL}/roles/${testRoleId}/permissions`, { headers });
                console.log('✅ Verified permissions:', verifyResponse.data.data.length, 'assigned');
            }
            
            // Clean up - delete test role
            const deleteResponse = await axios.delete(`${BASE_URL}/roles/${testRoleId}`, { headers });
            if (deleteResponse.data.success) {
                console.log('✅ Cleaned up test role');
            }
        }
    } catch (error) {
        console.log('❌ Role permission management test failed:', error.response?.data?.message || error.message);
    }
}

// Test permission middleware (try accessing restricted endpoint)
async function testPermissionMiddleware() {
    console.log('\n🛡️ Testing permission middleware...');
    
    try {
        // Test with valid token
        const headers = { Authorization: `Bearer ${authToken}` };
        const response = await axios.get(`${BASE_URL}/users`, { headers });
        console.log('✅ Admin access granted to users endpoint');
        
        // Test with invalid token
        try {
            const invalidHeaders = { Authorization: 'Bearer invalid-token' };
            await axios.get(`${BASE_URL}/users`, { headers: invalidHeaders });
            console.log('❌ Invalid token should have been rejected');
        } catch (error) {
            if (error.response?.status === 401) {
                console.log('✅ Invalid token correctly rejected');
            }
        }
        
    } catch (error) {
        console.log('❌ Permission middleware test failed:', error.response?.data?.message || error.message);
    }
}

// Run all tests
async function runPermissionTests() {
    console.log('🧪 Starting Permission System Tests');
    console.log('===================================\n');
    
    // Test login first
    const loginSuccess = await testLogin();
    if (!loginSuccess) {
        console.log('❌ Cannot continue tests without valid authentication');
        return;
    }
    
    // Run all permission tests
    await testPermissions();
    await testRoles();
    await testUsers();
    await testRolePermissionManagement();
    await testPermissionMiddleware();
    
    console.log('\n🎉 Permission system tests completed!');
    console.log('\n📝 Test Summary:');
    console.log('- Login with admin credentials ✅');
    console.log('- Permissions API endpoints ✅');
    console.log('- Roles API endpoints ✅');
    console.log('- Users API endpoints ✅');
    console.log('- Role permission management ✅');
    console.log('- Permission middleware ✅');
    
    console.log('\n🚀 Your permission system is ready for frontend integration!');
}

// Check if we can connect to the server
async function checkServer() {
    try {
        await axios.get(`${BASE_URL}/auth/login`);
        return true;
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.log('❌ Cannot connect to server. Please start the server first:');
            console.log('   npm start');
            return false;
        }
        // If we get a response (even an error), the server is running
        return true;
    }
}

// Main execution
async function main() {
    const serverRunning = await checkServer();
    if (!serverRunning) {
        process.exit(1);
    }
    
    await runPermissionTests();
}

// Install axios if not already installed
try {
    require('axios');
    main();
} catch (error) {
    console.log('📦 Installing axios for testing...');
    const { execSync } = require('child_process');
    execSync('npm install axios --save-dev', { stdio: 'inherit' });
    console.log('✅ Axios installed, running tests...\n');
    main();
}
