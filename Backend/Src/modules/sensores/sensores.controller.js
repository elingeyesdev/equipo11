const { crearSensorMqtt, eliminarSensorMqtt, getSensoresMqtt } = require('./sensores.service');
const { crearSensorMqttSchema } = require('./sensores.schema');
const { success, error } = require('../../utils/response');

const crearSensorController = async (req, res) => {
  const parsed = crearSensorMqttSchema.safeParse(req.body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues?.[0]?.message || 'Datos de sensor inválidos';
    return error(res, errorMsg, 400);
  }

  try {
    const sensor = await crearSensorMqtt(parsed.data);
    success(res, { mensaje: 'Sensor MQTT agregado correctamente', sensor }, 201);
  } catch (err) {
    error(res, 'Error al agregar sensor: ' + err.message, 500);
  }
};

const eliminarSensorController = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return error(res, 'ID de sensor requerido', 400);
  }

  try {
    await eliminarSensorMqtt(id);
    success(res, { mensaje: 'Sensor MQTT eliminado correctamente' });
  } catch (err) {
    error(res, 'Error al eliminar sensor: ' + err.message, 500);
  }
};

const getSensoresMqttController = async (req, res) => {
  try {
    const sensores = await getSensoresMqtt();
    success(res, { count: sensores.length, data: sensores });
  } catch (err) {
    error(res, 'Error al obtener sensores MQTT: ' + err.message, 500);
  }
};

module.exports = {
  crearSensorController,
  eliminarSensorController,
  getSensoresMqttController
};
