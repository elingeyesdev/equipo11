import { useState, useEffect, useCallback } from 'react';

const COUNTRIES_API = 'https://countriesnow.space/api/v0.1';
const NOMINATIM_API = 'https://nominatim.openstreetmap.org/search';

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
};

export default function useFronteras() {
  const [paises, setPaises] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  // Initialize countries
  useEffect(() => {
    setLoadingList(true);
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
    ];

    fetch(`${COUNTRIES_API}/countries/states`)
      .then(r => r.json())
      .then(res => {
        let finalPaises = [...baseCountries];
        if (!res.error && res.data) {
          const apiList = res.data.map(d => ({ name: d.name, states: d.states }));
          apiList.forEach(apiCountry => {
            const existing = finalPaises.find(c => 
              c.name === apiCountry.name || 
              (apiCountry.name.includes("Bolivia") && c.name === "Bolivia")
            );
            if (existing) {
              if (apiCountry.states && apiCountry.states.length > 0) {
                existing.states = apiCountry.states;
              }
            } else {
              finalPaises.push(apiCountry);
            }
          });
        }
        finalPaises.sort((a, b) => a.name.localeCompare(b.name));
        setPaises(finalPaises);
      })
      .catch(err => {
        console.error("Error países API, usando fallback:", err);
        setPaises(baseCountries.sort((a, b) => a.name.localeCompare(b.name)));
      })
      .finally(() => setLoadingList(false));
  }, []);

  const fetchProvincias = useCallback(async (pais, depto) => {
    if (!pais || !depto) return [];
    const cleanDepto = depto.replace(/ Department/gi, "").trim();

    if (pais === "Bolivia" && BOLIVIA_PROVINCIAS[cleanDepto]) {
      return BOLIVIA_PROVINCIAS[cleanDepto].sort();
    } else {
      try {
        const res = await fetch(`${COUNTRIES_API}/countries/state/cities`, {
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ country: pais, state: depto })
        }).then(r => r.json());
        if (!res.error && res.data) return res.data.sort();
      } catch (err) {
        console.warn('Failed to fetch cities for state:', err.message);
      }
    }
    return [];
  }, []);

  const fetchGeoBoundary = useCallback(async (pais, depto, prov) => {
    let result = null;
    try {
      let url = new URL(NOMINATIM_API);
      const isSoloDepto = depto && !prov;

      if (prov) {
        let provName = prov;
        if (pais === "Bolivia" && !provName.toLowerCase().includes('provincia')) {
          provName = `Provincia ${provName}`;
        }
        const queryProv = `${provName}, ${depto}, ${pais}`
          .replace(/ Department/gi, '')
          .replace(/ Province/gi, '')
          .replace(/Departamento de /g, '')
          .replace(/Departamento del /g, '');
        url.searchParams.append('q', queryProv);
      } else if (isSoloDepto && pais === "Bolivia") {
        const normalizeStr = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const deptoBase = normalizeStr(depto).replace(/ department/g, "").replace(/ departamento de /g, "").replace(/ departamento del /g, "").trim();
        
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

        url.searchParams.append('q', mappingNombres[deptoBase] || `${depto}, Bolivia`);
        url.searchParams.append('featuretype', 'state');
      } else {
        if (pais) url.searchParams.append('country', pais);
        if (depto) {
          const cleanDepto = depto.replace(/ Department| Province/gi, "").trim();
          url.searchParams.append('state', cleanDepto);
        }
      }
      
      url.searchParams.append('format', 'json');
      url.searchParams.append('polygon_geojson', '1');
      url.searchParams.append('limit', '1');
      url.searchParams.append('polygon_threshold', '0.005');

      let res = await fetch(url.toString(), { headers: { 'Accept-Language': 'es' } });
      let data = await res.json();
      
      if (!data || data.length === 0) {
        const fallbackUrl = new URL(NOMINATIM_API);
        fallbackUrl.searchParams.append('format', 'json');
        fallbackUrl.searchParams.append('polygon_geojson', '1');
        fallbackUrl.searchParams.append('limit', '1');
        const parts = [];
        if (prov) parts.push(prov);
        if (depto) parts.push(depto.replace(/ Department| Province/gi, "").trim());
        if (pais) parts.push(pais);
        fallbackUrl.searchParams.append('q', parts.join(', '));
        
        res = await fetch(fallbackUrl.toString(), { headers: { 'Accept-Language': 'es' } });
        data = await res.json();
      }
      
      if (data && data.length > 0 && data[0].geojson) {
        const bbox = data[0].boundingbox;
        result = {
          geojson: { type: "FeatureCollection", features: [{ type: "Feature", geometry: data[0].geojson, properties: { name: data[0].display_name } }] },
          bbox: [[parseFloat(bbox[2]), parseFloat(bbox[0])], [parseFloat(bbox[3]), parseFloat(bbox[1])]],
          nombre: prov || depto || pais
        };
      }
    } catch (err) {
      console.error("Error geo", err);
    }
    
    return result;
  }, []);

  return {
    paises,
    loadingList,
    fetchProvincias,
    fetchGeoBoundary
  };
}
