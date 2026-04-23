import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthHero from './AuthHero'
import './Auth.css'

const VALIDACIONES = {
  nombre:   (v) => v.trim().length >= 2  ? '' : 'El nombre debe tener al menos 2 caracteres',
  apellido: (v) => v.trim().length >= 2  ? '' : 'El apellido debe tener al menos 2 caracteres',
  email:    (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Ingresa un email válido',
  password: (v) => v.length >= 6         ? '' : 'La contraseña debe tener al menos 6 caracteres',
  confirmar:(v, form) => v === form.password ? '' : 'Las contraseñas no coinciden',
}

function Register() {
  const navigate = useNavigate()
  const [form, setForm]     = useState({ nombre: '', apellido: '', email: '', password: '', confirmar: '' })
  const [errors, setErrors] = useState({})
  const [apiError, setApiError]   = useState('')
  const [success, setSuccess]     = useState('')
  const [loading, setLoading]     = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    const updated = { ...form, [name]: value }
    setForm(updated)
    if (errors[name] !== undefined) {
      setErrors(prev => ({
        ...prev,
        [name]: VALIDACIONES[name]?.(value, updated) || '',
      }))
    }
  }

  const validarTodo = () => {
    const nuevosErrores = {}
    Object.keys(VALIDACIONES).forEach(campo => {
      nuevosErrores[campo] = VALIDACIONES[campo](form[campo], form)
    })
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
      const res = await fetch('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre,
          apellido: form.apellido,
          email: form.email,
          password: form.password,
        }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.mensaje)

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
