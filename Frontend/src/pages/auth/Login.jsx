import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
    // Validar en tiempo real
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
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-icon">🌿</div>
          <h1 className="auth-brand-title">EnviroSense</h1>
          <p className="auth-brand-sub">Monitor de Datos Ambientales</p>
        </div>

        <h2 className="auth-heading">Iniciar Sesión</h2>
        <p className="auth-subheading">Ingresa tus credenciales para continuar</p>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className={`auth-field ${errors.email ? 'auth-field--error' : ''}`}>
            <label htmlFor="login-email">Correo electrónico</label>
            <input
              id="login-email"
              type="email"
              name="email"
              placeholder="correo@ejemplo.com"
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
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className="auth-footer-text">
          ¿No tienes cuenta?{' '}
          <Link to="/register" className="auth-link">Regístrate aquí</Link>
        </p>
      </div>
    </div>
  )
}

export default Login
