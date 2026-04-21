require('dotenv').config()
const { Sequelize } = require('sequelize')

const sequelize = new Sequelize(
  process.env.DB_NAME || 'sistema_ambiental',
  process.env.DB_USER || 'admin',
  process.env.DB_PASSWORD || 'admin123',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false, // set to console.log to see raw SQL
  }
)

const authenticateDB = async () => {
  try {
    await sequelize.authenticate()
    console.log('✅ Conectado a PostgreSQL a través de Sequelize (ORM)')
  } catch (error) {
    console.error('❌ Error de conexión a BD con Sequelize:', error)
  }
}

authenticateDB()

module.exports = sequelize
