const fs = require('fs');

const files = [
    "./src/pages/PagePlaceholder.css",
    "./src/pages/Reportes/Reportes.css",
    "./src/pages/Alertas/Alertas.css",
    "./src/pages/Notificaciones/Notificaciones.css"
];

// Replaces broken colors and sets proper dark mode text colors
const rules = [
    // 1. Fix the broken hex codes from previous script
    [/#0B132BFFF/gi, '#FFFFFF'],
    [/#0B132BFFFF/gi, '#FFFFFF'],
    
    // 2. Titles and highlighted words
    // .page-heading em, .notif-title em, etc. -> #5BC0BE
    [/\.page-heading em\s*{[^}]*color:\s*[^;]+;/gi, match => match.replace(/color:\s*[^;]+;/, 'color: #5BC0BE;')],
    [/\.placeholder-card h3 em\s*{[^}]*color:\s*[^;]+;/gi, match => match.replace(/color:\s*[^;]+;/, 'color: #5BC0BE;')],
    [/\.notif-title em\s*{[^}]*color:\s*[^;]+;/gi, match => match.replace(/color:\s*[^;]+;/, 'color: #5BC0BE;')],
    
    // 3. Inputs, Selects, Forms text
    [/\.rep-input,\s*\.rep-select\s*{[^}]*color:\s*[^;]+;/gi, match => match.replace(/color:\s*[^;]+;/, 'color: #FFFFFF;')],
    [/\.alertas-input,\s*\.alertas-select\s*{[^}]*color:\s*[^;]+;/gi, match => match.replace(/color:\s*[^;]+;/, 'color: #FFFFFF;')],
    [/\.notif-input-group input\s*{[^}]*color:\s*[^;]+;/gi, match => match.replace(/color:\s*[^;]+;/, 'color: #FFFFFF;')],
    
    // 4. Secondary buttons and small labels (Rango Rápido, etc.)
    [/\.rep-rango-btn\s*{[^}]*color:\s*[^;]+;/gi, match => match.replace(/color:\s*[^;]+;/, 'color: #FFFFFF;')],
    [/\.rep-kpi-range\s*{[^}]*color:\s*[^;]+;/gi, match => match.replace(/color:\s*[^;]+;/, 'color: #9CA3AF;')],
    [/\.rep-chart-sub\s*{[^}]*color:\s*[^;]+;/gi, match => match.replace(/color:\s*[^;]+;/, 'color: #9CA3AF;')],
    [/\.alertas-unidad\s*{[^}]*color:\s*[^;]+;/gi, match => match.replace(/color:\s*[^;]+;/, 'color: #9CA3AF;')],
    [/\.alertas-td-label\s*{[^}]*color:\s*[^;]+;/gi, match => match.replace(/color:\s*[^;]+;/, 'color: #9CA3AF;')],

    // Sweep any remaining dark colors used in texts (except background and borders)
    [/(color:\s*)(#[0-9a-f]{3,6}|black|rgba?\([^)]+\))/gi, (match, p1, p2) => {
        // Known dark/unreadable colors to be replaced with gray-300 (#D1D5DB) or white
        const darkColors = ['#000', '#000000', 'black', '#1c2541', '#0b132b', '#1e4e6d', '#7a4b0c', '#553d78', '#333', '#666', '#854d0e', '#111827', '#1e293b', '#334155'];
        if (darkColors.includes(p2.toLowerCase())) {
            return p1 + '#D1D5DB';
        }
        return match;
    }],

    // Make sure PageEyebrow is #5BC0BE
    [/\.page-eyebrow\s*{[^}]*color:\s*[^;]+;/gi, match => match.replace(/color:\s*[^;]+;/, 'color: #5BC0BE;')]
];

files.forEach(filepath => {
    if (fs.existsSync(filepath)) {
        let content = fs.readFileSync(filepath, 'utf-8');
        rules.forEach(([pattern, replacement]) => {
            content = content.replace(pattern, replacement);
        });
        fs.writeFileSync(filepath, content, 'utf-8');
        console.log(`Updated ${filepath}`);
    } else {
        console.log(`File not found: ${filepath}`);
    }
});
