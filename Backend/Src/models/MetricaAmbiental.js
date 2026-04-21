const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const MetricaAmbiental = sequelize.define('MetricaAmbiental', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  latitud: {
    type: DataTypes.DECIMAL(9, 6),
    allowNull: false,
  },
  longitud: {
    type: DataTypes.DECIMAL(9, 6),
    allowNull: false,
  },
  ciudad: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },
  temperatura: {
    type: DataTypes.DECIMAL(5, 2),
  },
  aqi: {
    type: DataTypes.INTEGER,
  },
  condicion_climatica: {
    type: DataTypes.STRING(50),
  },
  detalles: {
    type: DataTypes.JSONB,
  },
  fecha_registro: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  }
}, {
  tableName: 'metricas_ambientales',
  timestamps: false // Porque ya tenemos fecha_registro manualmente manejado y no creamos createdAt/updatedAt
});

module.exports = MetricaAmbiental;
