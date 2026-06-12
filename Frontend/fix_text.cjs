const fs = require('fs');

const files = [
    "./src/pages/PagePlaceholder.css",
    "./src/pages/Reportes/Reportes.css",
    "./src/pages/Alertas/Alertas.css",
    "./src/pages/Notificaciones/Notificaciones.css"
];

const rules = [
    // Fix illegible button text (export buttons in Reportes)
    [/color:\s*#1C2541/g, 'color: #FFFFFF'],
    
    // Fix generic dark colors like #333, #666, #000, black, etc.
    [/color:\s*(#333|#666|#000|#111|#222|black|#4b5563|#374151|#1f2937|#111827|#0f172a|#1e293b|#334155|#475569|#64748b)/gi, 'color: #D1D5DB'],
    
    // Fix elements that should be explicitly Tropical Teal based on user instruction
    // (e.g. `em` tags or specific highlighted spans)
    [/(color:\s*)#6366f1/g, '$1#5BC0BE'],
    [/(color:\s*)#a855f7/g, '$1#5BC0BE'],
    [/(color:\s*)#854d0e/g, '$1#D1D5DB'],
    [/(color:\s*)#059669/g, '$1#5BC0BE'],
    [/(color:\s*)#dc2626/g, '$1#D1D5DB'],
    [/(color:\s*)#d97706/g, '$1#D1D5DB'],
    [/(color:\s*)#3b82f6/g, '$1#5BC0BE'],
    
    // Check specific class text colors
    // In Reportes.css
    [/(.rep-input.*?\n[\s\S]*?color:\s*)[^\;]+(;)/g, '$1#FFFFFF$2'],
    [/(.rep-select.*?\n[\s\S]*?color:\s*)[^\;]+(;)/g, '$1#FFFFFF$2'],
    [/(.rep-rango-btn.*?\n[\s\S]*?color:\s*)[^\;]+(;)/g, '$1#FFFFFF$2'],
    [/(.rep-td-valor.*?\n[\s\S]*?color:\s*)[^\;]+(;)/g, '$1#FFFFFF$2'],
    
    // In Alertas.css
    [/(.alertas-input.*?\n[\s\S]*?color:\s*)[^\;]+(;)/g, '$1#FFFFFF$2'],
    [/(.alertas-select.*?\n[\s\S]*?color:\s*)[^\;]+(;)/g, '$1#FFFFFF$2'],
    [/(.alertas-btn-reconocer.*?\n[\s\S]*?color:\s*)[^\;]+(;)/g, '$1#FFFFFF$2'],
    [/(.alertas-pag-btn.*?\n[\s\S]*?color:\s*)[^\;]+(;)/g, '$1#FFFFFF$2'],
    
    // In Notificaciones.css
    [/(.notif-input-group input.*?\n[\s\S]*?color:\s*)[^\;]+(;)/g, '$1#FFFFFF$2'],
    [/(.notif-btn-save-header.*?\n[\s\S]*?color:\s*)[^\;]+(;)/g, '$1#FFFFFF$2'],
    
    // Ensure all inputs and selects have the right border and background if not already
    [/(background:\s*)#FFFFFF|#fff|white/gi, '$1#0B132B'],
    
    // Force texts to white if they are explicitly some dark shade not caught above
    [/(color:\s*)#4[0-9a-fA-F]{5}/g, '$1#D1D5DB'],
    [/(color:\s*)#5[0-9a-fA-F]{5}/g, '$1#D1D5DB']
];

files.forEach(filepath => {
    if (fs.existsSync(filepath)) {
        let content = fs.readFileSync(filepath, 'utf-8');
        
        // Manual specific fixes since regex might be too broad or miss
        // Reportes.css .rep-input, .rep-select
        content = content.replace(/\.rep-input,\s*\.rep-select\s*{[^}]*color:\s*[^;]+;/gi, (match) => {
            return match.replace(/color:\s*[^;]+;/, 'color: #FFFFFF;');
        });
        
        // .rep-rango-btn
        content = content.replace(/\.rep-rango-btn\s*{[^}]*color:\s*[^;]+;/gi, (match) => {
            return match.replace(/color:\s*[^;]+;/, 'color: #FFFFFF;');
        });

        // .alertas-input, .alertas-select
        content = content.replace(/\.alertas-input,\s*\.alertas-select\s*{[^}]*color:\s*[^;]+;/gi, (match) => {
            return match.replace(/color:\s*[^;]+;/, 'color: #FFFFFF;');
        });
        
        // .page-heading em
        content = content.replace(/\.page-heading em\s*{[^}]*color:\s*[^;]+;/gi, (match) => {
            return match.replace(/color:\s*[^;]+;/, 'color: #5BC0BE;');
        });
        
        // .placeholder-card h3 em
        content = content.replace(/\.placeholder-card h3 em\s*{[^}]*color:\s*[^;]+;/gi, (match) => {
            return match.replace(/color:\s*[^;]+;/, 'color: #5BC0BE;');
        });
        
        // .notif-title em
        content = content.replace(/\.notif-title em\s*{[^}]*color:\s*[^;]+;/gi, (match) => {
            return match.replace(/color:\s*[^;]+;/, 'color: #5BC0BE;');
        });

        // apply general rules
        rules.forEach(([pattern, replacement]) => {
            content = content.replace(pattern, replacement);
        });
        
        fs.writeFileSync(filepath, content, 'utf-8');
        console.log(`Updated ${filepath}`);
    } else {
        console.log(`File not found: ${filepath}`);
    }
});
