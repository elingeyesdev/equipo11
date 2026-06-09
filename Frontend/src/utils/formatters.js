const LOCALE = 'es-BO';

export function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(LOCALE, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(LOCALE, {
    day: '2-digit', month: 'short',
  });
}

export function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString(LOCALE, {
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatCityName(name) {
  if (!name) return '';
  if (name.startsWith('Zona Sim. ')) {
    const parts = name.split(' ');
    const lastPart = parts[parts.length - 1];
    if (/^\d{13}$/.test(lastPart)) {
      const timestamp = parseInt(lastPart, 10);
      const date = new Date(timestamp);
      const dd = String(date.getDate()).padStart(2, '0');
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const hh = String(date.getHours()).padStart(2, '0');
      const min = String(date.getMinutes()).padStart(2, '0');
      const baseName = parts.slice(2, -1).join(' ');
      return `${baseName} (${dd}/${mm} ${hh}:${min})`;
    }
    return name.replace('Zona Sim. ', '') + ' (Simulada)';
  }
  return name;
}

