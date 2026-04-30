import { useState, useEffect } from 'react'
import '../PagePlaceholder.css'
import './Usuarios.css'

const ROLE_LABEL = {
  admin: 'Administrador',
  analista: 'Analista',
  visualizador: 'Observador',
  invitado: 'Invitado',
}

const PERMISOS_BASE = [
  { id: 'read',   label: 'Leer datos de sensores',  desc: 'Acceso de solo lectura al mapa y tendencias',   on: true  },
  { id: 'inject', label: 'Inyectar lecturas',       desc: 'Sobrescribir valores en el panel de simulación', on: false },
  { id: 'report', label: 'Generar reportes',        desc: 'Crear y descargar PDFs mensuales',               on: false },
  { id: 'config', label: 'Configurar sensores',     desc: 'Modificar umbrales y alertas',                   on: false },
  { id: 'admin',  label: 'Gestionar usuarios',      desc: 'Invitar, editar y eliminar cuentas',             on: false },
]

function Usuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const currentUser = JSON.parse(localStorage.getItem('usuario') || '{}')
  const isAdmin = currentUser.rol === 'admin' || currentUser.rol_clave === 'admin'

  useEffect(() => {
    if (isAdmin) {
      cargarDatos()
    } else {
      setLoading(false)
    }
  }, [isAdmin])

  const cargarDatos = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const headers = { 'Authorization': `Bearer ${token}` }
      
      const [resUsers, resRoles] = await Promise.all([
        fetch('http://localhost:3000/api/usuarios', { headers }),
        fetch('http://localhost:3000/api/usuarios/roles', { headers })
      ])
      
      const dataUsers = await resUsers.json()
      const dataRoles = await resRoles.json()

      if (dataUsers.ok) setUsuarios(dataUsers.usuarios)
      if (dataRoles.ok) setRoles(dataRoles.roles)
    } catch (err) {
      setError('Error al cargar datos del servidor')
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (userId, newRoleId) => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`http://localhost:3000/api/usuarios/${userId}/rol`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ rol_id: newRoleId })
      })
      const data = await res.json()
      if (data.ok) {
        cargarDatos()
      } else {
        alert('Error al cambiar rol: ' + data.mensaje)
      }
    } catch (err) {
      alert('Error de conexión al cambiar rol')
    }
  }

  const handleEstadoChange = async (userId, newEstado) => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`http://localhost:3000/api/usuarios/${userId}/estado`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ activo: newEstado })
      })
      const data = await res.json()
      if (data.ok) {
        cargarDatos()
      } else {
        alert('Error al cambiar estado: ' + data.mensaje)
      }
    } catch (err) {
      alert('Error de conexión al cambiar estado')
    }
  }

  if (!isAdmin) {
    return (
      <div className="page admin-page" style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{textAlign: 'center'}}>
          <h2>Acceso Denegado</h2>
          <p>Solo el Administrador puede gestionar roles y usuarios.</p>
        </div>
      </div>
    )
  }

  const filteredUsers = usuarios.filter(u => 
    u.nombre.toLowerCase().includes(search.toLowerCase()) || 
    u.apellido.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  const total = usuarios.length
  const activos = usuarios.filter(u => u.activo).length
  const porcent = total > 0 ? Math.round((activos / total) * 100) : 0

  return (
    <div className="page admin-page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">{total} usuarios registrados</div>
          <h2 className="page-heading">Gestión de <em>usuarios</em></h2>
          <p className="page-desc">Administra cuentas y roles desde este panel exclusivo para Administradores.</p>
        </div>
        <span className="page-tag">Admin</span>
      </div>

      <div className="adm-kpis">
        <div className="kpi">
          <div className="l">Usuarios totales</div>
          <div className="v">{total}</div>
        </div>
        <div className="kpi">
          <div className="l">Cuentas habilitadas</div>
          <div className="v">{activos}</div>
          <div className="t muted">{porcent}% del total</div>
        </div>
      </div>

      <div className="adm-body">
        <div className="adm-card" style={{ flex: 2 }}>
          <div className="adm-head">
            <div>
              <h3>Directorio de <em>usuarios</em></h3>
              <div className="sub">{filteredUsers.length} resultados mostrados</div>
            </div>
            <div className="adm-tools">
              <div className="search" style={{display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid #333', padding: '0.2rem 0.5rem', borderRadius: '4px'}}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input 
                  type="text" 
                  placeholder="Buscar usuario..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: '0.9rem'}}
                />
              </div>
            </div>
          </div>

          <div className="sim-table-wrapper">
            {loading ? <p style={{padding: '2rem'}}>Cargando usuarios...</p> : (
              <table className="ut">
                <thead>
                  <tr>
                    <th style={{ width: '35%' }}>Usuario</th>
                    <th>Rol Actual</th>
                    <th>Estado</th>
                    <th>Asignar Nuevo Rol</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div className="ut-user">
                          <div className={`ut-avatar a1`}>{u.nombre[0]}{u.apellido[0]}</div>
                          <div>
                            <div className="nm">{u.nombre} {u.apellido}</div>
                            <div className="em">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`role ${u.rol_clave}`}>{ROLE_LABEL[u.rol_clave] || u.rol_nombre}</span>
                      </td>
                      <td>
                        {u.rol_clave === 'admin' ? (
                          <span style={{color: '#10ac84'}}>Siempre Activo</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleEstadoChange(u.id, !u.activo)}
                            style={{
                              background: u.activo ? 'rgba(16, 172, 132, 0.1)' : 'rgba(238, 82, 83, 0.1)',
                              color: u.activo ? '#10ac84' : '#ee5253',
                              border: `1px solid ${u.activo ? '#10ac84' : '#ee5253'}`,
                              padding: '0.3rem 0.6rem',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.85rem'
                            }}
                          >
                            {u.activo ? 'Habilitado' : 'Suspendido'}
                          </button>
                        )}
                      </td>
                      <td>
                        {u.rol_clave === 'admin' ? (
                          <span style={{color: '#888', fontSize: '0.85rem'}}>Intransferible</span>
                        ) : (
                          <select 
                            value={u.rol_clave}
                            onChange={(e) => {
                              const selectedRole = roles.find(r => r.clave === e.target.value)
                              if (selectedRole) {
                                handleRoleChange(u.id, selectedRole.id)
                              }
                            }}
                            style={{
                              background: '#222', 
                              color: '#fff', 
                              border: '1px solid #444',
                              padding: '0.3rem',
                              borderRadius: '4px',
                              outline: 'none'
                            }}
                          >
                            {roles.filter(r => r.clave !== 'admin').map(r => (
                              <option key={r.id} value={r.clave}>{r.nombre}</option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan="4" style={{textAlign: 'center', padding: '2rem'}}>No se encontraron usuarios.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="adm-side">
          <div className="adm-card">
            <div className="adm-head">
              <div>
                <h3>Permisos <em>(Informativo)</em></h3>
                <div className="sub">Jerarquía de acceso</div>
              </div>
            </div>
            <div className="perm" style={{padding: '1rem'}}>
              {roles.map(r => (
                <div key={r.id} style={{marginBottom: '1rem'}}>
                  <strong style={{color: '#10ac84'}}>{r.nombre}</strong>
                  <p style={{fontSize: '0.85rem', color: '#aaa', margin: '0.2rem 0'}}>{r.descripcion}</p>
                </div>
              ))}
              {roles.length === 0 && <p style={{fontSize: '0.85rem', color: '#888'}}>Cargando roles...</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Usuarios
