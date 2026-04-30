/**
 * AlertaNotificacion.jsx
 * ----------------------
 * Componente de notificación visual para alertas ambientales en tiempo real.
 *
 * Comportamiento por severidad:
 *  - advertencia → Toast esquina inferior-derecha, auto-dismiss 8 s
 *  - critica     → Toast con borde rojo, persiste hasta click del usuario
 *  - emergencia  → Modal overlay full-screen, requiere click "Entendido"
 *
 * Límites:
 *  - Máximo 5 toasts simultáneos (el resto se colapsa en "+ N alertas más")
 *  - Múltiples emergencias → una sola pantalla con lista, no N modales apilados
 */
import { useEffect, useRef } from 'react'
import { useSimulacion } from '../../context/SimulacionContext'
import './AlertaNotificacion.css'

// Íconos SVG inline según severidad
const ICONOS = {
  advertencia: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  critica: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  emergencia: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
}

const ETIQUETAS_METRICA = {
  temperatura: 'Temperatura',
  aqi:         'Calidad del Aire',
  ica:         'Calidad del Agua',
  ruido:       'Ruido Ambiental',
  humedad:     'Humedad',
}

const UNIDADES_METRICA = {
  temperatura: '°C',
  aqi:         'AQI',
  ica:         'ICA',
  ruido:       'dB',
  humedad:     '%',
}

const MAX_TOASTS = 5

export default function AlertaNotificacion() {
  const { alertasPendientes, dismissAlerta } = useSimulacion()

  // Separar emergencias del resto
  const emergencias = alertasPendientes.filter(a => a.severidad === 'emergencia')
  const noEmergencias = alertasPendientes.filter(a => a.severidad !== 'emergencia')

  // Toasts visibles (máx MAX_TOASTS), el resto colapsado
  const toastsVisibles = noEmergencias.slice(0, MAX_TOASTS)
  const colapsados = noEmergencias.length - toastsVisibles.length

  return (
    <>
      {/* ─── MODAL DE EMERGENCIA ─────────────────────────────────────── */}
      {emergencias.length > 0 && (
        <div className="alerta-overlay" role="alertdialog" aria-modal="true">
          <div className="alerta-modal-emergencia">
            <div className="alerta-modal-icono">{ICONOS.emergencia}</div>
            <h2 className="alerta-modal-titulo">⚠ Alerta de Emergencia</h2>
            <p className="alerta-modal-subtitulo">
              {emergencias.length === 1
                ? 'Se ha detectado una condición crítica que requiere atención inmediata.'
                : `Se han detectado ${emergencias.length} condiciones de emergencia simultáneas.`}
            </p>

            <ul className="alerta-modal-lista">
              {emergencias.map(a => (
                <li key={a._uid} className="alerta-modal-item">
                  <span className="alerta-modal-ciudad">{a.ciudad_nombre}</span>
                  <span className="alerta-modal-detalle">
                    {ETIQUETAS_METRICA[a.metrica_clave] ?? a.metrica_clave}
                    &nbsp;·&nbsp;
                    <strong>{a.valor} {UNIDADES_METRICA[a.metrica_clave] ?? ''}</strong>
                    &nbsp;·&nbsp;{a.label}
                  </span>
                </li>
              ))}
            </ul>

            <button
              className="alerta-modal-btn"
              onClick={() => emergencias.forEach(a => dismissAlerta(a._uid))}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* ─── TOASTS (advertencia + critica) ─────────────────────────── */}
      {noEmergencias.length > 0 && (
        <div className="alerta-toast-stack" role="region" aria-label="Notificaciones de alerta">
          {/* Contador de colapsados */}
          {colapsados > 0 && (
            <div className="alerta-toast alerta-toast--colapsado">
              + {colapsados} alerta{colapsados > 1 ? 's' : ''} más
            </div>
          )}

          {/* Toasts individuales (en orden inverso para que el más reciente esté abajo) */}
          {[...toastsVisibles].reverse().map(a => (
            <ToastAlerta key={a._uid} alerta={a} onDismiss={dismissAlerta} />
          ))}
        </div>
      )}
    </>
  )
}

// ─── Sub-componente Toast ─────────────────────────────────────────────────────
function ToastAlerta({ alerta, onDismiss }) {
  const timerRef = useRef(null)

  // Auto-dismiss solo para advertencias (8 s)
  useEffect(() => {
    if (alerta.severidad === 'advertencia') {
      timerRef.current = setTimeout(() => onDismiss(alerta._uid), 8000)
    }
    return () => clearTimeout(timerRef.current)
  }, [alerta._uid, alerta.severidad, onDismiss])

  return (
    <div
      className={`alerta-toast alerta-toast--${alerta.severidad}`}
      role="alert"
    >
      <div className="alerta-toast-icono">{ICONOS[alerta.severidad]}</div>
      <div className="alerta-toast-cuerpo">
        <p className="alerta-toast-ciudad">{alerta.ciudad_nombre}</p>
        <p className="alerta-toast-detalle">
          <span className="alerta-toast-metrica">
            {ETIQUETAS_METRICA[alerta.metrica_clave] ?? alerta.metrica_clave}
          </span>
          &nbsp;·&nbsp;{alerta.valor} {UNIDADES_METRICA[alerta.metrica_clave] ?? ''}
        </p>
        <p className="alerta-toast-label">{alerta.label}</p>
      </div>
      <button
        className="alerta-toast-cerrar"
        onClick={() => onDismiss(alerta._uid)}
        aria-label="Cerrar notificación"
      >
        ×
      </button>
    </div>
  )
}
