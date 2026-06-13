const fs = require('fs');

const files = [
    "./src/pages/Reportes/Reportes.jsx",
    "./src/pages/PanelSimulacion/PanelSimulacion.jsx",
    "./src/pages/mobile/MobileMapView.jsx",
    "./src/components/ModalInyeccion/ModalInyeccion.jsx",
    "./src/components/MapaMonitoreo/CityHistoryPanel.jsx"
];

files.forEach(filepath => {
    if (fs.existsSync(filepath)) {
        let content = fs.readFileSync(filepath, 'utf-8');

        // Fix JS Object properties: icon: '<svg...>' or icon: <svg...>️' -> icon: <svg...>
        // We match "icon:", optional quotes, anything up to <svg>, the <svg> tag and contents, 
        // any stray characters after like quotes or invisible emoji modifiers, until the next comma or closing brace.
        content = content.replace(/icon:\s*['"]?.*?<svg([^>]*)>([\s\S]*?)<\/svg>.*?['"]?(?=\s*,|\s*})/g, 'icon: <svg$1>$2</svg>');

        // Fix JSX props: icon="<svg...>" or icon='<svg...>️' -> icon={<svg...>}
        // Lookahead ensures we are stopping before the next JSX prop like stats= or />
        content = content.replace(/icon=["']?.*?<svg([^>]*)>([\s\S]*?)<\/svg>.*?["']?(?=\s*[a-zA-Z]+={|\s*\/>|\s*>)/g, 'icon={<svg$1>$2</svg>}');

        // Specific leftover fix for '💦' in CityHistoryPanel and PanelSimulacion
        content = content.replace(/icon:\s*['"]?💦['"]?/g, 'icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>');

        fs.writeFileSync(filepath, content, 'utf-8');
        console.log(`Cleaned JSX in ${filepath}`);
    }
});
