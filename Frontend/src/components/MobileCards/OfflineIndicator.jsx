import React from 'react';
import useOfflineData from '../../hooks/useOfflineData';

export default function OfflineIndicator() {
  // Consumimos el hook para obtener el estado isOffline
  // (Pasamos un string vacío ya que aquí solo nos interesa el estado de red, no hacer fetch)
  const { isOffline } = useOfflineData('');

  if (!isOffline) return null;

  return (
    <div 
      role="alert" 
      style={{
        backgroundColor: '#fff3cd',
        color: '#856404',
        padding: '12px 20px',
        textAlign: 'center',
        borderBottom: '1px solid #ffeeba',
        position: 'sticky',
        top: 0,
        zIndex: 9999,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      <strong style={{ display: 'block', fontSize: '1rem', marginBottom: '4px' }}>
        Sin conexión
      </strong>
      <span style={{ fontSize: '0.85rem' }}>
        Mostrando datos guardados. Se actualizarán al reconectarse.
      </span>
    </div>
  );
}
