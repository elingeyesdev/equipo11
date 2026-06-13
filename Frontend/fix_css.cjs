const fs = require('fs');
const path = require('path');

const files = [
    "./src/pages/PagePlaceholder.css",
    "./src/pages/Reportes/Reportes.css",
    "./src/pages/Alertas/Alertas.css",
    "./src/pages/Notificaciones/Notificaciones.css"
];

const rules = [
    [/var\(--bg-app\)|var\(--bg-body\)|#F9F9F9/g, '#0B132B'],
    [/var\(--card\)|var\(--bg-card\)|var\(--bg-glass\)/g, '#1C2541'],
    [/var\(--paper\)|var\(--paper-2\)/g, '#0B132B'],
    [/var\(--line\)|var\(--line-soft\)|var\(--border\)|var\(--border-strong\)/g, '#3A506B'],
    [/var\(--ink\)|var\(--text-primary\)/g, '#FFFFFF'],
    [/var\(--ink-mute\)|var\(--ink-faint\)|var\(--text-secondary\)|var\(--text-muted\)/g, '#D1D5DB'],
    [/var\(--moss\)|#6366f1/g, '#5BC0BE'],
    [/var\(--moss-ink\)/g, '#0B132B'],
    [/var\(--moss-soft\)|rgba\(16,\s*185,\s*129,\s*0\.1\)/g, '#3A506B'],
    [/var\(--rust\)|#dc2626/g, '#3A506B'],
    [/var\(--rust-soft\)|rgba\(239,\s*68,\s*68,\s*0\.1\)/g, '#1C2541'],
    [/var\(--radius-lg\)/g, '8px'],
    [/var\(--radius\)/g, '6px'],
    [/border-radius:\s*(999px|50%|34px|24px|12px|16px|14px|32px|20px)/g, 'border-radius: 6px'],
    [/var\(--shadow-sm\)|var\(--shadow-md\)|var\(--shadow-lg\)|0\s+20px\s+25px.*?|0\s+10px\s+15px.*?|0\s+4px\s+30px.*?/g, 'none'],
    [/var\(--font-serif\)|var\(--font-mono\)|var\(--font-sans\)/g, "'Space Grotesk', sans-serif"],
    [/linear-gradient\([^)]+\)/g, 'none'],
    [/backdrop-filter:\s*blur\([^)]+\)/g, 'none'],
    [/rgba\([^)]+\)/g, 'transparent'],
    [/var\(--amber-soft.*?#fef3c7\)/g, '#1C2541'],
    [/var\(--amber.*?#d97706\)/g, '#D1D5DB']
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
