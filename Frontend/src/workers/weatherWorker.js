// Frontend/src/workers/weatherWorker.js

self.onmessage = async (e) => {
  const { 
    lat, lon, regionName, 
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

    const targets = isMassiveExport && locations ? locations : [{ name: regionName || 'Coordenadas Manuales', lat, lon }];
    const imageCache = {};
    const results = []; 

    for (const target of targets) {
      const targetData = [];
      const normLng = ((target.lon % 360) + 540) % 360 - 180;
      const normLat = Math.max(-90, Math.min(90, target.lat));

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
            let ctx = imageCache[cacheKey];

            if (!ctx) {
              const url = `${import.meta.env.VITE_MAP_DATA_URL}/${layer}/${year}/${month}/${dateStr}.png`;
              const response = await fetch(url);
              if (!response.ok) throw new Error("Not found");
              
              const blob = await response.blob();
              const imageBitmap = await createImageBitmap(blob);
              
              const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
              const tempCtx = canvas.getContext('2d', { willReadFrequently: true });
              tempCtx.drawImage(imageBitmap, 0, 0);
              
              ctx = { context: tempCtx, width: imageBitmap.width, height: imageBitmap.height };
              imageCache[cacheKey] = ctx;
            }

            let u = ((normLng + 180) / 360) + (layer === 'evaporacion' ? 0.5 : 0.0);
            u = u - Math.floor(u);
            const pxX = Math.floor(u * ctx.width);
            const pxY = Math.floor(((normLat + 90) / 180) * ctx.height);

            const pixel = ctx.context.getImageData(pxX, pxY, 1, 1).data;
            const r = pixel[0];
            const g = pixel[1];

            let value = null;
            if (layer === 'temperatura') value = (r / 255.0) * 120.0 - 60.0;
            else if (layer === 'lluvia') value = (r / 255.0) * 20.0;
            else if (layer === 'evaporacion') value = (r / 255.0) * 500.0;
            else if (layer === 'viento') {
              const u_ms = ((r / 255.0) * 200) - 100;
              const v_ms = ((g / 255.0) * 200) - 100;
              value = Math.sqrt(Math.pow(u_ms, 2) + Math.pow(v_ms, 2)) * 3.6;
            }
            else if (layer === 'visibilidad') value = (r / 255.0) * 24.14;
            else if (layer === 'humedad') value = (r / 255.0) * 100.0;
            else if (layer === 'uv') value = (r / 255.0) * 16.0;
            else if (layer === 'nieve') value = (r / 255.0) * 150.0;

            timePoint[layer] = value;
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
