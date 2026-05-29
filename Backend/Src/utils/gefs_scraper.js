const QUERY_PARAMS_AQI = [
  'lev_surface=on',
  'var_PMTF=on' // PM2.5 (Particulate matter - fine)
].join('&');

/**
 * Construye URL de descarga GRIB2 de NOAA NOMADS para GEFS-Aerosol.
 * @param {string} dateStr — formato YYYYMMDD
 * @param {string} hour    — ciclo horario ('00','06','12','18')
 * @param {string} offset  — offset del forecast ('f000','f003',...)
 * @returns {string} URL completa
 */
function buildGEFSUrl(dateStr, hour, offset) {
  // CONSTANTES EXACTAS REQUERIDAS POR LA NOAA:
  const cgiScript = 'filter_gefs_chem_0p25.pl'; // ¡Ojo al _0p25!
  const fileName = `gefs.chem.t${hour}z.a2d_0p25.${offset}.grib2`; // a2d_0p25
  const directory = `%2Fgefs.${dateStr}%2F${hour}%2Fchem%2Fpgrb2ap25`; // ¡Debe incluir pgrb2ap25!

  // URL FINAL ARMADA:
  return `https://nomads.ncep.noaa.gov/cgi-bin/${cgiScript}?file=${fileName}&${QUERY_PARAMS_AQI}&dir=${directory}`;
}

module.exports = { buildGEFSUrl };
