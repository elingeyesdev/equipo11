const QUERY_PARAMS_BASE = [
  'lev_10_m_above_ground=on',
  'lev_mean_sea_level=on',
  'lev_surface=on',
  'lev_3000-0_m_above_ground=on',
  'lev_entire_atmosphere=on',
  'var_UGRD=on',
  'var_VGRD=on',
  'var_GUST=on',
  'var_PRMSL=on',
  'var_VIS=on',
  'var_CAPE=on',
  'var_HLCY=on',
  'var_REFC=on',
].join('&');

const QUERY_PARAMS_RAIN = [
  'lev_surface=on',                 // Requerido para lluvia
  'var_CRAIN=on',                   // Lluvia Categórica
  'var_CSNOW=on',                   // Nieve Categórica
  'var_PRATE=on',                   // Tasa de Precipitación Continua
].join('&');

/**
 * Construye URL de descarga GRIB2 de NOAA NOMADS.
 * @param {string} dateStr — formato YYYYMMDD
 * @param {string} hour    — ciclo horario ('00','06','12','18')
 * @param {string} offset  — offset del forecast ('f000','f003',...)
 * @param {string} type    — 'base' o 'rain'
 * @returns {string} URL completa
 */
function buildNOAAUrl(dateStr, hour, offset, type = 'base') {
  // Regla estricta: NUNCA solicitar f000 porque PRATE (Precipitación) es acumulada
  // y solo existe a partir de f001. Si algún script pide f000, lo forzamos a f001.
  if (offset === 'f000' || offset === '000' || offset == 0) {
    offset = 'f001';
  }
  
  const queryParams = type === 'rain' ? QUERY_PARAMS_RAIN : QUERY_PARAMS_BASE;
  return `https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl?file=gfs.t${hour}z.pgrb2.0p25.${offset}&${queryParams}&dir=%2Fgfs.${dateStr}%2F${hour}%2Fatmos`;
}

module.exports = { buildNOAAUrl };
