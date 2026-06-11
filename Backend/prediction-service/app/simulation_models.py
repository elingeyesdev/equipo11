from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class SimulationRequest(BaseModel):
    nombre: str = Field(..., max_length=200)
    descripcion: Optional[str] = None
    localidad_id: int
    tipo_evento: str  # 'tormenta', 'ola_calor', 'incendio', 'inundacion', 'custom'
    area_geo: Any     # Can be a list of dicts [{"lat": ..., "lng": ...}] or a GeoJSON polygon
    parametros: Dict[str, Any]  # e.g., {"intensidad": float, "duracion_horas": int, "metricas_afectadas": list[str]}
    creado_por: Optional[int] = None

class SimulationPoint(BaseModel):
    lat: float
    lng: float
    metrica_clave: str
    valor: float
    tiempo: str  # ISO timestamp

class SimulationResponse(BaseModel):
    id_simulacion: int
    nombre: str
    estado: str
    datos_generados_count: int
    predicciones_derivadas: Dict[str, Any]
    alertas_generadas: List[Dict[str, Any]]
