const fs = require('fs');
const path = require('path');

// 1. Reportes chart colors
const lineChartPath = "./src/pages/Reportes/LineChart.jsx";
if (fs.existsSync(lineChartPath)) {
    let text = fs.readFileSync(lineChartPath, 'utf-8');
    text = text.replace(/const stroke = `var\(--\$\{serie\.colorVar\}\)`;/g, "const stroke = `var(--accent)`;");
    text = text.replace(/stroke="var\(--line\)"/g, 'stroke="var(--border-color)"');
    fs.writeFileSync(lineChartPath, text, 'utf-8');
}

const barChartPath = "./src/pages/Reportes/BarChart.jsx";
if (fs.existsSync(barChartPath)) {
    let text = fs.readFileSync(barChartPath, 'utf-8');
    text = text.replace(/const stroke = `var\(--\$\{colorVar\}\)`;/g, "const stroke = `var(--accent)`;");
    text = text.replace(/stroke="var\(--line\)"/g, 'stroke="var(--border-color)"');
    fs.writeFileSync(barChartPath, text, 'utf-8');
}

// 2. Text Localidad
const notifCssPath = "./src/pages/Notificaciones/Notificaciones.css";
if (fs.existsSync(notifCssPath)) {
    let text = fs.readFileSync(notifCssPath, 'utf-8');
    text = text.replace(/-webkit-background-clip:\s*text;/g, "");
    text = text.replace(/-webkit-text-fill-color:\s*transparent;/g, "");
    fs.writeFileSync(notifCssPath, text, 'utf-8');
}

// 3. Z-Index Sidebar vs Navbar
const sidebarCssPath = "./src/components/Sidebar/Sidebar.css";
if (fs.existsSync(sidebarCssPath)) {
    let text = fs.readFileSync(sidebarCssPath, 'utf-8');
    text = text.replace(/z-index:\s*1001;/g, "z-index: 40;");
    text = text.replace(/z-index:\s*1000;/g, "z-index: 40;");
    text = text.replace(/z-index:\s*100;/g, "z-index: 40;");
    fs.writeFileSync(sidebarCssPath, text, 'utf-8');
}

// 4 & 5. Emojis to SVGs and button styling
const emojiMap = {
    "⚙️": `<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
    "💉": `<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="m18 2 4 4"/><path d="m17 7 3-3"/><path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5"/><path d="m9 11 4 4"/><path d="m5 19-3 3"/><path d="m14 4 6 6"/></svg>`,
    "🔬": `<svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M6 18h8"/><path d="M3 22h18"/><path d="M14 22a7 7 0 1 0 0-14h-1"/><path d="M9 14h2"/><path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z"/><path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3"/></svg>`,
    "📡": `<svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M2 12a10 10 0 0 1 17-10"/><path d="M9 12a3 3 0 0 1 4-2"/><path d="M6 12a6 6 0 0 1 10-5"/><circle cx="12" cy="12" r="2"/></svg>`,
    "🗺️": `<svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>`,
    "🌡": `<svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/><path d="M11.5 6.5v6"/></svg>`,
    "🌫": `<svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M4 14h16"/><path d="M4 10h16"/><path d="M4 18h16"/><path d="M4 6h16"/></svg>`,
    "💧": `<svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>`,
    "🔊": `<svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`
};

function replaceEmojisInFiles(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            replaceEmojisInFiles(fullPath);
        } else if (fullPath.endsWith('.jsx')) {
            let content = fs.readFileSync(fullPath, 'utf-8');
            let modified = false;
            
            Object.keys(emojiMap).forEach(emoji => {
                if (content.includes(emoji)) {
                    content = content.replace(new RegExp(emoji, 'g'), emojiMap[emoji]);
                    modified = true;
                }
            });

            // Also inject tailwind classes on controls-toggle-btn
            if (content.includes('className="controls-toggle-btn"')) {
                content = content.replace(/className="controls-toggle-btn"/g, 'className="controls-toggle-btn bg-[var(--bg-panel)] border border-[var(--border-color)] text-[var(--text-primary)] hover:text-[var(--accent)] flex items-center justify-center p-2 rounded-md transition-colors"');
                modified = true;
            }

            if (modified) {
                fs.writeFileSync(fullPath, content, 'utf-8');
                console.log('Updated ' + fullPath);
            }
        }
    });
}

replaceEmojisInFiles('./src/components');
replaceEmojisInFiles('./src/pages');

console.log("Fixes applied successfully.");
