const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'code_aqua_erp',
  process.env.DB_USER || 'admin',
  process.env.DB_PASSWORD || 'n1TOYQevF4wDIdVcPZjR',
  {
    host: process.env.DB_HOST || 'codeaquariummysql.cpg6i88e4h6e.ap-south-1.rds.amazonaws.com',
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