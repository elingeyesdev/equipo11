import React from 'react';
import VariableCard from './VariableCard';

const VariableGrid = () => {
  const variables = [
    {
      title: 'Temperatura',
      value: '24',
      unit: '°C',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path>
        </svg>
      )
    },
    {
      title: 'Humedad Relativa',
      value: '45',
      unit: '%',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22a5 5 0 0 0 5-5c0-2-2.5-7-5-11-2.5 4-5 9-5 11a5 5 0 0 0 5 5z"></path>
        </svg>
      )
    },
    {
      title: 'Índice UV',
      value: '6.5',
      unit: 'Alto',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4"></circle>
          <path d="M12 2v2"></path>
          <path d="M12 20v2"></path>
          <path d="m4.93 4.93 1.41 1.41"></path>
          <path d="m17.66 17.66 1.41 1.41"></path>
          <path d="M2 12h2"></path>
          <path d="M20 12h2"></path>
          <path d="m6.34 17.66-1.41 1.41"></path>
          <path d="m19.07 4.93-1.41 1.41"></path>
        </svg>
      )
    },
    {
      title: 'Calidad del Aire (AQI)',
      value: '42',
      unit: 'Bueno',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"></path>
        </svg>
      )
    }
  ];

  return (
    <section id="variables" className="py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white">Variables Monitoreadas</h2>
          <p className="mt-4 text-gray-400">Datos precisos obtenidos desde nuestras estaciones de campo</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {variables.map((variable, index) => (
            <VariableCard key={index} {...variable} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default VariableGrid;
