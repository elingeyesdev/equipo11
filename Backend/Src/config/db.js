require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'sistema_ambiental',
  user:     process.env.DB_USER     || 'admin',
  password: process.env.DB_PASSWORD || 'admin123',
})

pool.on('error', (err) => console.error('[pg] error en cliente idle:', err))

pool.connect()
  .then(c => { console.log('✅ Conectado a PostgreSQL (pg.Pool)'); c.release() })
  .catch(err => console.error('❌ Error de conexión a PostgreSQL:', err))

module.exports = pool
