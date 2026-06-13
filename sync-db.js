const dbModels = require('./src/models');

async function sync() {
    try {
        console.log('Starting database sync...');
        await dbModels.sequelize.sync({ alter: true });
        console.log('Database synced successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Error syncing database:', error);
        process.exit(1);
    }
}

sync();
