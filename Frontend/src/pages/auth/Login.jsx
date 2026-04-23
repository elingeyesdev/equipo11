import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthHero from './AuthHero'
import './Auth.css'

const VALIDACIONES = {
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Ingresa un email válido',
  password: (v) => v.length >= 6 ? '' : 'La contraseña debe tener al menos 6 caracteres',
}

function Login() {
  const navigate = useNavigate()
  const [form, setForm]     = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [loading, setLoading]   = useState(false)

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
      const res = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.mensaje)

      localStorage.setItem('token', data.usuario.token)
      localStorage.setItem('usuario', JSON.stringify(data.usuario))
      navigate('/mapa')
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
          <div className="auth-eyebrow">Acceso</div>
          <h2 className="auth-heading">Bienvenido de <em>vuelta</em>.</h2>
          <p className="auth-subheading">Ingresa tus credenciales para continuar con la observación.</p>

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
              <label htmlFor="login-password">Contraseña</label>
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
              {loading ? 'Ingresando...' : (
                <>
                  Ingresar
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <p className="auth-footer-text">
            ¿No tienes cuenta?{' '}
            <Link to="/register" className="auth-link">Solicita acceso</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
