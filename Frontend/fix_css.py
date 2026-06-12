import re
import os

files = [
    r"c:\Users\T402-DOC\Desktop\equipo11\Frontend\src\pages\PagePlaceholder.css",
    r"c:\Users\T402-DOC\Desktop\equipo11\Frontend\src\pages\Reportes\Reportes.css",
    r"c:\Users\T402-DOC\Desktop\equipo11\Frontend\src\pages\Alertas\Alertas.css",
    r"c:\Users\T402-DOC\Desktop\equipo11\Frontend\src\pages\Notificaciones\Notificaciones.css"
]

# Color map
rules = [
    # Backgrounds and containers
    (r'var\(--bg-app\)|var\(--bg-body\)|#F9F9F9', '#0B132B'), # Prussian Blue (App bg)
    (r'var\(--card\)|var\(--bg-card\)|var\(--bg-glass\)', '#1C2541'), # Space Indigo (Card bg)
    (r'var\(--paper\)|var\(--paper-2\)', '#0B132B'), # Prussian Blue for inputs
    
    # Borders
    (r'var\(--line\)|var\(--line-soft\)|var\(--border\)|var\(--border-strong\)', '#3A506B'), # Dusk Blue
    
    # Texts
    (r'var\(--ink\)|var\(--text-primary\)', '#FFFFFF'),
    (r'var\(--ink-mute\)|var\(--ink-faint\)|var\(--text-secondary\)|var\(--text-muted\)', '#D1D5DB'),
    
    # Accents & Buttons
    (r'var\(--moss\)|#6366f1', '#5BC0BE'), # Tropical Teal
    (r'var\(--moss-ink\)', '#0B132B'), # Contrast over teal
    (r'var\(--moss-soft\)|rgba\(16,\s*185,\s*129,\s*0\.1\)', '#3A506B'),
    (r'var\(--rust\)|#dc2626', '#3A506B'), # Removed red buttons, make secondary
    (r'var\(--rust-soft\)|rgba\(239,\s*68,\s*68,\s*0\.1\)', '#1C2541'),
    
    # Radius
    (r'var\(--radius-lg\)', '8px'),
    (r'var\(--radius\)', '6px'),
    (r'border-radius:\s*(999px|50%|34px|24px|12px|16px|14px|32px|20px)', 'border-radius: 6px'),
    
    # Shadows
    (r'var\(--shadow-sm\)|var\(--shadow-md\)|var\(--shadow-lg\)|0\s+20px\s+25px.*|0\s+10px\s+15px.*|0\s+4px\s+30px.*', 'none'),
    
    # Fonts
    (r'var\(--font-serif\)|var\(--font-mono\)|var\(--font-sans\)', "'Space Grotesk', sans-serif"),
    
    # Specifics in Notificaciones
    (r'linear-gradient\([^)]+\)', 'none'),
    (r'backdrop-filter:\s*blur\([^)]+\)', 'none'),
    (r'rgba\([^)]+\)', 'transparent')
]

for filepath in files:
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        for pat, rep in rules:
            content = re.sub(pat, rep, content)
            
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")
    else:
        print(f"File not found: {filepath}")
