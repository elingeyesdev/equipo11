import { useState } from 'react'
import '../PagePlaceholder.css'
import './Usuarios.css'

const USUARIOS_DEMO = [
  { id: 1, nm: 'Andrea Duarte',    em: 'andrea.d@envirosense.bo',   avatar: 'AD', cls: 'a1', role: 'admin',   zonas: ['Todas'],                             seen: 'En línea',         online: true  },
  { id: 2, nm: 'Juan Mendoza',     em: 'juan.m@envirosense.bo',     avatar: 'JM', cls: 'a2', role: 'analyst', zonas: ['La Paz', 'Oruro'],                   seen: 'hace 4 min',       online: true  },
  { id: 3, nm: 'Camila Paredes',   em: 'camila.p@envirosense.bo',   avatar: 'CP', cls: 'a3', role: 'analyst', zonas: ['Santa Cruz', 'Beni', 'Pando'],       seen: 'hace 12 min',      online: true  },
  { id: 4, nm: 'Roberto Mamani',   em: 'roberto.m@envirosense.bo',  avatar: 'RM', cls: 'a4', role: 'viewer',  zonas: ['Sucre', 'Tarija'],                   seen: 'hace 2h',          online: false },
  { id: 5, nm: 'Laura Vargas',     em: 'laura.v@envirosense.bo',    avatar: 'LV', cls: 'a1', role: 'analyst', zonas: ['Cochabamba'],                        seen: 'ayer · 18:42',     online: false },
  { id: 6, nm: 'Nelson Suárez',    em: 'nelson.s@municipio.bo',     avatar: 'NS', cls: 'a4', role: 'guest',   zonas: ['Potosí'],                            seen: 'nunca',            online: false },
]

const ROLE_LABEL = {
  admin:   'Administrador',
  analyst: 'Analista',
  viewer:  'Observador',
  guest:   'Invitado',
}

const PERMISOS_BASE = [
  { id: 'read',   label: 'Leer datos de sensores',  desc: 'Acceso de solo lectura al mapa y tendencias',   on: true  },
  { id: 'inject', label: 'Inyectar lecturas',       desc: 'Sobrescribir valores en el panel de simulación', on: true  },
  { id: 'report', label: 'Generar reportes',        desc: 'Crear y descargar PDFs mensuales',               on: true  },
  { id: 'config', label: 'Configurar sensores',     desc: 'Modificar umbrales y alertas',                   on: false },
  { id: 'admin',  label: 'Gestionar usuarios',      desc: 'Invitar, editar y eliminar cuentas',             on: false },
]

const ACTIVIDAD = [
  { who: 'Andrea Duarte',  what: 'invitó a',                sub: 'Rol: Invitado · Zona: Potosí',        target: 'nelson.s@municipio.bo', time: '14:18', kind: 'ok' },
  { who: 'Juan Mendoza',   what: 'inyectó datos en',        sub: 'AQI 145 · Temp 12°C',                 target: 'La Paz',                time: '14:02', kind: 'w'  },
  { who: 'Camila Paredes', what: 'generó reporte mensual',  sub: 'Zona Oriente · 24 páginas',           target: '',                      time: '13:47', kind: 'ok' },
  { who: 'Sistema',        what: 'bloqueó login fallido',   sub: 'IP 190.181.22.14 · 5 intentos',       target: '',                      time: '12:31', kind: 'd'  },
  { who: 'Roberto Mamani', what: 'modificó umbral ICA',     sub: 'Zona Sucre · 80 → 75',                target: '',                      time: '11:04', kind: 'ok' },
]

function Usuarios() {
  const [permisos, setPermisos] = useState(PERMISOS_BASE)

  const total     = USUARIOS_DEMO.length
  const activos   = USUARIOS_DEMO.filter(u => u.online).length
  const porcent   = Math.round((activos / total) * 100)

  const togglePerm = (id) => {
    setPermisos(prev => prev.map(p => p.id === id ? { ...p, on: !p.on } : p))
  }

  return (
    <div className="page admin-page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">{total} usuarios · 9 zonas cubiertas</div>
          <h2 className="page-heading">Gestión de <em>usuarios</em></h2>
          <p className="page-desc">Administra cuentas, permisos y responsables por zona ambiental.</p>
        </div>
        <span className="page-tag">Admin</span>
      </div>

      {/* KPIs */}
      <div className="adm-kpis">
        <div className="kpi">
          <div className="l">Usuarios totales</div>
          <div className="v">{total}</div>
          <div className="t">+2 esta semana</div>
        </div>
        <div className="kpi">
          <div className="l">Activos hoy</div>
          <div className="v">{activos}</div>
          <div className="t muted">{porcent}% del equipo</div>
        </div>
        <div className="kpi">
          <div className="l">Zonas sin responsable</div>
          <div className="v">1</div>
          <div className="t down">Potosí</div>
        </div>
        <div className="kpi">
          <div className="l">Solicitudes pendientes</div>
          <div className="v">3</div>
          <div className="t muted">requieren aprobación</div>
        </div>
      </div>

      {/* Tabla + side */}
      <div className="adm-body">
        <div className="adm-card">
          <div className="adm-head">
            <div>
              <h3>Usuarios <em>del sistema</em></h3>
              <div className="sub">{total} resultados · ordenados por actividad</div>
            </div>
            <div className="adm-tools">
              <div className="search" role="button">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                Buscar
              </div>
              <button type="button" className="btn-ghost">Filtros</button>
            </div>
          </div>

          <div className="sim-table-wrapper">
            <table className="ut">
              <thead>
                <tr>
                  <th style={{ width: '42%' }}>Usuario</th>
                  <th>Rol</th>
                  <th>Zonas</th>
                  <th>Última sesión</th>
                </tr>
              </thead>
              <tbody>
                {USUARIOS_DEMO.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="ut-user">
                        <div className={`ut-avatar ${u.cls}`}>{u.avatar}</div>
                        <div>
                          <div className="nm">{u.nm}</div>
                          <div className="em">{u.em}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`role ${u.role}`}>{ROLE_LABEL[u.role]}</span></td>
                    <td>
                      <div className="zone-chips">
                        {u.zonas.map(z => <span key={z}>{z}</span>)}
                      </div>
                    </td>
                    <td>
                      <span className={`seen ${u.online ? 'on' : ''}`}>{u.seen}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="adm-side">
          <div className="adm-card">
            <div className="adm-head">
              <div>
                <h3>Permisos <em>base</em></h3>
                <div className="sub">Rol: <b>Analista</b></div>
              </div>
            </div>
            <div className="perm">
              {permisos.map(p => (
                <div key={p.id} className="perm-row">
                  <div className="lb">
                    {p.label}
                    <small>{p.desc}</small>
                  </div>
                  <button
                    type="button"
                    className={`sw ${p.on ? 'on' : ''}`}
                    onClick={() => togglePerm(p.id)}
                    aria-label={`${p.label} · ${p.on ? 'activado' : 'desactivado'}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="adm-card">
            <div className="adm-head">
              <div>
                <h3>Actividad <em>reciente</em></h3>
                <div className="sub">últimas 24h</div>
              </div>
            </div>
            <div className="log">
              {ACTIVIDAD.map((a, i) => (
                <div key={i} className="log-item">
                  <div className={`dot ${a.kind === 'w' ? 'w' : a.kind === 'd' ? 'd' : ''}`}></div>
                  <div className="txt">
                    <b>{a.who}</b> {a.what}{a.target ? <> <b>{a.target}</b></> : null}
                    <small>{a.sub}</small>
                  </div>
                  <div className="tm">{a.time}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Usuarios
