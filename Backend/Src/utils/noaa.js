const QUERY_PARAMS = [
  'lev_10_m_above_ground=on',
  'lev_mean_sea_level=on',
  'lev_surface=on',
  'lev_3000-0_m_above_ground=on',
  'lev_entire_atmosphere=on',
  'var_UGRD=on',
  'var_VGRD=on',
  'var_GUST=on',
  'var_PRMSL=on',
  'var_CRAIN=on',
  'var_CSNOW=on',
  'var_VIS=on',
  'var_CAPE=on',
  'var_HLCY=on',
  'var_REFC=on',
].join('&');

/**
 * Construye URL de descarga GRIB2 de NOAA NOMADS.
 * @param {string} dateStr — formato YYYYMMDD
 * @param {string} hour    — ciclo horario ('00','06','12','18')
 * @param {string} offset  — offset del forecast ('f000','f003',...)
 * @returns {string} URL completa
 */
function buildNOAAUrl(dateStr, hour, offset) {
  return `https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl?file=gfs.t${hour}z.pgrb2.0p25.${offset}&${QUERY_PARAMS}&dir=%2Fgfs.${dateStr}%2F${hour}%2Fatmos`;
}

module.exports = { buildNOAAUrl };
