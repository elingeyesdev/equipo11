import { useState, useEffect } from 'react'
import { useSimulacion } from '../../context/SimulacionContext'
import './FronterasPanel.css'

const COUNTRIES_API = 'https://countriesnow.space/api/v0.1'
const NOMINATIM_API = 'https://nominatim.openstreetmap.org/search'

const METRICAS_OPTS = [
  { id: 'temperatura', label: 'Temperatura (°C)' },
  { id: 'aqi', label: 'Calidad del Aire (AQI)' },
  { id: 'ica', label: 'Calidad del Agua (ICA)' },
  { id: 'ruido', label: 'Ruido Ambiental (dB)' },
  { id: 'humedad', label: 'Humedad (%)' },
]

const ESCENARIOS_OPTS = [
  { id: 'baseline', nombre: 'Tendencia Estable', inicio: 20, fin: 25, curva: 'lineal' },
  { id: 'crisis', nombre: 'Crisis Repentina', inicio: 10, fin: 90, curva: 'exponencial' },
  { id: 'pico', nombre: 'Pico y Descenso', inicio: 30, fin: 80, curva: 'pico' },
]

function calcCenter(bbox) {
  // bbox: [[lonMin, latMin], [lonMax, latMax]]
  const lng = (bbox[0][0] + bbox[1][0]) / 2
  const lat = (bbox[0][1] + bbox[1][1]) / 2
  return { lng, lat }
}

export default function FronterasPanel({ onBoundarySelect, onStartSimulation, isRunning }) {
  const { 
    isComparing, setIsComparing, 
    zona1Cfg: zona1, setZona1Cfg: setZona1, 
    zona2Cfg: zona2, setZona2Cfg: setZona2 
  } = useSimulacion()

  const [paises, setPaises] = useState([])
  const [loadingList, setLoadingList] = useState(false)



  useEffect(() => {
    setLoadingList(true)
    
    // Lista base de países para asegurar que Bolivia siempre esté
    const baseCountries = [
      { 
        name: "Bolivia", 
        states: [
          { name: "Beni" }, { name: "Chuquisaca" }, { name: "Cochabamba" },
          { name: "La Paz" }, { name: "Oruro" }, { name: "Pando" },
          { name: "Potosí" }, { name: "Santa Cruz" }, { name: "Tarija" }
        ] 
      },
      { name: "Argentina", states: [] },
      { name: "Brasil", states: [] },
      { name: "Chile", states: [] },
      { name: "Perú", states: [] }
    ]

    fetch(`${COUNTRIES_API}/countries/states`)
      .then(r => r.json())
      .then(res => {
        let finalPaises = [...baseCountries]
        
        if (!res.error && res.data) {
          const apiList = res.data.map(d => ({ name: d.name, states: d.states }))
          
          // Combinar con la lista de la API, evitando duplicar Bolivia
          apiList.forEach(apiCountry => {
            if (!apiCountry.name.includes("Bolivia")) {
              finalPaises.push(apiCountry)
            } else {
              // Si la API tiene Bolivia, nos aseguramos de que tenga los 9 departamentos
              const b = finalPaises.find(c => c.name === "Bolivia")
              if (apiCountry.states && apiCountry.states.length >= 9) {
                b.states = apiCountry.states
              }
            }
          })
        }
        
        finalPaises.sort((a, b) => a.name.localeCompare(b.name))
        setPaises(finalPaises)
      })
      .catch(err => {
        console.error("Error países API, usando fallback:", err)
        setPaises(baseCountries.sort((a, b) => a.name.localeCompare(b.name)))
      })
      .finally(() => setLoadingList(false))
  }, [])

  // Al montar, si ya hay fronteras seleccionadas, notificamos al mapa
  useEffect(() => {
    if (zona1.result || (isComparing && zona2.result)) {
      emitBoundaries(zona1, zona2, 'init')
    }
  }, [])

  // -- Helpers Zona --
  const updateZona = (setZ, key, val) => setZ(prev => ({ ...prev, [key]: val }))

  const handlePaisChange = async (zState, setZ, p, isZ2) => {
    setZ(prev => ({ ...prev, pais: p, depto: '', prov: '', departamentos: [], provincias: [], result: null }))
    emitBoundaries({ ...zState, result: null }, isZ2 ? zState : null, isZ2 ? 'z2' : 'z1') // Limpiar
    
    if (p) {
      const pObj = paises.find(x => x.name === p)
      if (pObj && pObj.states) {
        setZ(prev => ({ ...prev, departamentos: pObj.states.sort((a, b) => a.name.localeCompare(b.name)) }))
      }
      await fetchGeoForZona({ ...zState, pais: p, depto: '', prov: '' }, setZ, isZ2)
    }
  }

  const BOLIVIA_PROVINCIAS = {
    "Beni": ["Cercado", "Iténez", "José Ballivián", "Mamoré", "Marbán", "Moxos", "Vaca Díez", "Yacuma"],
    "Chuquisaca": ["Belisario Boeto", "Hernando Siles", "Jaime Zudáñez", "Juana Azurduy de Padilla", "Luis Calvo", "Nor Cinti", "Oropeza", "Sud Cinti", "Tomina", "Yamparáez"],
    "Cochabamba": ["Arani", "Arque", "Ayopaya", "Bolivar", "Campero", "Capinota", "Carrasco", "Cercado", "Chapare", "Esteban Arce", "Germán Jordán", "Mizque", "Punata", "Quillacollo", "Tapacarí", "Tiraque"],
    "La Paz": ["Abel Iturralde", "Aroma", "Bautista Saavedra", "Caranavi", "Eliodoro Camacho", "Franz Tamayo", "Gualberto Villarroel", "Ingavi", "Inquisivi", "José Manuel Pando", "Larecaja", "Loayza", "Los Andes", "Manco Kapac", "Muñecas", "Murillo", "Nor Yungas", "Omasuyos", "Pacajes", "Sud Yungas"],
    "Oruro": ["Atahuallpa", "Carangas", "Cercado", "Eduardo Avaroa", "Ladislao Cabrera", "Litoral", "Nor Carangas", "Pantaleón Dalence", "Poopó", "Puerto de Mejillones", "Sajama", "San Pedro de Totora", "Saucarí", "Sebastián Pagador", "Sud Carangas", "Tomas Barrón"],
    "Pando": ["Abuná", "Federico Román", "Madre de Dios", "Manuripi", "Nicolás Suárez"],
    "Potosí": ["Alonso de Ibáñez", "Antonio Quijarro", "Bernardino Bilbao", "Charcas", "Chayanta", "Cornelio Saavedra", "Daniel Campos", "Enrique Baldivieso", "José María Linares", "Modesto Omiste", "Nor Chichas", "Nor Lípez", "Rafael Bustillo", "Sud Chichas", "Sud Lípez", "Tomás Frías"],
    "Santa Cruz": ["Andrés Ibáñez", "Ángel Sandoval", "Chiquitos", "Cordillera", "Florida", "Germán Busch", "Guarayos", "Ichilo", "Ignacio Warnes", "José Miguel de Velasco", "Manuel María Caballero", "Ñuflo de Chávez", "Obispo Santistevan", "Sara", "Vallegrande"],
    "Tarija": ["Aniceto Arce", "Burdet O'Connor", "Cercado", "Eustaquio Méndez", "Gran Chaco", "José María Avilés"]
  }

  const handleDeptoChange = async (zState, setZ, d, isZ2) => {
    setZ(prev => ({ ...prev, depto: d, prov: '', provincias: [], result: null }))
    if (d) {
      // Normalizar nombre para buscar en el catálogo local
      const cleanDepto = d.replace(/ Department/gi, "").trim();

      if (zState.pais === "Bolivia" && BOLIVIA_PROVINCIAS[cleanDepto]) {
        // Para Bolivia usamos el catálogo oficial de PROVINCIAS
        setZ(prev => ({ ...prev, provincias: BOLIVIA_PROVINCIAS[cleanDepto].sort() }))
        setLoadingList(false)
        await fetchGeoForZona({ ...zState, depto: d, prov: '' }, setZ, isZ2)
      } else {
        // Otros países siguen usando la API de ciudades
        setLoadingList(true)
        try {
          const res = await fetch(`${COUNTRIES_API}/countries/state/cities`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ country: zState.pais, state: d })
          }).then(r => r.json())
          if (!res.error && res.data) setZ(prev => ({ ...prev, provincias: res.data.sort() }))
        } catch (err) {}
        setLoadingList(false)
        await fetchGeoForZona({ ...zState, depto: d, prov: '' }, setZ, isZ2)
      }
    } else {
      await fetchGeoForZona({ ...zState, depto: '', prov: '' }, setZ, isZ2)
    }
  }

  const handleProvChange = async (zState, setZ, pr, isZ2) => {
    setZ(prev => ({ ...prev, prov: pr, result: null }))
    if (pr) await fetchGeoForZona({ ...zState, prov: pr }, setZ, isZ2)
    else await fetchGeoForZona({ ...zState, prov: '' }, setZ, isZ2)
  }

  const fetchGeoForZona = async (zState, setZ, isZ2) => {
    setZ(prev => ({ ...prev, loadingGeo: true }))
    let result = null
    const BOLIVIA_OSM_IDS = {
      "Beni": "R405935", "Beni Department": "R405935", "Departamento del Beni": "R405935",
      "Chuquisaca": "R405917", "Chuquisaca Department": "R405917", "Departamento de Chuquisaca": "R405917",
      "Cochabamba": "R394206", "Cochabamba Department": "R394206", "Departamento de Cochabamba": "R394206",
      "La Paz": "R400473", "La Paz Department": "R400473", "Departamento de La Paz": "R400473",
      "Oruro": "R405929", "Oruro Department": "R405929", "Departamento de Oruro": "R405929",
      "Pando": "R413000", "Pando Department": "R413000", "Departamento de Pando": "R413000",
      "Potosí": "R405943", "Potosi": "R405943", "Potosí Department": "R405943", "Departamento de Potosí": "R405943",
      "Santa Cruz": "R413005", "Santa Cruz Department": "R413005", "Departamento de Santa Cruz": "R413005",
      "Tarija": "R405947", "Tarija Department": "R405947", "Departamento de Tarija": "R405947"
    }

    try {
      let url = new URL(NOMINATIM_API)
      const isSoloPais = !zState.depto && !zState.prov;
      const isSoloDepto = zState.depto && !zState.prov;

      if (zState.prov) {
        // PROVINCIAS: Búsqueda combinada. En Bolivia forzamos el prefijo 'Provincia' para precisión.
        let provName = zState.prov;
        if (zState.pais === "Bolivia" && !provName.toLowerCase().includes('provincia')) {
          provName = `Provincia ${provName}`;
        }
        
        const queryProv = `${provName}, ${zState.depto}, Bolivia`
          .replace(/ Department/g, '')
          .replace(/Departamento de /g, '')
          .replace(/Departamento del /g, '');
        url.searchParams.append('q', queryProv);
      } else if (isSoloDepto && zState.pais === "Bolivia") {
        // DEPARTAMENTOS BOLIVIA: Búsqueda técnica mapeada
        const normalizeStr = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const deptoBase = normalizeStr(zState.depto).replace(/ department/g, "").replace(/ departamento de /g, "").replace(/ departamento del /g, "").trim();
        
        const mappingNombres = {
          "beni": "Departamento del Beni, Bolivia",
          "chuquisaca": "Departamento de Chuquisaca, Bolivia",
          "cochabamba": "Departamento de Cochabamba, Bolivia",
          "la paz": "Departamento de La Paz, Bolivia",
          "oruro": "Departamento de Oruro, Bolivia",
          "pando": "Departamento de Pando, Bolivia",
          "potosi": "Departamento de Potosí, Bolivia",
          "santa cruz": "Departamento de Santa Cruz, Bolivia",
          "tarija": "Departamento de Tarija, Bolivia"
        };

        url.searchParams.append('q', mappingNombres[deptoBase] || `${zState.depto}, Bolivia`);
        url.searchParams.append('featuretype', 'state');
      } else {
        // OTROS CASOS (País solo o países extranjeros)
        url.searchParams.append('format', 'json')
        if (isSoloPais) {
          url.searchParams.append('country', zState.pais);
          url.searchParams.append('featuretype', 'country');
        } else {
          if (zState.pais) url.searchParams.append('country', zState.pais);
          if (zState.depto) url.searchParams.append('state', zState.depto);
        }
      }
      
      url.searchParams.append('format', 'json')
      url.searchParams.append('polygon_geojson', '1')
      url.searchParams.append('limit', '1')
      url.searchParams.append('polygon_threshold', '0.005');

      console.log("Buscando frontera:", url.toString());
      let res = await fetch(url.toString(), { headers: { 'Accept-Language': 'es' } })
      let data = await res.json()
      
      // Si falla la búsqueda específica, intentamos con el fallback general
      if (!data || data.length === 0) {
        const fallbackUrl = new URL(NOMINATIM_API)
        fallbackUrl.searchParams.append('format', 'json')
        fallbackUrl.searchParams.append('polygon_geojson', '1')
        fallbackUrl.searchParams.append('limit', '1')
        const parts = []
        if (zState.prov) parts.push(zState.prov)
        if (zState.depto) parts.push(zState.depto)
        if (zState.pais) parts.push(zState.pais)
        fallbackUrl.searchParams.append('q', parts.join(', '))
        
        res = await fetch(fallbackUrl.toString(), { headers: { 'Accept-Language': 'es' } })
        data = await res.json()
      }
      
      if (data && data.length > 0 && data[0].geojson) {
        const bbox = data[0].boundingbox
        result = {
          geojson: { type: "FeatureCollection", features: [{ type: "Feature", geometry: data[0].geojson, properties: { name: data[0].display_name } }] },
          bbox: [[parseFloat(bbox[2]), parseFloat(bbox[0])], [parseFloat(bbox[3]), parseFloat(bbox[1])]],
          nombre: zState.prov || zState.depto || zState.pais
        }
      }
    } catch (err) { console.error("Error geo", err) }
    
    setZ(prev => ({ ...prev, result, loadingGeo: false }))
    
    // Emitir ambas zonas al mapa
    if (isZ2) emitBoundaries(zona1, { ...zState, result }, 'z2')
    else emitBoundaries({ ...zState, result }, zona2, 'z1')
  }

  const emitBoundaries = (z1, z2, changed) => {
    onBoundarySelect({ z1: z1?.result, z2: isComparing ? z2?.result : null, changed })
  }

  const handleStart = () => {
    if (!zona1.result) return alert("Selecciona al menos una zona válida (País/Departamento/Provincia).")
    if (isComparing && !zona2.result) return alert("Selecciona la segunda zona para comparar.")

    const fronteras = [zona1.result]
    if (isComparing && zona2.result) fronteras.push(zona2.result)

    onStartSimulation(fronteras) // Le pasamos las fronteras al modal
  }

  const renderFronteraForm = (z, setZ, isZ2) => (
    <div className="fp-zona-box">
      <div className="fp-field">
        <label>País {isZ2 && "2"}</label>
        <select value={z.pais} onChange={e => handlePaisChange(z, setZ, e.target.value, isZ2)} disabled={paises.length === 0 || isRunning}>
          <option value="">Selecciona País...</option>
          {paises.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
      </div>
      {z.pais && (
        <div className="fp-field">
          <label>Departamento</label>
          <select value={z.depto} onChange={e => handleDeptoChange(z, setZ, e.target.value, isZ2)} disabled={z.departamentos.length === 0 || isRunning}>
            <option value="">Todo el país</option>
            {z.departamentos.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
          </select>
        </div>
      )}
      {z.depto && (
        <div className="fp-field">
          <label>Provincia</label>
          <select value={z.prov} onChange={e => handleProvChange(z, setZ, e.target.value, isZ2)} disabled={z.provincias.length === 0 || isRunning}>
            <option value="">Todo el departamento</option>
            {z.provincias.map(pr => <option key={pr} value={pr}>{pr}</option>)}
          </select>
        </div>
      )}
      {z.loadingGeo && <div className="fp-msg fp-msg-load">Cargando frontera...</div>}
      {!z.loadingGeo && z.pais && !z.result && <div className="fp-msg fp-msg-err">Frontera no disponible en mapa.</div>}
      {!z.loadingGeo && z.result && <div className="fp-msg fp-msg-ok">Frontera mapeada con éxito.</div>}
    </div>
  )

  return (
    <div className="fronteras-panel">
      <div className="fronteras-header">
        <h4>Fronteras de Simulación</h4>
        {loadingList && <span className="fronteras-spinner"></span>}
      </div>
      
      <div className="fronteras-body">
        {/* Zonas */}
        <div className="fp-section">
          {renderFronteraForm(zona1, setZona1, false)}
          
          <label className="fp-checkbox">
            <input type="checkbox" checked={isComparing} disabled={isRunning} onChange={e => {
              setIsComparing(e.target.checked)
              if (!e.target.checked) emitBoundaries(zona1, null)
              else emitBoundaries(zona1, zona2)
            }} />
            Comparar con otra frontera
          </label>

          {isComparing && renderFronteraForm(zona2, setZona2, true)}
        </div>
      </div>

      <div className="fronteras-footer">
        <button className="fp-btn-start" onClick={handleStart} disabled={isRunning || !zona1.result || (isComparing && !zona2.result)}>
          {isRunning ? 'Simulación en progreso...' : 'Configurar Simulación'}
        </button>
      </div>
    </div>
  )
}
