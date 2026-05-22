/** Sesión válida: requiere token JWT y datos de usuario en localStorage. */
export function isAuthenticated() {
  const token = localStorage.getItem('token')
  const usuario = localStorage.getItem('usuario')
  return Boolean(token && usuario)
}

export function clearSession() {
  localStorage.removeItem('token')
  localStorage.removeItem('usuario')
}
