import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthHero from './AuthHero'
import httpClient from '../../config/httpClient'
import './Auth.css'

const VALIDACIONES = {
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Ingresa un email válido',
  password: (v) => v.length >= 6 ? '' : 'La contraseña debe tener al menos 6 caracteres',
}

function Login() {
  const navigate = useNavigate()
  const [form, setForm]     = useState({ email: '', password: '', code: '', newPassword: '' })
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [loading, setLoading]   = useState(false)
  
  // 'login' | 'forgot' | 'reset'
  const [view, setView] = useState('login')
  const [successMsg, setSuccessMsg] = useState('')

  const cambiarVista = (nuevaVista) => {
    setView(nuevaVista)
    setApiError('')
    setSuccessMsg('')
    setErrors({})
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (errors[name] !== undefined) {
      setErrors(prev => ({ ...prev, [name]: VALIDACIONES[name]?.(value) || '' }))
    }
  }

  const validarTodo = () => {
    const nuevosErrores = {}
    Object.keys(VALIDACIONES).forEach(campo => {
      nuevosErrores[campo] = VALIDACIONES[campo](form[campo])
    })
    setErrors(nuevosErrores)
    return Object.values(nuevosErrores).every(e => e === '')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setApiError('')
    if (!validarTodo()) return

    setLoading(true)
    try {
      const res = await httpClient.post('/auth/login', form)
      const body = res.data
      if (!body.ok) throw new Error(body.error)

      localStorage.setItem('token', body.data.usuario.token)
      localStorage.setItem('usuario', JSON.stringify(body.data.usuario))
      navigate('/mapa')
    } catch (err) {
      const msg = err.response?.data?.error || err.message
      setApiError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleForgotSubmit = async (e) => {
    e.preventDefault()
    setApiError('')
    setSuccessMsg('')
    const emailError = VALIDACIONES.email(form.email)
    if (emailError !== '') {
      setErrors({ email: emailError })
      return
    }

    setLoading(true)
    try {
      const res = await httpClient.post('/auth/forgot-password', { email: form.email })
      const body = res.data
      if (!body.ok) throw new Error(body.error)

      setSuccessMsg(body.data.mensaje)
      setView('reset')
    } catch (err) {
      const msg = err.response?.data?.error || err.message
      setApiError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleResetSubmit = async (e) => {
    e.preventDefault()
    setApiError('')
    setSuccessMsg('')
    if (form.code.length !== 6 || form.newPassword.length < 6) {
      setApiError('Ingresa un código de 6 dígitos y una contraseña de al menos 6 caracteres')
      return
    }

    setLoading(true)
    try {
      await httpClient.post('/auth/reset-password', { email: form.email, code: form.code, newPassword: form.newPassword })

      setSuccessMsg('Contraseña restablecida correctamente. Inicia sesión.')
      setView('login')
      setForm(prev => ({ ...prev, password: '', code: '', newPassword: '' }))
    } catch (err) {
      const msg = err.response?.data?.error || err.message
      setApiError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <AuthHero />

      <div className="auth-form-col">
        <div className="auth-form-wrap">
          {view === 'login' && (
            <>
              <div className="auth-eyebrow">Acceso</div>
              <h2 className="auth-heading">Bienvenido de vuelta.</h2>
              <p className="auth-subheading">Ingresa tus credenciales para continuar con la observación.</p>

              {successMsg && <div className="auth-api-success" style={{color: 'var(--primary)', marginBottom: '1rem', background: 'var(--moss-soft)', padding: '0.8rem', borderRadius: '4px'}}>{successMsg}</div>}

              <form onSubmit={handleSubmit} className="auth-form" noValidate>
                <div className={`auth-field ${errors.email ? 'auth-field--error' : ''}`}>
                  <label htmlFor="login-email">Correo electrónico</label>
                  <input
                    id="login-email"
                    type="email"
                    name="email"
                    placeholder="tu@envirosense.bo"
                    value={form.email}
                    onChange={handleChange}
                    autoComplete="email"
                  />
                  {errors.email && <span className="auth-error-msg">{errors.email}</span>}
                </div>

                <div className={`auth-field ${errors.password ? 'auth-field--error' : ''}`}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <label htmlFor="login-password">Contraseña</label>
                    <span style={{fontSize: '0.8rem', color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline'}} onClick={() => cambiarVista('forgot')}>¿Olvidaste tu contraseña?</span>
                  </div>
                  <input
                    id="login-password"
                    type="password"
                    name="password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={handleChange}
                    autoComplete="current-password"
                  />
                  {errors.password && <span className="auth-error-msg">{errors.password}</span>}
                </div>

                {apiError && <div className="auth-api-error">{apiError}</div>}

                <button type="submit" className="auth-btn" disabled={loading}>
                  {loading ? 'Ingresando...' : 'Ingresar →'}
                </button>
              </form>

              <p className="auth-footer-text">
                ¿No tienes cuenta?{' '}
                <Link to="/register" className="auth-link">Solicita acceso</Link>
              </p>
            </>
          )}

          {view === 'forgot' && (
            <>
              <div className="auth-eyebrow">Recuperación</div>
              <h2 className="auth-heading">Recuperar <em>contraseña</em>.</h2>
              <p className="auth-subheading">Te enviaremos un código de 6 dígitos a tu correo.</p>

              <form onSubmit={handleForgotSubmit} className="auth-form" noValidate>
                <div className={`auth-field ${errors.email ? 'auth-field--error' : ''}`}>
                  <label htmlFor="forgot-email">Correo electrónico</label>
                  <input
                    id="forgot-email"
                    type="email"
                    name="email"
                    placeholder="tu@envirosense.bo"
                    value={form.email}
                    onChange={handleChange}
                  />
                  {errors.email && <span className="auth-error-msg">{errors.email}</span>}
                </div>

                {apiError && <div className="auth-api-error">{apiError}</div>}

                <button type="submit" className="auth-btn" disabled={loading}>
                  {loading ? 'Enviando...' : 'Enviar Código'}
                </button>
              </form>

              <p className="auth-footer-text">
                <span style={{cursor: 'pointer', color: 'var(--primary)', textDecoration: 'underline'}} onClick={() => cambiarVista('login')}>Volver a inicio de sesión</span>
              </p>
            </>
          )}

          {view === 'reset' && (
            <>
              <div className="auth-eyebrow">Restablecer</div>
              <h2 className="auth-heading">Nueva <em>contraseña</em>.</h2>
              <p className="auth-subheading">Ingresa el código enviado a {form.email}</p>

              {successMsg && <div className="auth-api-success" style={{color: 'var(--primary)', marginBottom: '1rem', background: 'var(--moss-soft)', padding: '0.8rem', borderRadius: '4px'}}>{successMsg}</div>}

              <form onSubmit={handleResetSubmit} className="auth-form" noValidate>
                <div className="auth-field">
                  <label htmlFor="reset-code">Código de 6 dígitos</label>
                  <input
                    id="reset-code"
                    type="text"
                    name="code"
                    maxLength={6}
                    placeholder="123456"
                    value={form.code}
                    onChange={handleChange}
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="reset-newpassword">Nueva Contraseña</label>
                  <input
                    id="reset-newpassword"
                    type="password"
                    name="newPassword"
                    placeholder="••••••••"
                    value={form.newPassword}
                    onChange={handleChange}
                  />
                </div>

                {apiError && <div className="auth-api-error">{apiError}</div>}

                <button type="submit" className="auth-btn" disabled={loading}>
                  {loading ? 'Actualizando...' : 'Restablecer Contraseña'}
                </button>
              </form>

              <p className="auth-footer-text">
                <span style={{cursor: 'pointer', color: 'var(--primary)', textDecoration: 'underline'}} onClick={() => cambiarVista('login')}>Volver a inicio de sesión</span>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Login
