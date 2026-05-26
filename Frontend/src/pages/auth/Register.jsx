import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Map, { Marker } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import AuthHero from './AuthHero'
import httpClient from '../../config/httpClient'
import './Auth.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

const CODES = [
  { code: '+591', name: 'Bolivia 🇧🇴' },
  { code: '+54', name: 'Argentina 🇦🇷' },
  { code: '+55', name: 'Brasil 🇧🇷' },
  { code: '+56', name: 'Chile 🇨🇱' },
  { code: '+57', name: 'Colombia 🇨🇴' },
  { code: '+51', name: 'Perú 🇵🇪' },
  { code: '+593', name: 'Ecuador 🇪🇨' },
  { code: '+595', name: 'Paraguay 🇵y' },
  { code: '+598', name: 'Uruguay 🇺🇾' },
  { code: '+58', name: 'Venezuela 🇻🇪' },
  { code: '+52', name: 'México 🇲🇽' },
  { code: '+34', name: 'España 🇪🇸' },
]

const VALIDACIONES = {
  nombre:   (v) => v.trim().length >= 2  ? '' : 'El nombre debe tener al menos 2 caracteres',
  apellido: (v) => v.trim().length >= 2  ? '' : 'El apellido debe tener al menos 2 caracteres',
  email:    (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Ingresa un email válido',
  password: (v) => v.length >= 6         ? '' : 'La contraseña debe tener al menos 6 caracteres',
  confirmar:(v, form) => v === form.password ? '' : 'Las contraseñas no coinciden',
}

function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    password: '',
    confirmar: '',
    latitud: null,
    longitud: null,
    notif_email: false,
    notif_whatsapp: false,
    notif_telegram: false,
    telegram_destino: ''
  })
  const [whatsappPrefix, setWhatsappPrefix] = useState('+591')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  // Vista centrada en Bolivia/Sudamérica
  const [viewState, setViewState] = useState({
    longitude: -63.5887,
    latitude: -16.2902,
    zoom: 3.5
  })

  const hasLocation = form.latitud !== null && form.longitud !== null

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    const updated = {
      ...form,
      [name]: type === 'checkbox' ? checked : value
    }
    setForm(updated)
    if (errors[name] !== undefined) {
      setErrors(prev => ({
        ...prev,
        [name]: VALIDACIONES[name]?.(value, updated) || '',
      }))
    }
  }

  const handleMapClick = (evt) => {
    const { lng, lat } = evt.lngLat
    setForm(prev => ({
      ...prev,
      latitud: lat,
      longitud: lng
    }))
  }

  const handleClearLocation = () => {
    setForm(prev => ({
      ...prev,
      latitud: null,
      longitud: null,
      notif_email: false,
      notif_whatsapp: false,
      notif_telegram: false
    }))
    setWhatsappNumber('')
  }

  const validarTodo = () => {
    const nuevosErrores = {}
    Object.keys(VALIDACIONES).forEach(campo => {
      nuevosErrores[campo] = VALIDACIONES[campo](form[campo], form)
    })

    if (form.notif_whatsapp && !whatsappNumber.trim()) {
      nuevosErrores.whatsapp_destino = 'El número de WhatsApp es requerido'
    } else {
      nuevosErrores.whatsapp_destino = ''
    }

    if (form.notif_telegram && !form.telegram_destino.trim()) {
      nuevosErrores.telegram_destino = 'El Chat ID de Telegram es requerido'
    } else {
      nuevosErrores.telegram_destino = ''
    }

    setErrors(nuevosErrores)
    return Object.values(nuevosErrores).every(e => e === '')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setApiError('')
    setSuccess('')
    if (!validarTodo()) return

    setLoading(true)
    try {
      const res = await httpClient.post('/auth/register', {
        nombre: form.nombre,
        apellido: form.apellido,
        email: form.email,
        password: form.password,
        latitud: form.latitud,
        longitud: form.longitud,
        notif_email: form.notif_email,
        notif_whatsapp: form.notif_whatsapp,
        whatsapp_destino: form.notif_whatsapp ? (whatsappPrefix + whatsappNumber.replace(/\D/g, '')) : null,
        notif_telegram: form.notif_telegram,
        telegram_destino: form.notif_telegram ? form.telegram_destino : null,
      })
      const body = res.data
      if (!body.ok) throw new Error(body.error)

      setSuccess('¡Cuenta creada exitosamente! Redirigiendo...')
      setTimeout(() => navigate('/login'), 1500)
    } catch (err) {
      setApiError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <AuthHero />

      <div className="auth-form-col">
        <div className="auth-form-wrap">
          <div className="auth-eyebrow">Solicitar acceso</div>
          <h2 className="auth-heading">Crear una <em>cuenta</em>.</h2>
          <p className="auth-subheading">Completa el formulario para sumarte a la red de observación.</p>

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <div className="auth-row">
              <div className={`auth-field ${errors.nombre ? 'auth-field--error' : ''}`}>
                <label htmlFor="reg-nombre">Nombre</label>
                <input
                  id="reg-nombre"
                  type="text"
                  name="nombre"
                  placeholder="Juan"
                  value={form.nombre}
                  onChange={handleChange}
                />
                {errors.nombre && <span className="auth-error-msg">{errors.nombre}</span>}
              </div>

              <div className={`auth-field ${errors.apellido ? 'auth-field--error' : ''}`}>
                <label htmlFor="reg-apellido">Apellido</label>
                <input
                  id="reg-apellido"
                  type="text"
                  name="apellido"
                  placeholder="Pérez"
                  value={form.apellido}
                  onChange={handleChange}
                />
                {errors.apellido && <span className="auth-error-msg">{errors.apellido}</span>}
              </div>
            </div>

            <div className={`auth-field ${errors.email ? 'auth-field--error' : ''}`}>
              <label htmlFor="reg-email">Correo electrónico</label>
              <input
                id="reg-email"
                type="email"
                name="email"
                placeholder="tu@envirosense.bo"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
              />
              {errors.email && <span className="auth-error-msg">{errors.email}</span>}
            </div>

            <div className="auth-row">
              <div className={`auth-field ${errors.password ? 'auth-field--error' : ''}`}>
                <label htmlFor="reg-password">Contraseña</label>
                <input
                  id="reg-password"
                  type="password"
                  name="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                />
                {errors.password && <span className="auth-error-msg">{errors.password}</span>}
              </div>

              <div className={`auth-field ${errors.confirmar ? 'auth-field--error' : ''}`}>
                <label htmlFor="reg-confirmar">Confirmar</label>
                <input
                  id="reg-confirmar"
                  type="password"
                  name="confirmar"
                  placeholder="••••••••"
                  value={form.confirmar}
                  onChange={handleChange}
                  autoComplete="new-password"
                />
                {errors.confirmar && <span className="auth-error-msg">{errors.confirmar}</span>}
              </div>
            </div>

            {/* Mapa Mapbox para ubicación */}
            <div className="auth-divider">Ubicación Geográfica (Opcional)</div>
            <p style={{ fontSize: '12px', color: 'var(--ink-mute)', marginBottom: '8px', lineHeight: '1.4' }}>
              Haz clic en el mapa para registrar tu ubicación de alertas climáticas en tiempo real.
            </p>

            {!MAPBOX_TOKEN ? (
              <div className="auth-info-banner" style={{ border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)', color: '#ef4444' }}>
                ⚠️ Mapbox Token no configurado. Activa VITE_MAPBOX_TOKEN en tu archivo .env
              </div>
            ) : (
              <div style={{ width: '100%', height: '200px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--line-soft)', position: 'relative', marginBottom: '8px' }}>
                <Map
                  {...viewState}
                  onMove={evt => setViewState(evt.viewState)}
                  onClick={handleMapClick}
                  mapStyle="mapbox://styles/mapbox/streets-v12"
                  mapboxAccessToken={MAPBOX_TOKEN}
                  style={{ width: '100%', height: '100%' }}
                >
                  {form.latitud !== null && form.longitud !== null && (
                    <Marker
                      latitude={form.latitud}
                      longitude={form.longitud}
                      anchor="bottom"
                    >
                      <div style={{ fontSize: '26px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>📍</div>
                    </Marker>
                  )}
                </Map>
              </div>
            )}

            {hasLocation && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span style={{ fontSize: '12px', color: 'var(--moss-ink)', fontWeight: '600' }}>
                  Coordenadas: {form.latitud.toFixed(5)}, {form.longitud.toFixed(5)}
                </span>
                <button
                  type="button"
                  onClick={handleClearLocation}
                  style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
                >
                  Limpiar ubicación
                </button>
              </div>
            )}

            {/* Sección de Notificaciones */}
            <div className="auth-divider">Preferencias de Notificación</div>

            {!hasLocation ? (
              <div className="auth-info-banner">
                💡 Haz clic en el mapa de arriba para seleccionar tu ubicación y habilitar las alertas.
              </div>
            ) : (
              <div className="auth-notif-options">
                <label className="auth-checkbox-label">
                  <input
                    type="checkbox"
                    name="notif_email"
                    checked={form.notif_email}
                    onChange={handleChange}
                  />
                  <span>Recibir por Correo (Gmail registrado)</span>
                </label>



                <label className="auth-checkbox-label">
                  <input
                    type="checkbox"
                    name="notif_whatsapp"
                    checked={form.notif_whatsapp}
                    onChange={handleChange}
                  />
                  <span>Recibir por WhatsApp</span>
                </label>
                
                {form.notif_whatsapp && (
                  <div className={`auth-field ${errors.whatsapp_destino ? 'auth-field--error' : ''}`} style={{ marginLeft: '25px', marginTop: '-4px', marginBottom: '8px' }}>
                    <label>Número de WhatsApp</label>
                    <div className="auth-row" style={{ gridTemplateColumns: 'auto 1fr', gap: '8px', marginTop: '4px' }}>
                      <select
                        value={whatsappPrefix}
                        onChange={(e) => setWhatsappPrefix(e.target.value)}
                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--line-soft)', background: 'var(--paper)', color: 'var(--ink)' }}
                      >
                        {CODES.map(c => (
                          <option key={c.code} value={c.code}>{c.code} {c.name.split(' ')[0]}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="70000000"
                        value={whatsappNumber}
                        onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, ''))}
                        style={{ width: '100%' }}
                      />
                    </div>
                    {errors.whatsapp_destino && <span className="auth-error-msg">{errors.whatsapp_destino}</span>}
                  </div>
                )}

                <label className="auth-checkbox-label">
                  <input
                    type="checkbox"
                    name="notif_telegram"
                    checked={form.notif_telegram}
                    onChange={handleChange}
                  />
                  <span>Recibir por Telegram</span>
                </label>
                {form.notif_telegram && (
                  <div className={`auth-field ${errors.telegram_destino ? 'auth-field--error' : ''}`} style={{ marginLeft: '25px', marginTop: '-4px' }}>
                    <label htmlFor="reg-telegram">Chat ID de Telegram</label>
                    <input
                      id="reg-telegram"
                      type="text"
                      name="telegram_destino"
                      placeholder="Ej: 123456789"
                      value={form.telegram_destino}
                      onChange={handleChange}
                    />
                    {errors.telegram_destino && <span className="auth-error-msg">{errors.telegram_destino}</span>}

                    <div className="telegram-qr-register-box" style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'var(--paper-2)', padding: '10px', borderRadius: '8px', border: '1px solid var(--line-soft)', marginTop: '8px' }}>
                      <img
                        src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=https://t.me/envirosense_e11_bot"
                        alt="QR Telegram"
                        style={{ width: '80px', height: '80px', borderRadius: '4px' }}
                      />
                      <div style={{ fontSize: '11.5px', color: 'var(--ink-mute)', lineHeight: '1.3' }}>
                        <strong>¡Activa Telegram!</strong> Escanea este QR para iniciar el bot <b>@envirosense_e11_bot</b>. Envía <code>/start</code> y te dará tu ID para ingresarlo en el campo de arriba.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {apiError && <div className="auth-api-error">{apiError}</div>}
            {success   && <div className="auth-success">{success}</div>}

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? 'Registrando...' : 'Crear cuenta'}
            </button>
          </form>

          <p className="auth-footer-text">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="auth-link">Inicia sesión</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Register
