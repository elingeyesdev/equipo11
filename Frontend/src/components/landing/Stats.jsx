import React from 'react';

const Stats = () => {
  const stats = [
    { label: 'Uptime del Sistema', value: '99.9%' },
    { label: 'Lecturas Diarias', value: '+50K' },
    { label: 'Estaciones Activas', value: '24' },
    { label: 'Alertas Emitidas', value: '1.2K' }
  ];

  return (
    <section className="py-16 border-t border-dusk-blue/50 bg-prussian-blue/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-4xl font-extrabold text-tropical-teal mb-2">{stat.value}</div>
              <div className="text-sm font-medium text-gray-400 uppercase tracking-wide">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Stats;
