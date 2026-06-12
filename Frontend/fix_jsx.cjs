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
        let modified = false;

        // Replace icon="<svg...>" with icon={<svg...>}
        if (content.match(/icon="<svg[^>]*>[\s\S]*?<\/svg>"/)) {
            content = content.replace(/icon="(<svg[^>]*>[\s\S]*?<\/svg>)"/g, 'icon={$1}');
            modified = true;
        }

        // Replace icon: '<svg...>' with icon: <svg...>
        if (content.match(/icon:\s*'(<svg[^>]*>[\s\S]*?<\/svg>)'/)) {
            content = content.replace(/icon:\s*'(<svg[^>]*>[\s\S]*?<\/svg>)'/g, 'icon: $1');
            modified = true;
        }

        if (modified) {
            fs.writeFileSync(filepath, content, 'utf-8');
            console.log(`Updated ${filepath}`);
        }
    } else {
        console.log(`File not found: ${filepath}`);
    }
});
