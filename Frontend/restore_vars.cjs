const fs = require('fs');

const files = [
    "./src/components/Navbar/Navbar.css",
    "./src/components/Sidebar/Sidebar.css",
    "./src/pages/PagePlaceholder.css",
    "./src/pages/Reportes/Reportes.css",
    "./src/pages/Alertas/Alertas.css",
    "./src/pages/Notificaciones/Notificaciones.css"
];

// Replaces static hex colors with dynamic CSS variables
const rules = [
    // Backgrounds
    [/(background(?:-color)?:\s*)#0b132b/gi, '$1var(--bg-app)'],
    [/(background(?:-color)?:\s*)#1c2541/gi, '$1var(--bg-panel)'],
    
    // Borders
    [/(border(?:-color|-top|-bottom|-left|-right)?:\s*.*?)#3a506b/gi, '$1var(--border-color)'],
    
    // Text colors
    [/(color:\s*)#ffffff/gi, '$1var(--text-primary)'],
    [/(color:\s*)#d1d5db/gi, '$1var(--text-secondary)'],
    [/(color:\s*)#9ca3af/gi, '$1var(--text-secondary)'],
    
    // Accents
    [/(background(?:-color)?:\s*)#5bc0be/gi, '$1var(--accent)'],
    [/(color:\s*)#5bc0be/gi, '$1var(--accent)'],
    [/(border(?:-color|-top|-bottom|-left|-right)?:\s*.*?)#5bc0be/gi, '$1var(--accent)'],
    
    // Fallback: any lingering hardcoded colors that mean bg-app inside color properties
    // like the text inside a tropical-teal button
    [/(color:\s*)#0b132b/gi, '$1var(--bg-app)'],
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

// Update index.css
const indexFile = "./src/index.css";
if (fs.existsSync(indexFile)) {
    let indexContent = fs.readFileSync(indexFile, 'utf-8');
    
    const newVars = `
:root { /* MODO CLARO - Paleta Invertida */
  --bg-app: #F3F4F6;
  --bg-panel: #FFFFFF;
  --border-color: #D1D5DB;
  --text-primary: #0B132B; /* Prussian Blue para contraste */
  --text-secondary: #3A506B; /* Dusk Blue */
  --accent: #5BC0BE;
}

.dark, html[data-theme="dark"], [data-theme="dark"] { /* MODO OSCURO - Paleta Corporativa Oficial */
  --bg-app: #0B132B;
  --bg-panel: #1C2541;
  --border-color: #3A506B;
  --text-primary: #FFFFFF;
  --text-secondary: #D1D5DB;
  --accent: #5BC0BE;
}
`;

    // Try to replace the existing :root and dark blocks, or just prepend to the file if they don't match cleanly.
    // It's safer to just inject this at the end of the file to override the old ones,
    // or strip the old ones.
    
    // Let's replace the whole :root and html[data-theme="dark"] blocks.
    indexContent = indexContent.replace(/:root\s*{[\s\S]*?}(?=\s*html\[data-theme="dark"\])/g, '');
    indexContent = indexContent.replace(/html\[data-theme="dark"\]\s*{[\s\S]*?}(?=\s*html,\s*body)/g, '');
    
    // Inject our new vars at the top
    indexContent = indexContent.replace(/@tailwind utilities;\n*/, '@tailwind utilities;\n' + newVars + '\n');
    
    fs.writeFileSync(indexFile, indexContent, 'utf-8');
    console.log("Updated index.css");
}
