const ICONS = {
  temperatura: '\u{1F321}\uFE0F',
  aqi: '\u{1F33F}',
  ica: '\u{1F343}',
  humedad: '\u{1F4A7}',
  ruido: '\u{1F50A}',
}

export function getIcon(metric) {
  return ICONS[metric] || '\u{1F4CA}'
}
