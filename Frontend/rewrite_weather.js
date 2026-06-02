const fs = require('fs');

let content = fs.readFileSync('src/components/MapaMonitoreo/WeatherOverlay.jsx', 'utf8');

content = content.replace(/function WeatherOverlay\(\{\n  scannedGrid,/, "function WeatherOverlay({\n  idPrefix = 'global',\n  scannedGrid,");

content = content.replace(/const aqiLayerRef = useRef\(null\);/, `const aqiLayerRef = useRef(null);

  const windLayerId = \`wind-color-layer-\${idPrefix}\`;
  const windCoastlineId = \`custom-coastline-wind-\${idPrefix}\`;
  const windLabelSourceId = \`global-wind-cities-source-\${idPrefix}\`;
  const windLabelLayerId = \`global-wind-cities-label-\${idPrefix}\`;

  const rainLayerId = \`rain-color-layer-\${idPrefix}\`;
  const rainCoastlineId = \`custom-coastline-rain-\${idPrefix}\`;

  const snowLayerId = \`snow-color-layer-\${idPrefix}\`;
  const snowCoastlineId = \`custom-coastline-snow-\${idPrefix}\`;

  const visLayerId = \`visibility-color-layer-\${idPrefix}\`;
  const visCoastlineId = \`custom-coastline-vis-\${idPrefix}\`;

  const tempLayerId = \`temp-color-layer-\${idPrefix}\`;
  const tempCoastlineId = \`custom-coastline-temp-\${idPrefix}\`;
  const tempLabelSourceId = \`city-temp-source-\${idPrefix}\`;
  const tempLabelLayerId = \`city-temp-labels-\${idPrefix}\`;

  const aqiLayerId = \`aqi-color-layer-\${idPrefix}\`;
  const aqiCoastlineId = \`custom-coastline-aqi-\${idPrefix}\`;
`);

// WIND
content = content.replace(/if \(!rawMap\.getLayer\('wind-color-layer'\)\) \{/, "if (!rawMap.getLayer(windLayerId)) {");
content = content.replace(/new WindColorLayer\(\{ id: 'wind-color-layer', opacity: 0\.90 \}\);/, "new WindColorLayer({ id: windLayerId, opacity: 0.90 });");
content = content.replace(/addWindLayers\(rawMap, layer\);/, "addWindLayers(rawMap, layer, windCoastlineId);");
content = content.replace(/removeWindLayers\(rawMap\);/g, "removeWindLayers(rawMap, windLayerId, windCoastlineId, windLabelSourceId, windLabelLayerId);");

// RAIN
content = content.replace(/if \(!rawMap\.getLayer\('rain-color-layer'\)\) \{/, "if (!rawMap.getLayer(rainLayerId)) {");
content = content.replace(/new RainColorLayer\(\{ id: 'rain-color-layer', opacity: 0\.85 \}\);/, "new RainColorLayer({ id: rainLayerId, opacity: 0.85 });");
content = content.replace(/addRainLayers\(rawMap, layer\);/, "addRainLayers(rawMap, layer, rainCoastlineId);");
content = content.replace(/removeRainLayers\(rawMap\);/g, "removeRainLayers(rawMap, rainLayerId, rainCoastlineId);");

// SNOW
content = content.replace(/if \(!rawMap\.getLayer\('snow-color-layer'\)\) \{/, "if (!rawMap.getLayer(snowLayerId)) {");
content = content.replace(/id: 'snow-color-layer', opacity: 0\.85,/, "id: snowLayerId, opacity: 0.85,");
content = content.replace(/addSnowLayers\(rawMap, layer\);/, "addSnowLayers(rawMap, layer, snowCoastlineId);");
content = content.replace(/removeSnowLayers\(rawMap\);/g, "removeSnowLayers(rawMap, snowLayerId, snowCoastlineId);");

// VISIBILITY
content = content.replace(/if \(!rawMap\.getLayer\('visibility-color-layer'\)\) \{/, "if (!rawMap.getLayer(visLayerId)) {");
content = content.replace(/new VisibilityColorLayer\(\{ id: 'visibility-color-layer', opacity: 0\.85 \}\);/, "new VisibilityColorLayer({ id: visLayerId, opacity: 0.85 });");
content = content.replace(/addVisibilityLayers\(rawMap, layer\);/, "addVisibilityLayers(rawMap, layer, visCoastlineId);");
content = content.replace(/removeVisibilityLayers\(rawMap\);/g, "removeVisibilityLayers(rawMap, visLayerId, visCoastlineId);");

// TEMP
content = content.replace(/if \(!rawMap\.getLayer\('temp-color-layer'\)\) \{/, "if (!rawMap.getLayer(tempLayerId)) {");
content = content.replace(/new TempColorLayer\(\{ id: 'temp-color-layer', opacity: 0\.90 \}\);/, "new TempColorLayer({ id: tempLayerId, opacity: 0.90 });");
content = content.replace(/addTempLayers\(rawMap, layer\);/, "addTempLayers(rawMap, layer, tempCoastlineId);");
content = content.replace(/removeTempLayers\(rawMap\);/g, "removeTempLayers(rawMap, tempLayerId, tempCoastlineId, tempLabelSourceId, tempLabelLayerId);");

// AQI
content = content.replace(/if \(!rawMap\.getLayer\('aqi-color-layer'\)\) \{/, "if (!rawMap.getLayer(aqiLayerId)) {");
content = content.replace(/new AqiColorLayer\(\{ id: 'aqi-color-layer', opacity: 0\.90 \}\);/, "new AqiColorLayer({ id: aqiLayerId, opacity: 0.90 });");
content = content.replace(/addAqiLayers\(rawMap, layer\);/, "addAqiLayers(rawMap, layer, aqiCoastlineId);");
content = content.replace(/removeAqiLayers\(rawMap\);/g, "removeAqiLayers(rawMap, aqiLayerId, aqiCoastlineId);");

fs.writeFileSync('src/components/MapaMonitoreo/WeatherOverlay.jsx', content);
console.log('Done rewriting WeatherOverlay.jsx');
