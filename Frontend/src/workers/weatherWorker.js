// Frontend/src/workers/weatherWorker.js

const decodificarPixel = (r, g, layer) => {
  if (layer === 'temperatura') return (r / 255.0) * 120.0 - 60.0;
  if (layer === 'lluvia') return (r / 255.0) * 20.0;
  if (layer === 'evaporacion') return (r / 255.0) * 500.0;
  if (layer === 'viento') {
    const u_ms = ((r / 255.0) * 200) - 100;
    const v_ms = ((g / 255.0) * 200) - 100;
    return Math.sqrt(Math.pow(u_ms, 2) + Math.pow(v_ms, 2)) * 3.6;
  }
  if (layer === 'visibilidad') return (r / 255.0) * 24.14;
  if (layer === 'humedad') return (r / 255.0) * 100.0;
  if (layer === 'uv') return (r / 255.0) * 16.0;
  if (layer === 'nieve') return (r / 255.0) * 150.0;
  return null;
};

self.onmessage = async (e) => {
  const { 
    lat, lon, regionName, geometry, 
    locations, 
    isMassiveExport, 
    startDate, endDate, intervalHours, selectedLayers 
  } = e.data;
  
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const dates = [];
    for (let current = new Date(start); current <= end; current.setHours(current.getHours() + intervalHours)) {
      dates.push(new Date(current));
    }

    const targets = isMassiveExport && locations ? locations : [{ name: regionName || 'Coordenadas Manuales', lat, lon, geometry }];
    const imageCache = {};
    const results = []; 

    for (const target of targets) {
      const targetData = [];

      for (const current of dates) {
        const year = current.getUTCFullYear();
        const month = String(current.getUTCMonth() + 1).padStart(2, '0');
        const day = String(current.getUTCDate()).padStart(2, '0');
        const hour = String(current.getUTCHours()).padStart(2, '0');
        
        const dateStr = `${year}${month}${day}_${hour}00`;
        const timePoint = { date: current.toISOString() };

        for (const layer of selectedLayers) {
          try {
            const cacheKey = `${layer}_${dateStr}`;
            let bitmap = imageCache[cacheKey];

            if (!bitmap) {
              const url = `${import.meta.env.VITE_MAP_DATA_URL}/${layer}/${year}/${month}/${dateStr}.png`;
              const response = await fetch(url);
              if (!response.ok) throw new Error("Not found");
              
              const blob = await response.blob();
              bitmap = await createImageBitmap(blob);
              imageCache[cacheKey] = bitmap;
            }

            const width = bitmap.width;
            const height = bitmap.height;
            const canvas = new OffscreenCanvas(width, height);
            const tempCtx = canvas.getContext('2d', { willReadFrequently: true });

            if (target.geometry && (target.geometry.type === 'Polygon' || target.geometry.type === 'MultiPolygon')) {
              // ZONAL STATISTICS (MEDIANA)
              tempCtx.clearRect(0, 0, width, height);
              tempCtx.save();
              tempCtx.beginPath();

              const drawPolygon = (coordsArray) => {
                const coords = coordsArray[0]; // exterior ring
                coords.forEach(([lng, pLat], index) => {
                  let u = ((lng + 180) / 360) + (layer === 'evaporacion' ? 0.5 : 0.0);
                  u = u - Math.floor(u);
                  const pxX = u * width;
                  const pxY = ((pLat + 90) / 180) * height;
                  
                  if (index === 0) tempCtx.moveTo(pxX, pxY);
                  else tempCtx.lineTo(pxX, pxY);
                });
              };

              if (target.geometry.type === 'Polygon') {
                drawPolygon(target.geometry.coordinates);
              } else if (target.geometry.type === 'MultiPolygon') {
                target.geometry.coordinates.forEach(polyCoords => drawPolygon(polyCoords));
              }

              tempCtx.closePath();
              tempCtx.clip();
              tempCtx.drawImage(bitmap, 0, 0, width, height);
              tempCtx.restore();

              const imageData = tempCtx.getImageData(0, 0, width, height).data;
              const validValues = [];

              for (let i = 0; i < imageData.length; i += 4) {
                const alpha = imageData[i + 3];
                if (alpha > 0) {
                  const r = imageData[i];
                  const g = imageData[i + 1];
                  const val = decodificarPixel(r, g, layer);
                  validValues.push(val);
                }
              }

              let finalValue = null;
              if (validValues.length > 0) {
                validValues.sort((a, b) => a - b);
                const mid = Math.floor(validValues.length / 2);
                finalValue = validValues.length % 2 !== 0 ? validValues[mid] : (validValues[mid - 1] + validValues[mid]) / 2;
              }
              timePoint[layer] = finalValue;

            } else {
              // FALLBACK A PUNTO EXACTO
              tempCtx.drawImage(bitmap, 0, 0);
              const normLng = ((target.lon % 360) + 540) % 360 - 180;
              const normLat = Math.max(-90, Math.min(90, target.lat));

              let u = ((normLng + 180) / 360) + (layer === 'evaporacion' ? 0.5 : 0.0);
              u = u - Math.floor(u);
              const pxX = Math.floor(u * width);
              
              const pxY = Math.floor(((normLat + 90) / 180) * height);

              const pixel = tempCtx.getImageData(pxX, pxY, 1, 1).data;
              const val = decodificarPixel(pixel[0], pixel[1], layer);
              timePoint[layer] = val;
            }

          } catch (err) {
            timePoint[layer] = null;
          }
        }
        targetData.push(timePoint);
      }
      results.push({ name: target.name, lat: target.lat, lon: target.lon, data: targetData });
    }
    
    if (isMassiveExport) {
      self.postMessage({ status: 'success', isMassive: true, data: results });
    } else {
      self.postMessage({ status: 'success', isMassive: false, data: results[0].data });
    }
  } catch (error) {
    self.postMessage({ status: 'error', error: error.message });
  }
};
