import { useState, useEffect, useMemo } from 'react'
import { useUnidades } from '../../hooks/useUnidades'
import { formatearValor } from '../../utils/unidades'
import './Reportes.css'

export default function Reportes() {
  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(true)
  const { unidades } = useUnidades()

  // Filtros
  const [ciudadFiltro, setCiudadFiltro] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')

  useEffect(() => {
    fetch('http://localhost:3000/api/historial')
      .then(res => res.json())
      .then(data => {
        // Aplanar la estructura de timeline a filas para la tabla
        const flatData = []
        data.forEach(t => {
          t.cities.forEach(c => {
            flatData.push({
              fecha: t.timestamp,
              ciudad: c.name,
              aqi: c.data.aqi,
              temperatura: c.data.temperatura,
              humedad: c.data.humedad,
              ruido: c.data.ruido,
              ica: c.data.ica
            })
          })
        })
        setHistorial(flatData.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)))
      })
      .finally(() => setLoading(false))
  }, [])

  // Datos filtrados
  const datosFiltrados = useMemo(() => {
    return historial.filter(row => {
      if (ciudadFiltro && !row.ciudad.toLowerCase().includes(ciudadFiltro.toLowerCase())) return false;
      if (fechaInicio && new Date(row.fecha) < new Date(fechaInicio)) return false;
      if (fechaFin && new Date(row.fecha) > new Date(fechaFin + 'T23:59:59')) return false;
      return true;
    });
  }, [historial, ciudadFiltro, fechaInicio, fechaFin]);

  const descargarReporte = async (formato) => {
    try {
      const payload = {
        formato,
        titulo: `Reporte Ambiental - ${ciudadFiltro || 'Todas las ciudades'}`,
        columnas: [
          { header: 'Fecha y Hora', key: 'fechaFmt' },
          { header: 'Ciudad', key: 'ciudad' },
          { header: 'Temp', key: 'temperaturaFmt' },
          { header: 'AQI', key: 'aqiFmt' },
          { header: 'Humedad', key: 'humedadFmt' },
          { header: 'Ruido', key: 'ruidoFmt' }
        ],
        datos: datosFiltrados.map(d => ({
          fechaFmt: new Date(d.fecha).toLocaleString('es-BO'),
          ciudad: d.ciudad,
          temperaturaFmt: formatearValor('temperatura', d.temperatura, unidades.temperatura),
          aqiFmt: formatearValor('aqi', d.aqi, unidades.aqi),
          humedadFmt: formatearValor('humedad', d.humedad, unidades.humedad),
          ruidoFmt: formatearValor('ruido', d.ruido, unidades.ruido)
        }))
      };

      const res = await fetch('http://localhost:3000/api/reportes/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Error al generar el reporte');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte_ambiental.${formato === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="page reportes-page">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Exportación de datos</p>
          <h1 className="page-heading">Generación de <em>Reportes</em></h1>
          <p className="page-desc">Consulta el historial de lecturas y exporta los datos en formato PDF o Excel.</p>
        </div>
        <span className="page-tag">{datosFiltrados.length} registros</span>
      </div>

      <div className="reportes-filtros">
        <div className="reportes-filtros-fila">
          <label className="reportes-label">
            Ciudad
            <input type="text" className="reportes-input" placeholder="Ej. La Paz" value={ciudadFiltro} onChange={e => setCiudadFiltro(e.target.value)} />
          </label>
          <label className="reportes-label">
            Desde
            <input type="date" className="reportes-input" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
          </label>
          <label className="reportes-label">
            Hasta
            <input type="date" className="reportes-input" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
          </label>
          
          <div className="reportes-actions">
            <button className="btn-export btn-pdf" onClick={() => descargarReporte('pdf')}>📄 Descargar PDF</button>
            <button className="btn-export btn-excel" onClick={() => descargarReporte('excel')}>📊 Descargar Excel</button>
          </div>
        </div>
      </div>

      <div className="reportes-tabla-wrap">
        {loading ? (
          <div className="reportes-estado">Cargando historial de datos...</div>
        ) : (
          <table className="reportes-tabla">
            <thead>
              <tr>
                <th>Fecha / Hora</th>
                <th>Ciudad</th>
                <th>Temp</th>
                <th>AQI</th>
                <th>Humedad</th>
                <th>Ruido</th>
              </tr>
            </thead>
            <tbody>
              {datosFiltrados.slice(0, 100).map((row, i) => (
                <tr key={i}>
                  <td>{new Date(row.fecha).toLocaleString('es-BO')}</td>
                  <td>{row.ciudad}</td>
                  <td>{formatearValor('temperatura', row.temperatura, unidades.temperatura)}</td>
                  <td>{formatearValor('aqi', row.aqi, unidades.aqi)}</td>
                  <td>{formatearValor('humedad', row.humedad, unidades.humedad)}</td>
                  <td>{formatearValor('ruido', row.ruido, unidades.ruido)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div style={{textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)'}}>Mostrando hasta 100 registros en pantalla. El reporte descargará todos los {datosFiltrados.length} registros filtrados.</div>
    </div>
  )
}
