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
