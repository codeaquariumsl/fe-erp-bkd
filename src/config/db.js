const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'code_aqua_erp',
  process.env.DB_USER || 'your_db_user',
  process.env.DB_PASSWORD || 'your_db_password_here',
  {
    host: process.env.DB_HOST || 'awszincaterp-rds4.cv2ayygkuooc.ap-south-1.rds.amazonaws.com',
    port: process.env.DB_PORT || 3307,
    dialect: 'mysql',
    logging: false, // set to true if you want SQL logs
  }
);

sequelize.authenticate()
  .then(() => {
    console.log('Connected to the database via Sequelize.');
  })
  .catch((err) => {
    console.error('Unable to connect to the database:', err);
  });

module.exports = sequelize;