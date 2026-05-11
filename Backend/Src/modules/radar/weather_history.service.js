const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Reutilizamos la lógica de directorios de radar.service si fuera necesario, 
// pero aquí definimos los específicos de historial
const DATA_DIR = path.join(process.cwd(), 'data');
const HIST_RAW_DIR = path.join(DATA_DIR, 'HistoricalPredictions', 'raw');
const HIST_PROCESSED_DIR = path.join(DATA_DIR, 'HistoricalPredictions', 'Processed');

/**
 * Genera la URL de NOMADS para una fecha, hora y offset (f000, f024, etc)
 */
const getNOAAUrl = (dateObj, cycleHour, forecastOffset) => {
    const yyyy = dateObj.getUTCFullYear();
    const mm = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getUTCDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;

    // Ejemplo: gfs.t12z.pgrb2.0p25.f024
    return `https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl?file=gfs.t${cycleHour}z.pgrb2.0p25.${forecastOffset}&lev_10_m_above_ground=on&lev_mean_sea_level=on&lev_surface=on&var_UGRD=on&var_VGRD=on&var_GUST=on&var_PRMSL=on&var_CRAIN=on&var_CSNOW=on&var_VIS=on&dir=%2Fgfs.${dateStr}%2F${cycleHour}%2Fatmos`;
};

/**
 * Descarga un archivo GRIB histórico si no existe
 */
const downloadHistoricalGrib = async (dateObj, cycleHour, offset) => {
    const yyyy = dateObj.getUTCFullYear();
    const mm = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getUTCDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;
    
    const fileName = `gfs_${dateStr}_${cycleHour}_${offset}.grib2`;
    const filePath = path.join(HIST_RAW_DIR, fileName);

    if (fs.existsSync(filePath)) {
        return filePath;
    }

    const url = getNOAAUrl(dateObj, cycleHour, offset);
    console.log(`[Weather History] Descargando ${fileName}...`);
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`[Weather History] No disponible: ${fileName} (${response.status})`);
            return null;
        }
        const buffer = await response.arrayBuffer();
        fs.writeFileSync(filePath, Buffer.from(buffer));
        return filePath;
    } catch (e) {
        console.error(`[Weather History] Error descargando ${fileName}:`, e.message);
        return null;
    }
};

/**
 * Recolecta los últimos N días de datos para entrenamiento
 */
const collectTrainingData = async (days = 7) => {
    console.log(`[Weather History] Iniciando recolección de ${days} días para entrenamiento IA...`);
    
    const cycles = ['00', '06', '12', '18'];
    const now = new Date();
    
    for (let i = 1; i <= days; i++) {
        const d = new Date(now);
        d.setUTCDate(d.getUTCDate() - i);
        
        for (const cycle of cycles) {
            // 1. Descargar el "Análisis" (Lo que pasó realmente según NOAA)
            await downloadHistoricalGrib(d, cycle, 'f000');
            
            // 2. Descargar el "Pronóstico" hecho 24h antes para ese mismo momento
            // Para simplificar, buscamos el forecast f024 del día anterior en el mismo ciclo
            const prevDay = new Date(d);
            prevDay.setUTCDate(prevDay.getUTCDate() - 1);
            await downloadHistoricalGrib(prevDay, cycle, 'f024');
        }
    }
    
    console.log(`[Weather History] Recolección completada.`);
};

module.exports = {
    collectTrainingData
};
